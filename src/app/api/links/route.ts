import { rateLimit } from "@/lib/rateLimit";
import { safeFetch } from "@/lib/url";

export const maxDuration = 60;

// Checks link status codes (passive: HEAD, then GET if HEAD is refused).
export async function POST(req: Request) {
  const limited = await rateLimit(req, "links");
  if (limited) return limited;
  const { links } = (await req.json()) as { links: string[] };
  const list = [...new Set((links || []).filter((l) => /^https?:\/\//.test(l)))].slice(0, 150);
  const results: { url: string; status: number | null; error?: string }[] = [];
  const started = Date.now();
  let i = 0;
  const worker = async () => {
    while (i < list.length && Date.now() - started < 45000) {
      const url = list[i++];
      try {
        let r = await safeFetch(url, { method: "HEAD", timeoutMs: 8000 });
        if ([403, 405, 501].includes(r.res.status)) r = await safeFetch(url, { method: "GET", timeoutMs: 8000 });
        results.push({ url, status: r.res.status });
        r.res.body?.cancel().catch(() => {});
      } catch (e) {
        results.push({ url, status: null, error: (e as Error).message.slice(0, 80) });
      }
    }
  };
  await Promise.all(Array.from({ length: 10 }, worker));
  // 401/403/429 usually mean "bot blocked", not a broken link, so they are reported separately.
  const blockedCodes = [401, 403, 429];
  const broken = results.filter((r) => (r.status === null && !/private/i.test(r.error || "")) || (r.status !== null && r.status >= 400 && !blockedCodes.includes(r.status)));
  const blocked = results.filter((r) => r.status !== null && blockedCodes.includes(r.status)).length;
  return Response.json({ checked: results.length, total: list.length, broken, blocked });
}
