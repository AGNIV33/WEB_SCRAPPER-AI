# CHANGELOG

Dates 2026-11-21 unless noted. Newest first. Commit hashes in brackets.

## Unreleased
- **Smart page picker (Nov 23)**: after counting, the app ranks pages by importance (menu/header links, how many pages link to it, click depth, sitemap priority/lastmod; boosts pricing, about, product, features, contact, services, docs…; demotes login, cart, tag, search, pagination, query links and other-language copies). New picker with tick boxes, search, section filters, select all/none and "Top N" smart picks. Near-duplicate pages with the same layout (e.g. `/product/*`, 6+ pages) are grouped: 2 samples kept, "N similar pages skipped" can be opened to tick more. The server checks the picked pages (same site, plan limit) and the scan pass only allows those pages. No AI used.
- **+ New button (Nov 23)**: sidebar button above Overview clears the report and returns to the start screen; asks before stopping a running scan.
- **Chat, compare and accessibility upgrades (Nov 23)**:
  - **Ask AI** (new sidebar item under Overview, `/api/chat`): chat with the report. The browser sends a short fact sheet (`lib/reportFacts.ts`: SEO, security, speed, Google score, carbon, accessibility, trust, broken links, design, tech, competitors) and NIM answers only from it. Starter questions, clear chat, simple markdown answers (`MiniMarkdown.tsx`).
  - **Compare sites**: new rows for accessibility score, Google speed (phone) and trust score (also in What changed); **AI verdict** button (winner, where each is better, what to copy).
  - **Accessibility**: each issue now shows why it fails (axe `failureSummary`, e.g. contrast ratio) and the element HTML; **Get fix code with AI** (`/api/a11yfix`) writes a fix + corrected HTML/CSS with copy buttons. Shared merge + score in `lib/a11y.ts`. New scans only (older scans have no HTML/why).
  - Rate limits: chat 40/h, a11yfix 15/h per visitor; both count toward the daily AI cap and need sign-in.
- **Free-only Gemini**: competitor finder uses only `gemini-2.5-flash` / `gemini-2.5-flash-lite` (free Google Search grounding, 500/day); other models (Gemini 3, Pro) are refused; app-wide daily cap `GEMINI_DAILY_LIMIT` (default 400); quota errors show a friendly note and are never retried. README explains how to never be billed.
- **Five new analysis features (Nov 23)**:
  - **Tech stack detector**: `/api/site` now reads the home page HTML, headers and cookies and matches 130+ technologies (CMS, site builders, e-commerce, frameworks, back-end, hosting/CDN, web servers, analytics, ads, marketing, chat, payments, security, cookie consent, video, maps…), merged with the live-page check and grouped by category on the Tech Stack screen.
  - **SEO fixes** (new Grow → SEO fixes screen, `/api/seofix`): per-page issues with ready-to-paste code and copy buttons, plus sitemap.xml, robots.txt and JSON-LD; NVIDIA NIM writes new titles and descriptions.
  - **Google speed score + carbon** (Speed screen, `/api/speed`): PageSpeed Insights for phone and computer, real-visitor data, top tips; CO₂ per visit with A+–F rating (CO2.js, SWD v4) and green hosting check.
  - **Trust check** (Audit → Trust check, `/api/trust`): Safe Browsing, HTTPS/SSL, domain age and renewal (RDAP), contact/privacy/terms/about pages → score and verdict.
  - **Competitor finder** (Grow → Competitors, `/api/competitors`): Gemini with Google Search finds real competitors with sources; "Analyze this site" button.
  - The four extra results run in parallel with the AI step and are saved with the analysis. New env vars: `GOOGLE_API_KEY`, `GEMINI_API_KEY` (optional `GEMINI_MODEL`, `PAGESPEED_API_KEY`, `SAFE_BROWSING_API_KEY`).
  - Shared helpers: `lib/nim.ts` (NIM chat), `lib/gate.ts` (sign-in + limits), `lib/cert.ts` (TLS cert).
- **Admin dashboard and Contact us (Nov 22-23)**: admin-only dashboard (usage, users, plans, errors, graphs, feedback inbox with replies), Contact us page for signed-in users, admin check via `/api/me` and verified `ADMIN_EMAILS`, Verify email buttons in the account menu.
- **Mobile responsive**: two-row phone header (logo + icons, then full-width URL + Analyze), icon-only login on phones, cards can no longer stretch the page sideways (min-w-0), About card badge wraps. Checked every view at 390px: no horizontal scrolling.
- `NEXT_PUBLIC_DISABLE_AUTH=1` switches accounts off for local testing.
- **Round 2 features**: Google sign-in; **guest mode** (no account: 1 page, colours/fonts/animations/tech only, other pages locked; server checks the Firebase ID token with jose); **free plan limits** (10 websites x 5 scans, usage in users/{uid}/meta/usage, counts can only go up via rules, server re-checks before each scan, 402 -> Plans page); **Plans page** with demo checkout (no payment taken); **What changed?** (compare two scans of a site, scores, pages, colours, fonts, tech, security, broken links, page text); **Compare websites** side by side; **Share link** (public read-only /share/[id], Firestore shares collection). firestore.rules updated (must be re-published).
- **Round 1 features**: tablet (768) + mobile (390) screenshots for every page with device filter; **Speed** page (LCP, CLS, TBT as INP stand-in, FCP; lab measurement); **Accessibility** page (axe-core WCAG 2.1 A/AA, score, issues by impact with fix links); **Tokens & Code** page (Figma Tokens Studio JSON, W3C DTCG JSON, Tailwind config, shadcn theme, CSS variables, React+Tailwind Button/Card/Navbar/Input/Example); **Asset kit ZIP** (logo, favicon, SVG icons, images).
- **Real media extraction**: every image/GIF/video the browser downloads is captured (carousel slides, hero videos, lazy images), labelled by real file type, with sizes; video thumbnails from the video itself. New GIF filter.
- **Full-screen viewer** (Lightbox) with Download for every screenshot and media file; Screenshots page has View/Download per item + ZIP of all.
- **Collapsible sidebar** (button next to the logo; remembered).
- **About this website** expandable card on Overview (AI: what it is, audience, offerings, sections, tone, main action; fallback from page titles).
- **design.md**: quick brief, homepage anatomy, component specs with states, responsive rules, accessibility checklist, ready-to-paste AI prompt, starter HTML + CSS.
- **PDF redesigned**: formal navy layout, cover with key figures, executive summary, running header/footer, flowing sections (no forced page breaks), screenshots cropped to fit the space, real tables in the design.md appendix, signed sign-off.
- **Creator signature** (Agniv Sarkar) in the sidebar, PDF, HTML, Markdown, Excel and design.md.
- **Media downloader**: every scan collects images (largest srcset), picture sources, CSS backgrounds, inline SVGs, videos, audio, icons and og:image. New **Media** page: filter by type, hide tiny images, preview, download one file or a ZIP of the selection. Files go through `/api/media` (SSRF-safe proxy, 4 MB limit, rate limited); bigger files open from the original site.
- **Rate limiting** on all API routes (per IP per hour + 300 AI runs/day for the whole app). On automatically on Vercel; optional Upstash Redis. Discover route now also bundles Chromium on Vercel (needed for JavaScript-only sites).
- **Match the website's theme** (Settings, on by default): the dashboard re-colours itself with the analysed site's accent colours (overrides Tailwind's indigo/violet CSS variables), uses the site's background tint, and follows its light/dark look until you press the theme button. Text stays readable.
- Glass background is now ONE sharp landing-page screenshot (homepage top), blurred once on a canvas (default 6px), not live. Panels are more opaque so text is always readable. Header and sidebar no longer use backdrop blur outside glass mode (smoother scrolling).
- Fix: JavaScript-only sites (e.g. rockstargames.com) were counted as 1 page. If plain HTML finds < 10 pages, discovery now opens up to 8 pages in headless Chrome and reads the rendered links (rockstargames.com: 1 -> 207+ pages).
- **Count first, then choose**: the app counts the site's pages (links + sitemap, up to 500), then asks how many to analyse (max 50) with an estimated time. Progress bar shows page X of N, % and time left.
- **Every page gets a screenshot**: screenshot is taken before data extraction, falls back to a viewport shot, is returned even if extraction fails, and failed pages are retried once automatically.
- **Export menu**: PDF (detailed: cover, scores, suggestions, palette swatches, typography, design tokens, buttons, every page with details + full-page screenshots + mobile view, animations, security, SEO, broken links, tech, design.md appendix, page numbers), Excel (9 sheets, colour swatch cells), Markdown report, standalone HTML with screenshots, design.md, CSV, JSON, screenshots ZIP. All generated in the browser (`src/lib/exporters.ts`).
- **Settings page**: Light / Dark / System theme, Glass mode, glass background options (site background on/off, blur, strength), default pages, animations on/off. Saved in `localStorage.settings`.
- **Glass mode** (glassmorphism): frosted panels; background shows the analysed site's screenshots + colour palette (falls back to a gradient mesh).
- Stat tiles: score rings, per-page bar chart, load-time sparkline, progress bars, glow + hover. [2155600]
- **Switched login + history from Supabase to Firebase** (Firebase Auth email/password + Firestore at `users/{uid}/analyses`, rules in `firestore.rules`). Supabase code and migration removed.
- Login with email + password (Supabase) and per-user **History**: auto-save, reopen, search, delete. Private by RLS. Needs a Supabase project to switch on. [a17766e]
- Site favicon now fetched on the server and embedded, with a globe fallback (fixes broken icon on samsung.com). [3bbaca9]
- History no longer saves screenshots (only design.md, colours, fonts, pages, scores…). Reopened items show a **Re-crawl to see screenshots** button. No storage bucket needed.
- DOCS folder: PRD, Architecture, Agents, Design, Tasks, Data model, API contract, Changelog.

## 0.4: Detailed design.md
- Extract spacing, radius, shadows, gradients, line heights, letter spacing, max-widths, breakpoints, z-index, motion durations/easings, text styles (h1–h6, p, a…), buttons, cards, inputs, header, footer, icons. [ea669f8]
- design.md rebuilt: 13 sections + CSS tokens + Tailwind config.
- AI (vision) adds style, layout, component, colour/type rules and page recipes from the homepage screenshot.
- Fix: AI returned empty answers (Nemotron "thinking" used the token budget). Thinking disabled; empty answers now raise an error.
- Better accent / muted / link colour picks (contrast-aware).

## 0.3: AI model
- Default model `nvidia/nemotron-3.5-super-vl-120b-a12b`, fallback `nvidia/nemotron-3.5-lightning-30b-a3b`. [8914dcd]
- Timeout split so fallback fits the function limit. [f2f274c]

## 0.2: Fixes and branding
- Logo in sidebar + favicon. [b8a6f31]
- Fix mojibake characters (`Â·`) caused by PowerShell encoding. [782e77a]
- Client-only rendering + attribute cleanup to stop hydration warnings from browser extensions. [782e77a, 7f7fec6]
- Link checker: 401/403/429 shown as "bot blocked", not broken.
- Summary uses crawl order (homepage first).

## 0.1: First version [f3c3d7f]
- Next.js 16 app; crawler with page limit; desktop + mobile screenshots.
- Colours, fonts, animations (CSS + GSAP etc.), tech stack, SEO, broken links.
- Passive security: headers, SSL, HTTP→HTTPS, mixed content, cookies, outdated libraries.
- NVIDIA NIM suggestions + auto design.md.
- Dashboard to mockup: sidebar, stat cards, light/dark theme, GSAP animations.
- SSRF protection on all server fetches.
