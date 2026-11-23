/* Browser side: asks the server for the extra report sections, all at the same time. */
import type { CompetitorResult, Extras, SeoFixResult, SpeedResult, TrustResult } from "./insights";
import type { PageResult, SiteResult } from "./report";

type Post = <T>(path: string, body: unknown) => Promise<T>;

/** Trust signals found in the crawled pages' links. */
export function trustSignals(pages: PageResult[]) {
  const links = pages.flatMap((p) => p.links || []);
  const has = (re: RegExp) => links.some((l) => re.test(l.href) || re.test(l.text));
  return {
    privacy: has(/privacy/i),
    terms: has(/terms|conditions|refund|return[s-]?polic|shipping[- ]polic|legal/i),
    contact: has(/contact|support|help-?center|^mailto:|^tel:/i),
    about: has(/about|our[- ]story|who[- ]we[- ]are|company/i),
    passwordOnHttp: pages.some((p) => p.security?.passwordOnHttp),
  };
}

/**
 * Starts all four calls. `onPart` is called as each one finishes (so the screens fill in one by one).
 * Never throws: a failed part becomes { error }.
 */
export async function loadExtras(post: Post, root: string, pages: PageResult[], site: SiteResult | null, onPart: (p: Extras) => void): Promise<Extras> {
  const ok = pages.filter((p) => !p.error && p.seo);
  const home = ok[0];
  const out: Extras = {};
  const wrap = <K extends keyof Extras>(k: K, p: Promise<Extras[K]>) =>
    p.catch((e: Error) => ({ error: e.message }) as Extras[K]).then((v) => { out[k] = v; onPart({ [k]: v } as Extras); });

  await Promise.all([
    wrap("speed", post<SpeedResult>("/api/speed", { url: home?.finalUrl || root, bytes: (home?.perf?.transferKB || 0) * 1024 })),
    wrap("trust", post<TrustResult>("/api/trust", { url: home?.finalUrl || root, signals: trustSignals(pages) })),
    wrap("seoFixes", post<SeoFixResult>("/api/seofix", {
      hasSitemap: site?.hasSitemap ?? true, hasRobots: site ? !!site.robots : true, logo: home?.seo?.icons?.find((i) => /apple|192|512/.test(`${i.rel} ${i.sizes}`))?.href || null,
      pages: ok.slice(0, 25).map((p, i) => ({ url: p.finalUrl || p.url, ...p.seo, icons: undefined, h3: undefined, text: i === 0 ? p.textSample : undefined })),
    })),
    wrap("competitors", post<CompetitorResult>("/api/competitors", {
      url: home?.finalUrl || root, title: home?.seo?.title, description: home?.seo?.description,
      headings: [...(home?.seo?.h1 || []), ...(home?.seo?.h2 || [])], text: home?.textSample,
    })),
  ]);
  return out;
}
