/* A short, plain summary of one report, sent to the AI for "Chat with report" and the Compare verdict. */
import type { PageResult, Summary } from "./report";
import type { Extras } from "./insights";
import { mergeA11y } from "./a11y";

type AiLike = { about?: { summary?: string; whatItIs?: string; audience?: string; offerings?: string[] }; suggestions?: { priority: string; title: string }[]; extras?: Extras } | null | undefined;
export type ReportInput = { summary: Summary; pages: PageResult[]; ai?: AiLike; extras?: Extras | null };

const host = (u?: string) => { try { return new URL(u || "").hostname; } catch { return u || ""; } };
const path = (u: string) => { try { const x = new URL(u); return x.pathname + x.search; } catch { return u; } };

/** Only measured facts. Kept small (about 10 KB) so the free AI answers fast. */
export function reportFacts({ summary: s, pages, ai, extras }: ReportInput) {
  const ok = pages.filter((p) => !p.error);
  const ex = extras || ai?.extras || {};
  const a11y = mergeA11y(pages);
  const psi = (k: "mobile" | "desktop") => ex.speed?.runs?.find((r) => r.strategy === k);
  const vit = (k: "lcp" | "cls" | "tbt") => { const v = ok.map((p) => p.vitals?.[k]).filter((x): x is number => typeof x === "number"); return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 1000) / 1000 : null; };
  return {
    site: host(s.url), url: s.url,
    about: ai?.about ? { summary: ai.about.summary, whatItIs: ai.about.whatItIs, audience: ai.about.audience, offerings: ai.about.offerings?.slice(0, 6) } : undefined,
    pages: { analysed: s.pagesAnalyzed, failed: s.pagesFailed, list: ok.slice(0, 20).map((p) => ({ path: path(p.url), title: p.seo?.title, words: p.seo?.wordCount, loadMs: p.loadMs })) },
    seo: {
      score: s.seoScore, hasSitemap: s.seo.hasSitemap, hasRobots: s.seo.hasRobots,
      issues: s.seo.pages.filter((p) => p.issues.length).slice(0, 12).map((p) => ({ page: path(p.url), issues: p.issues.slice(0, 5) })),
    },
    security: {
      score: s.security.score,
      failedChecks: s.security.checks.filter((c) => !c.ok).map((c) => ({ name: c.name, severity: c.severity, detail: c.detail.slice(0, 160) })),
      outdatedLibraries: s.security.libIssues.map((i) => `${i.library} ${i.version}: ${i.issue}`).slice(0, 6),
      mixedContent: s.security.mixedContent.length,
    },
    speed: {
      avgLoadMs: s.performance.avgLoadMs, lcpMs: vit("lcp"), cls: vit("cls"), tbtMs: vit("tbt"),
      googleMobileScore: psi("mobile")?.score ?? null, googleDesktopScore: psi("desktop")?.score ?? null,
      googleTips: psi("mobile")?.opportunities.slice(0, 5).map((o) => `${o.title} (${o.saving})`),
      carbonGramsPerVisit: ex.speed?.carbon?.grams ?? null, greenHost: ex.speed?.carbon?.green ?? null,
    },
    accessibility: a11y ? { score: a11y.score, issues: a11y.issues.slice(0, 12).map((i) => ({ problem: i.help, impact: i.impact, elements: i.count })) } : "not measured",
    brokenLinks: { count: s.brokenLinks.length, examples: s.brokenLinks.slice(0, 5).map((b) => `${b.url} (${b.status ?? b.error})`) },
    trust: ex.trust?.score != null ? { score: ex.trust.score, verdict: ex.trust.verdict, domainAgeDays: ex.trust.domainInfo?.ageDays ?? null, problems: ex.trust.checks?.filter((c) => !c.ok === false).map((c) => c.name).slice(0, 6) } : undefined,
    competitors: ex.competitors?.competitors?.slice(0, 6).map((c) => `${c.name} (${host(c.url)})`),
    design: {
      colors: [...s.palette.backgrounds.slice(0, 4).map((c) => c.value), ...s.palette.accents.slice(0, 3), ...s.palette.text.slice(0, 2).map((c) => c.value)],
      fonts: s.typography.families.slice(0, 4).map((f) => f.value),
      animations: [...s.animations.libraries.map((l) => l.name), ...s.animations.libraries.length ? [] : s.animations.keyframes.slice(0, 4)].slice(0, 8),
    },
    tech: s.tech.map((t) => t.name).slice(0, 20), hosting: s.hosting,
    aiSuggestions: ai?.suggestions?.slice(0, 8).map((x) => `[${x.priority}] ${x.title}`),
  };
}
