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

export async function POST(req: Request) {
  const { summary, textSample, screenshot } = (await req.json()) as { summary: Summary; textSample?: string; screenshot?: string };
  const rules = ruleSuggestions(summary);
  const baseMd = buildDesignMd(summary);

  if (!process.env.NVIDIA_API_KEY) {
    return Response.json({ ai: false, note: "Add NVIDIA_API_KEY to get AI suggestions and AI design notes. Showing measured design.md and rule-based suggestions.", suggestions: rules, designMd: baseMd });
  }

  const facts = JSON.stringify({ ...summary, performance: { ...summary.performance, pages: summary.performance.pages.slice(0, 10) } }).slice(0, 16000);
  const withImage = (text: string): Msg["content"] =>
    screenshot?.startsWith("data:image/") ? [{ type: "text", text }, { type: "image_url", image_url: { url: screenshot } }] : text;

  const [sug, notes] = await Promise.allSettled([
    chat([
      { role: "system", content: "You are a senior web designer, SEO and web security reviewer. Only use the facts given. Never invent numbers. Reply with JSON only." },
      { role: "user", content: `Website analysis data:\n${facts}\n\nHomepage text sample:\n${(textSample || "").slice(0, 1200)}\n\nAlready found issues:\n${JSON.stringify(rules).slice(0, 3000)}\n\nGive 8-12 concrete, prioritized improvement suggestions covering design, UX, accessibility, SEO, performance and security. Return a JSON array: [{"area":"Design|UX|Accessibility|SEO|Performance|Security|Content","priority":"high|medium|low","title":"short","detail":"1-2 simple sentences, specific to this site"}]` },
    ], 2000),
    chat([
      { role: "system", content: "You are a senior product designer writing design-system documentation. Use the measured data and the screenshot. Never change hex codes, font names or pixel values from the data. Write in clear, simple English. Output Markdown only, no code fences around the whole answer." },
      { role: "user", content: withImage(`Below is a measured design.md for a website (the screenshot is its homepage).\n\n${baseMd.slice(0, 14000)}\n\nWrite ONLY these extra sections (they will be inserted into the document), each detailed and specific to this site:\n\n## Visual style & personality\n(4-6 bullets: mood, brand feel, density, contrast, imagery style, what makes it recognisable)\n\n## Layout patterns\n(describe the page structure seen in the screenshot: hero, sections, grids, columns, alignment, whitespace)\n\n## Component guidance\n(for buttons, cards, navigation, forms, badges, footer: when to use each variant and its states: hover, focus, active, disabled; use the measured values)\n\n## Color usage rules\n(which colour for what, ratios like 60/30/10, how accent is used)\n\n## Typography rules\n(heading hierarchy, body copy, max line length, when to use each weight)\n\n## Motion guidelines\n(how and when things animate, based on the motion data)\n\n## Page recipes\n(2-3 short recipes, e.g. "Landing page", "Content page", listing sections in order with the tokens to use)`) },
    ], 3000),
  ]);

  let suggestions = rules;
  let aiError: string | null = null;
  if (sug.status === "fulfilled") {
    const m = sug.value.match(/\[[\s\S]*\]/);
    try { if (!m) throw 0; suggestions = JSON.parse(m[0]); } catch { aiError = "AI answer was not valid JSON; showing rule-based suggestions"; }
  } else aiError = String(sug.reason?.message || sug.reason);

  // Measured document + AI notes inserted right after the Overview section.
  let designMd = baseMd;
  if (notes.status === "fulfilled" && notes.value.trim()) {
    const ai = notes.value.replace(/^```(markdown|md)?\s*|\s*```$/g, "").trim();
    const cut = baseMd.indexOf("## 2. Color palette");
    const block = `## AI design notes\n\n> Written by ${MODEL} from the measured data and a homepage screenshot.\n\n${ai.replace(/^### /gm, "#### ").replace(/^## /gm, "### ")}\n\n`;
    designMd = cut > 0 ? baseMd.slice(0, cut) + block + baseMd.slice(cut) : baseMd + "\n\n" + block;
  } else if (notes.status === "rejected" && !aiError) aiError = String(notes.reason?.message || notes.reason);

  return Response.json({ ai: true, model: MODEL, suggestions, designMd, rawDesignMd: baseMd, error: aiError });
}

