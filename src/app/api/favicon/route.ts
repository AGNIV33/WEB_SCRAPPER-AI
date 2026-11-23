import { rateLimit } from "@/lib/rateLimit";
import { assertPublicHost, normalizeUrl, readText, safeFetch } from "@/lib/url";
import { fetchBestIcon, parseIconLinks, rankIcons } from "@/lib/favicon";

export const maxDuration = 20;

/** Quick logo lookup for a website (runs next to the page scan, so the logo shows up straight away). */
export async function POST(req: Request) {
  const limited = await rateLimit(req, "favicon");
  if (limited) return limited;
  try {
    const { url } = await req.json();
    const u = normalizeUrl(url);
    await assertPublicHost(u);
    let links: ReturnType<typeof parseIconLinks> = [];
    let base = u.toString();
    try {
      const { res, finalUrl } = await safeFetch(u.toString(), { timeoutMs: 7000 });
      base = finalUrl;
      links = parseIconLinks(await readText(res, 400_000), finalUrl);
    } catch { /* fall back to the standard icon locations */ }
    return Response.json({ icon: await fetchBestIcon(rankIcons(links, base)) });
  } catch {
    return Response.json({ icon: null });
  }
}
