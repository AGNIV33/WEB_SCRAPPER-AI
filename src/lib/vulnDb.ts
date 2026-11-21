// Small, hand-checked list of well-known issues in front-end libraries.
// It only flags versions; always confirm before acting.
export type LibIssue = { library: string; version: string; issue: string; fix: string; severity: "high" | "medium" | "low" };

const cmp = (a: string, b: string) => {
  const pa = a.split(".").map((n) => parseInt(n) || 0);
  const pb = b.split(".").map((n) => parseInt(n) || 0);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
};
const lt = (v: string, x: string) => cmp(v, x) < 0;

export function checkLibrary(nameRaw: string, version: string | null | undefined): LibIssue | null {
  if (!version) return null;
  const name = nameRaw.toLowerCase();
  const v = version.replace(/^v/, "");
  if (name === "jquery" && lt(v, "3.5.0"))
    return { library: "jQuery", version: v, severity: "medium", issue: "XSS bugs in HTML handling (CVE-2020-11022, CVE-2020-11023)", fix: "Upgrade to jQuery 3.5.0 or newer" };
  if ((name === "jquery ui" || name === "jquery-ui") && lt(v, "1.13.2"))
    return { library: "jQuery UI", version: v, severity: "medium", issue: "XSS in checkboxradio and other widgets (CVE-2022-31160 and older)", fix: "Upgrade to jQuery UI 1.13.2 or newer" };
  if (name === "bootstrap") {
    if ((v.startsWith("3.") && lt(v, "3.4.1")) || (v.startsWith("4.") && lt(v, "4.3.1")) || lt(v, "3.0.0"))
      return { library: "Bootstrap", version: v, severity: "medium", issue: "XSS in tooltip/popover data-template (CVE-2019-8331)", fix: "Upgrade to Bootstrap 3.4.1 / 4.3.1 or newer (5.x recommended)" };
    if (v.startsWith("3.") || v.startsWith("4."))
      return { library: "Bootstrap", version: v, severity: "low", issue: "Bootstrap 3 and 4 are end-of-life (no more security fixes)", fix: "Plan a move to Bootstrap 5" };
  }
  if (name === "lodash" && lt(v, "4.17.21"))
    return { library: "Lodash", version: v, severity: "medium", issue: "Command injection / prototype pollution (CVE-2021-23337, CVE-2020-8203)", fix: "Upgrade to Lodash 4.17.21 or newer" };
  if (name === "moment" || name === "moment.js") {
    if (lt(v, "2.29.4"))
      return { library: "Moment.js", version: v, severity: "medium", issue: "ReDoS when parsing user input (CVE-2022-31129)", fix: "Upgrade to 2.29.4+ or switch to date-fns / Day.js" };
    return { library: "Moment.js", version: v, severity: "low", issue: "Moment.js is in maintenance mode and is heavy", fix: "Consider date-fns, Day.js or Luxon" };
  }
  if (name === "handlebars" && lt(v, "4.7.7"))
    return { library: "Handlebars", version: v, severity: "high", issue: "Remote code execution via templates (CVE-2021-23369)", fix: "Upgrade to Handlebars 4.7.7 or newer" };
  if (name === "angularjs" || (name === "angular" && v.startsWith("1.")))
    return { library: "AngularJS", version: v, severity: "high", issue: "AngularJS reached end-of-life on 31 Dec 2021 (no security fixes)", fix: "Migrate to a supported framework" };
  if (name === "vue" && v.startsWith("2."))
    return { library: "Vue", version: v, severity: "low", issue: "Vue 2 reached end-of-life on 31 Dec 2023", fix: "Upgrade to Vue 3" };
  return null;
}
