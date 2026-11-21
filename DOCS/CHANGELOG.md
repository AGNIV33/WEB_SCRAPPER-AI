# CHANGELOG

All dates 2026-11-21. Newest first. Commit hashes in brackets.

## Unreleased
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
