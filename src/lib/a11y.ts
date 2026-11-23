/* Accessibility results merged across pages (shared by the Accessibility page, Compare and Chat). */
import type { PageResult } from "./report";

export type A11yIssue = {
  id: string; impact: string | null; help: string; description: string; helpUrl: string; count: number;
  pages: { url: string; targets: string[]; html?: string[]; why?: string[] }[];
};

export type A11yFix = { fix: string; code: string };

export const IMPACTS = ["critical", "serious", "moderate", "minor"] as const;

/** Issues from all pages, worst first, plus a 0-100 score. Returns null when no page has accessibility data. */
export function mergeA11y(pages: PageResult[]) {
  const ok = pages.filter((p) => !p.error && p.a11y);
  if (!ok.length) return null;
  const map = new Map<string, A11yIssue>();
  ok.forEach((p) => p.a11y!.violations.forEach((v) => {
    const e = map.get(v.id) || { id: v.id, impact: v.impact, help: v.help, description: v.description, helpUrl: v.helpUrl, count: 0, pages: [] };
    e.count += v.count; e.pages.push({ url: p.url, targets: v.targets, html: v.html, why: v.why }); map.set(v.id, e);
  }));
  const order = IMPACTS as readonly string[];
  const issues = [...map.values()].sort((a, b) => order.indexOf(a.impact || "minor") - order.indexOf(b.impact || "minor") || b.count - a.count);
  const by = (i: string) => issues.filter((x) => (x.impact || "minor") === i).length;
  const score = Math.max(0, 100 - by("critical") * 15 - by("serious") * 8 - by("moderate") * 4 - by("minor") * 1);
  return { issues, score, by, pages: ok.length };
}
