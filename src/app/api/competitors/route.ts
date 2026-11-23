/**
 * Competitor finder: Google Gemini (free API key) with Google Search grounding, so the
 * competitors are real, current websites found on the web (not guessed).
 * Key: GEMINI_API_KEY. Model: GEMINI_MODEL (default gemini-flash-latest, falls back to gemini-2.5-flash).
 */
import { gate } from "@/lib/gate";
import { parseJson } from "@/lib/nim";
import type { Competitor, CompetitorResult } from "@/lib/insights";

export const maxDuration = 60;

const MODELS = [...new Set([process.env.GEMINI_MODEL || "gemini-flash-latest", "gemini-2.5-flash"])];

type GemResp = {
  candidates?: { content?: { parts?: { text?: string }[] }; groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] } }[];
  error?: { message?: string; status?: string };
};

async function ask(model: string, prompt: string): Promise<GemResp> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 50000);
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY || "" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0.2 } }),
    });
    const j = (await r.json().catch(() => ({}))) as GemResp;
    if (!r.ok) throw Object.assign(new Error(j.error?.message?.slice(0, 200) || `Gemini error ${r.status}`), { status: r.status });
    return j;
  } finally { clearTimeout(t); }
}

const hostOf = (u: string) => { try { return new URL(/^https?:/.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } };

export async function POST(req: Request) {
  if (!process.env.GEMINI_API_KEY) return Response.json({ note: "Add GEMINI_API_KEY (free from Google AI Studio) to find competitors." } satisfies CompetitorResult);
  const g = await gate(req, "competitors", { needLogin: true });
  if (g.stop) return g.stop;
  const { url, title, description, headings = [], text = "" } = (await req.json()) as { url: string; title?: string; description?: string | null; headings?: string[]; text?: string };
  const self = hostOf(url);
  if (!self) return Response.json({ error: "Bad URL" }, { status: 400 });

  const prompt = `Find the main competitors of this website using Google Search.
Website: ${url}
Title: ${title || ""}
Description: ${description || ""}
Headings: ${headings.slice(0, 12).join(" | ")}
Home page text: ${text.slice(0, 1200)}

Steps: 1) work out what this business/site offers and its market (country if clear). 2) search for real companies or websites that offer the same thing to the same audience. 3) pick the 6 closest direct competitors. Do not include ${self} itself, marketplaces or review sites unless the site is one of those.

Reply with JSON only, no other text:
{"summary":"one sentence: what the site does and its market","competitors":[{"name":"Brand name","url":"https://their-homepage","why":"one short sentence: why it competes","strengths":"one short sentence: what it does well"}]}`;

  let resp: GemResp | null = null, used = "", lastErr = "";
  for (const m of MODELS) {
    try { resp = await ask(m, prompt); used = m; break; } catch (e) {
      lastErr = (e as Error).message;
      if ((e as { status?: number }).status !== 404) break; // only try the next model if this one doesn't exist
    }
  }
  if (!resp) return Response.json({ error: /quota|429|exhausted/i.test(lastErr) ? "Gemini's free daily limit is used up. Try again tomorrow." : `Gemini: ${lastErr}` } satisfies CompetitorResult);

  const cand = resp.candidates?.[0];
  const textOut = (cand?.content?.parts || []).map((p) => p.text || "").join("");
  const parsed = parseJson<{ summary?: string; competitors?: Competitor[] }>(textOut);
  if (!parsed?.competitors) return Response.json({ error: "Gemini's answer could not be read. Please try again." } satisfies CompetitorResult);

  const seen = new Set<string>([self]);
  const competitors = parsed.competitors
    .filter((c) => c && c.name && c.url)
    .map((c) => ({ ...c, url: /^https?:\/\//.test(c.url) ? c.url : `https://${c.url}` }))
    .filter((c) => { const h = hostOf(c.url); if (!h || seen.has(h) || h.endsWith(`.${self}`)) return false; seen.add(h); return true; })
    .slice(0, 8);
  const sources = (cand?.groundingMetadata?.groundingChunks || []).map((c) => ({ title: c.web?.title || "", url: c.web?.uri || "" })).filter((s) => s.url).slice(0, 10);
  return Response.json({ summary: parsed.summary, competitors, sources, model: used } satisfies CompetitorResult);
}
