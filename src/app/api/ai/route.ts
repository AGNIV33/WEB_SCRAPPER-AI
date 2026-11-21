import { buildDesignMd, ruleSuggestions, type Summary } from "@/lib/report";

export const maxDuration = 60;

const BASE = process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1";
const MODEL = process.env.NVIDIA_MODEL || "meta/llama-3.3-70b-instruct";

async function chat(messages: { role: string; content: string }[], maxTokens: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 50000);
  try {
    const r = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.NVIDIA_API_KEY}` },
      body: JSON.stringify({ model: MODEL, messages, temperature: 0.3, max_tokens: maxTokens }),
    });
    if (!r.ok) throw new Error(`NVIDIA API ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    return (j.choices?.[0]?.message?.content as string) || "";
  } finally {
    clearTimeout(t);
  }
}

export async function POST(req: Request) {
  const { summary, textSample } = (await req.json()) as { summary: Summary; textSample?: string };
  const rules = ruleSuggestions(summary);
  const baseMd = buildDesignMd(summary);

  if (!process.env.NVIDIA_API_KEY) {
    return Response.json({ ai: false, note: "Add NVIDIA_API_KEY to get AI suggestions. Showing rule-based results.", suggestions: rules, designMd: baseMd });
  }

  const facts = JSON.stringify({ ...summary, performance: { ...summary.performance, pages: summary.performance.pages.slice(0, 10) } }).slice(0, 14000);

  const [sug, md] = await Promise.allSettled([
    chat([
      { role: "system", content: "You are a senior web designer, SEO and web security reviewer. Only use the facts given. Never invent numbers. Reply with JSON only." },
      { role: "user", content: `Website analysis data:\n${facts}\n\nHomepage text sample:\n${(textSample || "").slice(0, 1200)}\n\nAlready found issues:\n${JSON.stringify(rules).slice(0, 3000)}\n\nGive 8-12 concrete, prioritized improvement suggestions covering design, UX, accessibility, SEO, performance and security. Return a JSON array: [{"area":"Design|UX|Accessibility|SEO|Performance|Security|Content","priority":"high|medium|low","title":"short","detail":"1-2 simple sentences, specific to this site"}]` },
    ], 1800),
    chat([
      { role: "system", content: "You write clear design-system documentation in Markdown. Use only the facts given; keep every hex code, font and size exactly as given." },
      { role: "user", content: `Here is an auto-extracted design.md:\n\n${baseMd}\n\nRewrite it as a polished design.md a developer could use to recreate this site's look. Sections: Overview (style/mood in 2-3 lines), Color palette (with roles: primary, secondary, accent, surface, text, border), Typography (font stack, type scale for h1-h6/body/small), Spacing & layout (sensible guesses marked "suggested"), Components (buttons, cards, nav: describe based on the palette), Motion (from the animation data), Do's and Don'ts. Output Markdown only.` },
    ], 2500),
  ]);

  let suggestions = rules;
  let aiError: string | null = null;
  if (sug.status === "fulfilled") {
    const m = sug.value.match(/\[[\s\S]*\]/);
    try { if (m) suggestions = JSON.parse(m[0]); } catch { aiError = "AI returned bad JSON; showing rule-based suggestions"; }
  } else aiError = String(sug.reason?.message || sug.reason);
  const designMd = md.status === "fulfilled" && md.value.trim() ? md.value.replace(/^```(markdown|md)?\s*|\s*```$/g, "") : baseMd;
  if (md.status === "rejected" && !aiError) aiError = String(md.reason?.message || md.reason);

  return Response.json({ ai: true, model: MODEL, suggestions, designMd, rawDesignMd: baseMd, error: aiError });
}
