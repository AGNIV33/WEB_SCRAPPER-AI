/**
 * POST /api/describe { url, alt?, page? } -> { name, description, size, type } or { note }
 * Short name + one-line description of one image, for the media viewer's info panel.
 * Only called when the image has no useful alt text. Free Gemini only (see lib/gemini.ts):
 * signed-in users, counted against the shared Gemini daily cap, results cached per image.
 */
import { gate } from "@/lib/gate";
import { dailyCap } from "@/lib/rateLimit";
import { parseJson } from "@/lib/nim";
import { GEMINI_DAILY, GEMINI_MODELS } from "@/lib/gemini";
import { safeFetch } from "@/lib/url";

export const maxDuration = 30;

const MAX_BYTES = 4 * 1024 * 1024;
const VISION = /^image\/(png|jpeg|webp|heic|heif)$/; // image types Gemini reads
type Out = { name?: string; description?: string; size?: number; type?: string; note?: string; error?: string };

// Small in-memory cache (per server instance) so the same image is never sent twice
const cache = new Map<string, Out>();
const remember = (k: string, v: Out) => { if (cache.size > 500) cache.delete(cache.keys().next().value!); cache.set(k, v); return v; };

async function readImage(url: string) {
  const { res } = await safeFetch(url, { timeoutMs: 12000, headers: { accept: "image/webp,image/png,image/jpeg,image/*;q=0.8" } });
  if (!res.ok) throw new Error(`The website returned ${res.status}`);
  const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (Number(res.headers.get("content-length") || 0) > MAX_BYTES) { res.body?.cancel().catch(() => {}); return { type, size: Number(res.headers.get("content-length")), data: null }; }
  const reader = res.body!.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_BYTES) { reader.cancel().catch(() => {}); return { type, size: total, data: null }; }
    chunks.push(value);
  }
  return { type, size: total, data: Buffer.concat(chunks) };
}

async function ask(model: string, prompt: string, mime: string, b64: string) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY || "" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ inline_data: { mime_type: mime, data: b64 } }, { text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 200, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } },
      }),
    });
    const j = (await r.json().catch(() => ({}))) as { candidates?: { content?: { parts?: { text?: string }[] } }[]; error?: { message?: string } };
    if (!r.ok) throw Object.assign(new Error(j.error?.message?.slice(0, 200) || `Gemini error ${r.status}`), { status: r.status });
    return (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
  } finally { clearTimeout(t); }
}

const clean = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");

export async function POST(req: Request) {
  const raw = (await req.json().catch(() => ({}))) as { url?: unknown; alt?: unknown; page?: unknown };
  const url = clean(raw.url, 2000), alt = clean(raw.alt, 200), page = clean(raw.page, 300);
  if (!/^https?:\/\//i.test(url)) return Response.json({ error: "Invalid URL" } satisfies Out, { status: 400 });
  if (!process.env.GEMINI_API_KEY) return Response.json({ note: "AI description needs GEMINI_API_KEY." } satisfies Out);
  const hit = cache.get(url);
  if (hit) return Response.json(hit);

  const g = await gate(req, "describe", { needLogin: true });
  if (g.stop) return g.stop; // { note: "Sign in…" } or { error }

  let img;
  try { img = await readImage(url); } catch (e) { return Response.json({ note: `Couldn't load the image: ${(e as Error).message}` } satisfies Out); }
  if (!img.data) return Response.json(remember(url, { size: img.size, type: img.type, note: "Image is too big for an AI description (over 4 MB)." }));
  if (!VISION.test(img.type)) return Response.json(remember(url, { size: img.size, type: img.type, note: "AI description works for JPG, PNG and WEBP images." }));
  if (!(await dailyCap("gemini", GEMINI_DAILY))) return Response.json({ size: img.size, type: img.type, note: "The free AI description has reached today's limit. It resets tomorrow." } satisfies Out);

  const prompt = `This image was found on the web page ${page || "(unknown)"}.${alt ? ` Its alt text is: "${alt}".` : ""}
Look at the image and reply with JSON only:
{"name":"a short clear name for the image, 2 to 5 words, Title Case, no file extension","description":"one plain sentence (max 25 words) saying what the image shows"}`;
  const b64 = img.data.toString("base64");
  let text = "", lastErr = "";
  for (const m of GEMINI_MODELS) {
    try { text = await ask(m, prompt, img.type, b64); lastErr = ""; break; } catch (e) {
      lastErr = (e as Error).message;
      if ((e as { status?: number }).status !== 404) break; // only try the next model if this one doesn't exist
    }
  }
  if (lastErr) return Response.json({ size: img.size, type: img.type, note: /quota|429|exhausted|rate/i.test(lastErr) ? "Gemini's free limit is used up for now. Try again later." : "AI description is not available right now." } satisfies Out);
  const p = parseJson<{ name?: string; description?: string }>(text);
  const name = clean(p?.name, 60), description = clean(p?.description, 240);
  if (!name && !description) return Response.json({ size: img.size, type: img.type, note: "AI couldn't describe this image." } satisfies Out);
  return Response.json(remember(url, { name, description, size: img.size, type: img.type }));
}
