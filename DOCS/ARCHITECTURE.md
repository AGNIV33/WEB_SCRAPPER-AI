# Architecture

## Stack
| Layer | Tech |
|---|---|
| Framework | Next.js 16.4 (App Router, Turbopack), React 19.3, TypeScript |
| Styling | Tailwind CSS 4.3, Inter font, `lucide-react` icons |
| Animation (UI) | GSAP 3.15 + `@gsap/react` |
| Headless browser | `puppeteer-core` 25 + local Chrome (dev) / `@sparticuz/chromium` 153 (Vercel) |
| HTML parsing | `cheerio` |
| AI | NVIDIA NIM (OpenAI-compatible API) |
| Auth + history | Firebase Auth (email/password) + Cloud Firestore, `firebase` 13 |
| Hosting target | Vercel |

## High-level flow
```
Browser (App.tsx)
  │ 1. POST /api/discover {url, limit}        → list of page URLs
  │ 2. POST /api/site {url}  (in parallel)    → headers, SSL, robots, sitemap
  │ 3. POST /api/page {url}  ×N (2 at a time) → screenshot + design/SEO/tech data per page
  │      (new same-site links found by Chrome are added until the limit)
  │ 4. POST /api/links {links}                → broken links
  │ 5. buildSummary() in the browser          → one site summary
  │ 6. POST /api/ai {summary, screenshot}     → suggestions + design.md
  │ 7. (logged in) saveAnalysis() → Firestore → history
  ▼
Dashboard.tsx renders everything
```
The client orchestrates the crawl so each server call stays short and fits serverless time limits.

## Folder layout
```
src/
  app/
    page.tsx            client-only wrapper (dynamic import, ssr:false)
    layout.tsx          fonts, theme script, extension-attribute cleanup
    icon.svg            favicon
    api/
      discover/route.ts crawl: HTML links (BFS) + sitemap.xml
      page/route.ts     Puppeteer: screenshot, EXTRACT_SCRIPT, passive page security, favicon
      site/route.ts     headers, TLS cert, HTTP→HTTPS, robots/sitemap/security.txt, hosting
      links/route.ts    HEAD/GET status checks (max 150, 10 workers)
      media/route.ts    safe media file proxy (GET)
      ai/route.ts       NVIDIA NIM: suggestions JSON + design notes (vision)
  components/
    App.tsx             shell: sidebar, top bar, crawl orchestration, auth, save
    Dashboard.tsx       all dashboard views + GSAP animations
    AuthModal.tsx       login / sign-up
    HistoryView.tsx     saved analyses
    SettingsView.tsx    theme, glass mode, background, defaults
    SiteBackground.tsx  glass-mode background from the analysed site
    ExportMenu.tsx      export dropdown
    MediaView.tsx       media grid + downloads
  lib/
    browser.ts          launches Chrome (local) or sparticuz chromium (Vercel)
    url.ts              normalizeUrl, SSRF guard (assertPublicHost), safeFetch
    extractScript.ts    JS string run inside the page (colours, fonts, animations, tech, SEO, design tokens)
    report.ts           types, buildSummary(), ruleSuggestions(), contrast helpers
    designMd.ts         buildDesignMd(): measured design.md
    exporters.ts        PDF (jsPDF + autotable), Excel (exceljs), MD, HTML, CSV, JSON, ZIP (jszip)
    vulnDb.ts           hand-checked outdated-library rules
    firebase.ts         Firebase app, auth helpers (login, signup, logout, onUser); off if not configured
    history.ts          save / list / load / delete analyses
firestore.rules         Firestore security rules (paste into Firebase console)
DOCS/                   project documentation
```

## Key design decisions
| Decision | Why |
|---|---|
| One page per `/api/page` call | Keeps each serverless call under 60 s and memory low |
| Extraction script is a plain JS string | Bundler can't rewrite code that runs inside the target page |
| Client-side summary | Server stays stateless; no database needed to run |
| SSRF guard on every fetch + redirect hop | Deployed app must not be usable to reach private networks |
| Passive security only | Legal and ethical; no attack traffic |
| Thinking disabled for Nemotron | Reasoning used the whole token budget and returned empty answers |
| Measured design.md + AI notes inserted | AI can't change hex/px values; facts stay correct |
| Page rendered client-only | Avoids hydration errors from browser extensions |
| Firestore security rules | Users can only read/write their own history, enforced by Firebase |
| JSON strings in Firestore | Firestore rejects nested arrays and has a 1 MB doc limit |
| No screenshots in history | Keeps the database small and free-tier friendly; users re-crawl to see screenshots |

## Rate limiting
`src/lib/rateLimit.ts`, per visitor IP per hour: discover 15, page 200, site 30, links 30, ai 15. Whole app: 300 AI runs/day. Over the AI limit the app still answers with rule-based results. In-memory by default; Upstash Redis if configured.

## Security
- `assertPublicHost` blocks localhost, private, link-local and CGNAT ranges (override: `ALLOW_PRIVATE_HOSTS=1`, local only).
- Puppeteer aborts requests to literal private IPs.
- No secrets in the client. The Firebase web config is public by design; data is protected by Firestore rules.
- `NVIDIA_API_KEY` is server-only.

## Environment variables
| Name | Where | Required |
|---|---|---|
| `NVIDIA_API_KEY` | server | for AI (otherwise rule-based) |
| `NVIDIA_MODEL` | server | no (default `nvidia/nemotron-3.5-super-vl-120b-a12b`) |
| `NVIDIA_FALLBACK_MODEL` | server | no (default `nvidia/nemotron-3.5-lightning-30b-a3b`) |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | client | for login/history |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | client | for login/history |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | client | for login/history |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | client | for login/history |
| `RATE_LIMIT` | server | no (on by default on Vercel; `1` forces on locally, `0` off) |
| `AI_DAILY_LIMIT` | server | no (default 300 AI runs/day for the whole app) |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | server | no (exact shared limits) |
| `CHROME_PATH` | server, local | only if Chrome isn't auto-found |
| `ALLOW_PRIVATE_HOSTS` | server, local | testing only |

## Limits
| Route | maxDuration |
|---|---|
| `/api/discover` | 60 s |
| `/api/page` | 60 s |
| `/api/site` | 30 s |
| `/api/links` | 60 s |
| `/api/ai` | 120 s (main model 75 s, fallback 35 s) |
