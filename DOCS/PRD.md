# PRD: Scrapper AI (Website Analyzer)

## 1. Summary
Scrapper AI takes a website URL and produces a dashboard that explains how the site is built and designed: colours, fonts, pages, screenshots, animations, security, SEO, tech stack, AI suggestions and a ready-to-use `design.md`.

## 2. Problem
Designers and developers who want to study, audit or recreate a website have to open DevTools page by page, copy colours by hand, guess fonts, and run separate tools for security and SEO. This is slow and scattered.

## 3. Users
| User | Need |
|---|---|
| Designer | Extract a site's palette, type scale, spacing and components into a design system |
| Front-end developer | Recreate a look quickly (CSS tokens, Tailwind config, component specs) |
| Agency / freelancer | Quick audit of a client site (security headers, SEO, broken links, speed) |
| Student / learner | See which libraries and animations a well-known site uses |

## 4. Goals
- One URL in, full analysis out, in about 1 minute for 5–6 pages.
- Every number comes from the live site (measured), not guessed.
- Security checks are **passive only** (no attacks, no probing).
- Works on Vercel (serverless) and locally.
- Free AI via NVIDIA NIM (not paid APIs).

## 5. Non-goals
- No active vulnerability scanning, fuzzing, login brute force or port scans.
- No crawling behind logins or paywalls.
- Not a full SEO suite (no keyword ranking, backlinks).
- Not a site cloner (we describe the design; we don't copy assets).

## 6. Features
| # | Feature | Status |
|---|---|---|
| F1 | URL input + page limit (1–30) | Done |
| F2 | Crawl: links + sitemap.xml, same site only | Done |
| F3 | Screenshot of every page (desktop) + homepage mobile | Done |
| F4 | Colour palette (by screen area), text/accent/border colours, CSS variables, contrast check | Done |
| F5 | Fonts: families, type scale, weights, loaded font files | Done |
| F6 | Per-page info: title, meta, headings, words, images, links, speed | Done |
| F7 | Animations: @keyframes, transitions, running animations, libraries (GSAP, Lottie, AOS, Three.js…) | Done |
| F8 | Passive security: headers, SSL, HTTP→HTTPS, mixed content, cookies, outdated libraries | Done |
| F9 | SEO checks + broken links (401/403/429 counted as "bot blocked", not broken) | Done |
| F10 | Tech stack + hosting detection | Done |
| F11 | AI suggestions (NVIDIA NIM) with rule-based fallback | Done |
| F12 | Detailed `design.md` (measured tokens + AI notes from screenshot) | Done |
| F13 | Dashboard: sidebar layout, light/dark theme, GSAP animations, responsive | Done |
| F14 | Downloads: `design.md`, `report.json`, screenshots | Done |
| F15 | Login (email + password) and per-user history | Built, needs Supabase project |
| F16 | Deploy to Vercel | Pending (user reviews locally first) |

## 7. Success metrics
- Analysis of 6 pages finishes in < 90 s.
- design.md contains measured values for colours, type, spacing, radius, shadows, components.
- 0 false "broken link" reports caused by bot protection.
- No request ever reaches a private/local network address.

## 8. Constraints
- Vercel function limits: each page is analysed in its own request (`/api/page`, max 60 s); AI route max 120 s.
- Headless Chrome on Vercel via `@sparticuz/chromium`.
- NVIDIA NIM free tier rate limits apply.
