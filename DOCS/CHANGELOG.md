# CHANGELOG

All dates 2026-11-21. Newest first. Commit hashes in brackets.

## Unreleased
- Login with email + password (Supabase) and per-user **History**: auto-save, reopen, search, delete. Private by RLS. Needs a Supabase project to switch on. [a17766e]
- Site favicon now fetched on the server and embedded, with a globe fallback (fixes broken icon on samsung.com). [3bbaca9]
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
