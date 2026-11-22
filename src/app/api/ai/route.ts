import { authConfigured, getCaller, isAdmin } from "@/lib/serverAuth";
import { aiBudgetLeft, rateLimit } from "@/lib/rateLimit";
import { buildDesignMd, ruleSuggestions, type Summary } from "@/lib/report";

export const maxDuration = 120;

const BASE = process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1";
const MODEL = process.env.NVIDIA_MODEL || "nvidia/nemotron-3.5-super-vl-120b-a12b";
const FALLBACK = process.env.NVIDIA_FALLBACK_MODEL || "nvidia/nemotron-3.5-lightning-30b-a3b";

type Msg = { role: string; content: string | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[] };

async function chat(messages: Msg[], maxTokens: number) {
  try {
    return await chatWith(MODEL, messages, maxTokens, 75000);
  } catch (e) {
    if (!FALLBACK || FALLBACK === MODEL) throw e;
    // Fallback model is text-only: drop images. Fits inside the 120s function limit.
    const textOnly = messages.map((m) => (typeof m.content === "string" ? m : { ...m, content: m.content.filter((c) => c.type === "text") }));
    return chatWith(FALLBACK, textOnly, maxTokens, 35000);
  }
}

async function chatWith(model: string, messages: Msg[], maxTokens: number, timeoutMs: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.NVIDIA_API_KEY}` },
      // Thinking off: faster, and the whole token budget goes to the answer (Nemotron/Qwen-style models).
      body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: maxTokens, chat_template_kwargs: { enable_thinking: false } }),
    });
    if (!r.ok) throw new Error(`NVIDIA API ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    // Reasoning models may include a <think>…</think> block; drop it.
    const out = ((j.choices?.[0]?.message?.content as string) || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    if (!out) throw new Error(`${model} returned an empty answer (finish: ${j.choices?.[0]?.finish_reason})`);
    return out;
  } finally {
    clearTimeout(t);
  }
}

type PageInfo = { url: string; title?: string; description?: string | null; h1?: string[]; h2?: string[] };
type About = { summary: string; whatItIs: string; audience: string; offerings: string[]; sections: string[]; tone: string; mainAction: string };

/** "About this website" without AI: built from titles, descriptions and headings. */
function aboutFallback(s: Summary, pages: PageInfo[]): About {
  const home = pages[0] || ({} as PageInfo);
  const host = (() => { try { return new URL(s.url || home.url).hostname; } catch { return "this site"; } })();
  return {
    summary: home.description || home.title || `${host} website.`,
    whatItIs: home.title || host,
    audience: "Not detected (add an NVIDIA key for an AI description).",
    offerings: [...new Set(pages.slice(1).map((p) => p.title?.split(/[|\-–—]/)[0].trim()).filter(Boolean) as string[])].slice(0, 8),
    sections: [...new Set(pages.flatMap((p) => p.h2 || []))].slice(0, 10),
    tone: "—",
    mainAction: s.design?.buttons[0]?.text || "—",
  };
}

export async function POST(req: Request) {
  const { summary, textSample, screenshot, pagesInfo = [] } = (await req.json()) as { summary: Summary; textSample?: string; screenshot?: string; pagesInfo?: PageInfo[] };
  const rules = ruleSuggestions(summary);
  const baseMd = buildDesignMd(summary);
  const aboutBase = aboutFallback(summary, pagesInfo);

  if (!process.env.NVIDIA_API_KEY) {
    return Response.json({ ai: false, note: "Add NVIDIA_API_KEY to get AI suggestions and AI design notes. Showing measured design.md and rule-based suggestions.", suggestions: rules, designMd: baseMd, about: aboutBase });
  }
  // Guests (when accounts are switched on) get the measured results without AI
  const caller = authConfigured() ? await getCaller(req) : null;
  if (authConfigured() && !caller) {
    return Response.json({ ai: false, note: "Sign in to unlock AI suggestions and the full design.md.", suggestions: rules, designMd: baseMd, about: aboutBase });
  }
  // Over the limit: still answer, just without AI (so the dashboard keeps working)
  const limited = await rateLimit(req, "ai");
  if (limited || !(await aiBudgetLeft(isAdmin(caller)))) {
    const msg = limited ? ((await limited.json()) as { error: string }).error : "The AI has reached today's limit.";
    return Response.json({ ai: false, note: `${msg} Showing measured design.md and rule-based suggestions.`, suggestions: rules, designMd: baseMd, about: aboutBase });
  }

  const facts = JSON.stringify({ ...summary, performance: { ...summary.performance, pages: summary.performance.pages.slice(0, 10) } }).slice(0, 16000);
  const withImage = (text: string): Msg["content"] =>
    screenshot?.startsWith("data:image/") ? [{ type: "text", text }, { type: "image_url", image_url: { url: screenshot } }] : text;

  const designSys = "You are a senior product designer writing design-system documentation that a developer or an AI model will use to rebuild this website's look exactly. Use the measured data and the screenshot. Never change hex codes, font names or pixel values from the data. Be specific and concrete. Write in clear, simple English. Output Markdown only, no code fences around the whole answer.";
  const pagesText = JSON.stringify(pagesInfo.slice(0, 15)).slice(0, 5000);

  const [sug, notes, notes2, about] = await Promise.allSettled([
    chat([
      { role: "system", content: "You are a senior web designer, SEO and web security reviewer. Only use the facts given. Never invent numbers. Reply with JSON only." },
      { role: "user", content: `Website analysis data:\n${facts}\n\nHomepage text sample:\n${(textSample || "").slice(0, 1200)}\n\nAlready found issues:\n${JSON.stringify(rules).slice(0, 3000)}\n\nGive 8-12 concrete, prioritized improvement suggestions covering design, UX, accessibility, SEO, performance and security. Return a JSON array: [{"area":"Design|UX|Accessibility|SEO|Performance|Security|Content","priority":"high|medium|low","title":"short","detail":"1-2 simple sentences, specific to this site"}]` },
    ], 2000),
    // design.md part 1: look & structure (uses the screenshot)
    chat([
      { role: "system", content: designSys },
      { role: "user", content: withImage(`Below is a measured design.md for a website (the screenshot is its homepage).\n\n${baseMd.slice(0, 14000)}\n\nWrite ONLY these extra sections (they will be inserted into the document), each detailed and specific to this site:\n\n## Visual style & personality\n(5-7 bullets: mood, brand feel, density, contrast, what makes it instantly recognisable)\n\n## Homepage anatomy\n(go through the screenshot top to bottom: for EACH section give its purpose, layout (columns, alignment, full-bleed or contained), approximate height, background, the elements inside and which tokens they use)\n\n## Layout patterns\n(grid, columns, gutters, alignment, whitespace rhythm, how sections are separated)\n\n## Imagery & iconography\n(photo/illustration style, aspect ratios, image treatment such as overlays, gradients, rounded corners; icon style: outline/filled, stroke width, size)\n\n## Voice & tone\n(how the copy reads: headline length, wording style, calls to action)`) },
    ], 3000),
    // design.md part 2: components & rules
    chat([
      { role: "system", content: designSys },
      { role: "user", content: `Measured design.md:\n\n${baseMd.slice(0, 14000)}\n\nWrite ONLY these extra sections, detailed and specific to this site (keep each section focused; do not repeat the measured tables):\n\n## Prompt for AI tools\n(FIRST: a ready-to-paste paragraph that tells an AI coding assistant exactly how to recreate this design: theme, colours with hex, fonts, sizes, spacing, radius, shadows, component styles, motion)\n\n## Component specifications\n(for each: buttons (primary, secondary, ghost), links, navigation bar, cards, forms/inputs, badges/tags, footer: exact styles from the data, plus hover, focus, active and disabled states; mark guesses as (suggested))\n\n## Colour usage rules\n(which colour for what, approximate 60/30/10 split, accent rules)\n\n## Typography rules\n(heading hierarchy h1-h6 with sizes from the data, body copy, max line length, weights, when to use the secondary font)\n\n## Responsive behaviour\n(how layout, type sizes and navigation should change at the measured breakpoints; mobile first)\n\n## Motion guidelines\n(durations, easings, what animates and when)\n\n## Accessibility checklist\n(contrast pairs that pass/fail, focus styles, alt text, motion)` },
    ], 4500),
    // About this website
    chat([
      { role: "system", content: "You describe websites accurately and briefly. Only use the information given. Reply with JSON only." },
      { role: "user", content: `Website: ${summary.url}\nPages (title, description, headings):\n${pagesText}\n\nHomepage text:\n${(textSample || "").slice(0, 2000)}\n\nTech stack: ${summary.tech.map((t) => t.name).join(", ")}\n\nReturn JSON: {"summary":"2-3 sentences: what this website/company is and does","whatItIs":"short label, e.g. 'Video game publisher website'","audience":"who it is for","offerings":["main products/services/content, max 8"],"sections":["main areas of the site, max 10"],"tone":"brand tone in a few words","mainAction":"the main thing visitors are asked to do"}` },
    ], 900),
  ]);

  let suggestions = rules;
  let aiError: string | null = null;
  if (sug.status === "fulfilled") {
    const m = sug.value.match(/\[[\s\S]*\]/);
    try { if (!m) throw 0; suggestions = JSON.parse(m[0]); } catch { aiError = "AI answer was not valid JSON; showing rule-based suggestions"; }
  } else aiError = String(sug.reason?.message || sug.reason);

  // Measured document + AI notes inserted right after the Overview section.
  let designMd = baseMd;
  const clean = (v: string) => v.replace(/^```(markdown|md)?\s*|\s*```$/g, "").trim().replace(/^### /gm, "#### ").replace(/^## /gm, "### ");
  const parts = [notes, notes2].filter((n): n is PromiseFulfilledResult<string> => n.status === "fulfilled" && !!n.value.trim()).map((n) => clean(n.value));
  if (parts.length) {
    const cut = baseMd.indexOf("## 2. Color palette");
    const block = `## AI design notes\n\n> Written by ${MODEL} from the measured data and a homepage screenshot. Measured values in the sections below always win.\n\n${parts.join("\n\n")}\n\n`;
    designMd = cut > 0 ? baseMd.slice(0, cut) + block + baseMd.slice(cut) : baseMd + "\n\n" + block;
  }
  if (!aiError) for (const n of [notes, notes2]) if (n.status === "rejected") { aiError = String(n.reason?.message || n.reason); break; }

  let aboutOut: About = aboutBase;
  if (about.status === "fulfilled") {
    try { const m = about.value.match(/\{[\s\S]*\}/); if (m) aboutOut = { ...aboutBase, ...JSON.parse(m[0]) }; } catch { /* keep fallback */ }
  }

  return Response.json({ ai: true, model: MODEL, suggestions, designMd, rawDesignMd: baseMd, about: aboutOut, error: aiError });
}

