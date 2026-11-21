# DESIGN.md: Scrapper AI's own UI

(This describes the Scrapper AI app itself, not the `design.md` it generates for other sites.)

## Brand
- **Name:** Scrapper AI: "Scrapper" in dark navy `#1e1b4b` (white in dark mode), "AI" in violet `#8b5cf6`.
- **Logo:** `public/logo-mark.svg`: stacked purple browser windows, magnifying glass with a sparkle, sparkle top-right. Also used as `src/app/icon.svg` (favicon).
- **Mood:** clean, friendly, light by default, soft purple glow.

## Colours
| Role | Light | Dark |
|---|---|---|
| Page background | `#f7f6fd` + soft purple radial waves | `#0d0d17` + waves |
| Card | `#ffffff`, border `slate-200/70` | `#16162a`, border `white/10` |
| Sidebar | `white/80` blur | `#12121f/90` |
| Primary gradient | `#6366f1` → `#8b5cf6` (indigo-500 → violet-500) | same |
| Text | `slate-800` | `slate-100` |
| Muted text | `slate-500` | `slate-400` |
| Success / warning / danger / info | emerald / amber / red / sky (100 bg, 700 text) | same hue, 500/15 bg, 300 text |

## Typography
- **Font:** Inter (`next/font/google`), mono: Geist Mono.
- Page title 20px bold, card titles 16px semibold, stats 30px bold, body 14px, captions 12px.

## Layout
- Fixed left sidebar 256px (`lg` and up); slides in from a hamburger on small screens.
- Sticky top bar: URL input, page limit, gradient **Analyze** button, theme toggle, bell, avatar / Log in.
- Content padding 16px mobile, 32px desktop; grid gap 20px.
- Overview grid: 4 stat cards → palette + fonts → pages + screenshots + security → animations + AI suggestions + design.md.

## Components
| Component | Spec |
|---|---|
| Card | radius 16px, 20px padding, soft indigo shadow `0 4px 24px -8px rgba(99,102,241,.15)` |
| Stat card | tinted gradient (violet/amber/green/blue/red), 40px icon tile, big number, status badge |
| Badge | pill, 12px, tone colours above |
| Swatch | rounded 12px colour tile + mono hex; click to copy |
| Primary button | gradient indigo→violet, white text, radius 12px, shadow `indigo-500/30` |
| Nav item | 14px medium; active = gradient pill with white text |
| Code preview | mono 12px, line numbers, headings in indigo |

## Motion (GSAP)
- Cards: slide up 28px + fade, 0.6 s, `power3.out`, stagger 0.06 s.
- Badges and swatches: scale 0.6 → 1, `back.out(2)`, stagger 0.02 s.
- Table rows and list items: slide in from left 12px.
- Numbers: count up from 0 over 1.3 s.
- All motion is off when the user prefers reduced motion (`gsap.matchMedia`).

## Themes
- Light is default; dark follows system on first visit, then the saved choice (`localStorage.theme`).
- Toggled by adding `.dark` on `<html>` (Tailwind `@custom-variant dark`).
