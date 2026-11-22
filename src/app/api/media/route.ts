import { rateLimit } from "@/lib/rateLimit";
import { safeFetch } from "@/lib/url";

export const maxDuration = 30;

/** Vercel can't return more than ~4.5 MB from a function, so bigger files are opened from the original site instead. */
const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = /^(image|video|audio|font)\/|^application\/(octet-stream|json)|^binary\//;

/**
 * GET /api/media?url=...  Downloads one media file from a public website for the user
 * (avoids the browser's CORS block so files can go into a ZIP). Private/local addresses are blocked.
 */
export async function GET(req: Request) {
  const limited = await rateLimit(req, "media");
  if (limited) return limited;
  const url = new URL(req.url).searchParams.get("url") || "";
  if (!/^https?:\/\//i.test(url)) return Response.json({ error: "Invalid URL" }, { status: 400 });
  try {
    const { res } = await safeFetch(url, { timeoutMs: 15000, headers: { accept: "image/*,video/*,audio/*,*/*;q=0.5" } });
    if (!res.ok) return Response.json({ error: `Site returned ${res.status}` }, { status: 502 });
    const type = (res.headers.get("content-type") || "application/octet-stream").split(";")[0].trim();
    if (!ALLOWED.test(type)) return Response.json({ error: `Not a media file (${type})` }, { status: 415 });
    const len = Number(res.headers.get("content-length") || 0);
    if (len > MAX_BYTES) { res.body?.cancel().catch(() => {}); return Response.json({ error: "too-large", size: len }, { status: 413 }); }

    // Read with a hard size cap (content-length can be missing or wrong)
    const reader = res.body!.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_BYTES) { reader.cancel().catch(() => {}); return Response.json({ error: "too-large", size: total }, { status: 413 }); }
      chunks.push(value);
    }
    const body = new Uint8Array(total);
    let o = 0;
    for (const c of chunks) { body.set(c, o); o += c.length; }
    return new Response(body, { headers: { "content-type": type, "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff" } });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
