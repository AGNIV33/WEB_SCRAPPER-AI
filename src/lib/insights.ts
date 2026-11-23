/* Types for the extra report sections (speed score, trust check, SEO fixes, competitors). Client-safe. */

export type StackItem = { name: string; category: string; version?: string | null; how?: string };

export type PsiRun = {
  strategy: "mobile" | "desktop";
  score: number | null; // 0-100
  metrics: { key: string; label: string; value: string; score: number | null }[];
  field: { key: string; label: string; value: string; rating: string }[] | null; // real-user data (CrUX), if Google has it
  opportunities: { title: string; saving: string }[];
  bytes: number | null;
};
export type SpeedResult = {
  error?: string; note?: string;
  url?: string;
  runs?: PsiRun[];
  carbon?: { grams: number; rating: string; green: boolean | null; host?: string | null; bytes: number; yearlyKg10k: number };
};

export type TrustCheck = { name: string; ok: boolean | null; weight: "high" | "medium" | "low"; detail: string };
export type TrustResult = {
  error?: string; note?: string;
  score?: number; verdict?: "safe" | "caution" | "risky";
  domain?: string;
  checks?: TrustCheck[];
  domainInfo?: { created: string | null; expires: string | null; registrar: string | null; ageDays: number | null } | null;
};

export type SeoFix = { page: string; issue: string; fix: string; code: string; lang: "html" | "xml" | "txt" | "json"; priority: "high" | "medium" | "low"; ai?: boolean };
export type SeoFixResult = { error?: string; note?: string; ai?: boolean; fixes?: SeoFix[] };

export type Competitor = { name: string; url: string; why: string; strengths?: string };
export type CompetitorResult = { error?: string; note?: string; summary?: string; competitors?: Competitor[]; sources?: { title: string; url: string }[]; model?: string };

export type Extras = { speed?: SpeedResult; trust?: TrustResult; seoFixes?: SeoFixResult; competitors?: CompetitorResult };
