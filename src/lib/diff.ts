/* Compares two analyses (two scans of one site, or two different sites). Pure functions. */
import type { PageResult, Summary } from "./report";
import type { Extras } from "./insights";
import { mergeA11y } from "./a11y";

export type Snapshot = { summary: Summary; pages: PageResult[]; meta?: { startedAt: Date; seconds: number } | null; label?: string; ai?: { extras?: Extras } | null };

const avg = (xs: (number | null | undefined)[]) => { const v = xs.filter((x): x is number => typeof x === "number"); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const pathOf = (u: string) => { try { const x = new URL(u); return x.pathname + x.search; } catch { return u; } };

export function metrics(s: Snapshot) {
  const ok = s.pages.filter((p) => !p.error);
  return {
    security: s.summary.security.score,
    seo: s.summary.seoScore,
    loadMs: s.summary.performance.avgLoadMs,
    pages: s.summary.pagesAnalyzed,
    brokenLinks: s.summary.brokenLinks.length,
    a11yScore: mergeA11y(ok)?.score ?? null,
    a11yIssues: ok.some((p) => p.a11y) ? ok.reduce((n, p) => n + (p.a11y?.violations.length || 0), 0) : null,
    speedMobile: s.ai?.extras?.speed?.runs?.find((r) => r.strategy === "mobile")?.score ?? null,
    trust: s.ai?.extras?.trust?.score ?? null,
    lcp: avg(ok.map((p) => p.vitals?.lcp)),
    cls: avg(ok.map((p) => p.vitals?.cls)),
    tbt: avg(ok.map((p) => p.vitals?.tbt)),
    words: avg(ok.map((p) => p.seo?.wordCount)),
    transferKB: avg(ok.map((p) => p.perf?.transferKB)),
  };
}

/** Which metrics are better when higher. */
export const HIGHER_IS_BETTER: Record<string, boolean> = { security: true, seo: true, a11yScore: true, speedMobile: true, trust: true, pages: true, words: true, loadMs: false, brokenLinks: false, a11yIssues: false, lcp: false, cls: false, tbt: false, transferKB: false };

const setDiff = (a: string[], b: string[]) => ({ added: b.filter((x) => !a.includes(x)), removed: a.filter((x) => !b.includes(x)), same: a.filter((x) => b.includes(x)) });

/** "What changed" between an older (a) and newer (b) scan of the same website. */
export function changes(a: Snapshot, b: Snapshot) {
  const ma = metrics(a), mb = metrics(b);
  const pagesA = a.pages.map((p) => pathOf(p.url)), pagesB = b.pages.map((p) => pathOf(p.url));
  const colA = [...a.summary.palette.backgrounds.map((c) => c.value), ...a.summary.palette.text.map((c) => c.value), ...a.summary.palette.accents];
  const colB = [...b.summary.palette.backgrounds.map((c) => c.value), ...b.summary.palette.text.map((c) => c.value), ...b.summary.palette.accents];
  const secA = new Map(a.summary.security.checks.map((c) => [c.name, c.ok])), secB = new Map(b.summary.security.checks.map((c) => [c.name, c.ok]));
  const security = [...new Set([...secA.keys(), ...secB.keys()])]
    .filter((k) => secA.get(k) !== secB.get(k))
    .map((k) => ({ name: k, before: secA.get(k), after: secB.get(k) }));
  const brokenA = a.summary.brokenLinks.map((x) => x.url), brokenB = b.summary.brokenLinks.map((x) => x.url);
  const pageEdits: { page: string; field: string; before: string; after: string }[] = [];
  for (const pb of b.pages) {
    const pa = a.pages.find((x) => pathOf(x.url) === pathOf(pb.url));
    if (!pa?.seo || !pb.seo) continue;
    if (pa.seo.title !== pb.seo.title) pageEdits.push({ page: pathOf(pb.url), field: "Title", before: pa.seo.title, after: pb.seo.title });
    if ((pa.seo.description || "") !== (pb.seo.description || "")) pageEdits.push({ page: pathOf(pb.url), field: "Description", before: pa.seo.description || "—", after: pb.seo.description || "—" });
    if (pa.seo.h1.join(" / ") !== pb.seo.h1.join(" / ")) pageEdits.push({ page: pathOf(pb.url), field: "H1", before: pa.seo.h1.join(" / ") || "—", after: pb.seo.h1.join(" / ") || "—" });
    if (pa.status !== pb.status) pageEdits.push({ page: pathOf(pb.url), field: "Status", before: String(pa.status), after: String(pb.status) });
  }
  return {
    metrics: Object.keys(ma).map((k) => ({ key: k, before: ma[k as keyof typeof ma], after: mb[k as keyof typeof mb] })),
    pages: setDiff(pagesA, pagesB),
    colors: setDiff([...new Set(colA)], [...new Set(colB)]),
    fonts: setDiff(a.summary.typography.families.map((f) => f.value), b.summary.typography.families.map((f) => f.value)),
    tech: setDiff(a.summary.tech.map((t) => t.name), b.summary.tech.map((t) => t.name)),
    animations: setDiff([...a.summary.animations.libraries.map((l) => l.name), ...a.summary.animations.keyframes], [...b.summary.animations.libraries.map((l) => l.name), ...b.summary.animations.keyframes]),
    security,
    brokenLinks: { added: brokenB.filter((x) => !brokenA.includes(x)), fixed: brokenA.filter((x) => !brokenB.includes(x)) },
    pageEdits,
  };
}
