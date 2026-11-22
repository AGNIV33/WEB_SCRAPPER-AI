# Scrapper AI: Website Analyzer

Paste any website link and get a full dashboard of its design, content, speed, security and SEO in about a minute. It also writes a ready-to-use `design.md`, design tokens and React + Tailwind components, so you can rebuild a site's look or audit your own.

Built with Next.js, headless Chrome and a free NVIDIA AI model. Crafted by **Agniv Sarkar**.

---

## Contents

- [Features](#features)
- [Plans and limits](#plans-and-limits)
- [Tech stack](#tech-stack)
- [Run locally](#run-locally)
- [Login and history (Firebase)](#login-and-history-firebase)
- [Deploy on Vercel](#deploy-on-vercel)
- [Environment variables](#environment-variables)
- [How it works](#how-it-works)
- [Safety and limits](#safety-and-limits)
- [Project docs](#project-docs)

---

## Features

### Scanning
- **Paste and go.** A big search box sits in the centre of the start page. Pasting a link starts the scan straight away with a short animation, and the box then slides into the top bar.
- **Count pages first.** The app finds the site's pages (links, sitemap, and a real browser for JavaScript-only sites), then asks how many to analyse, with a time estimate.
- **Live progress.** A progress bar, a "time left" countdown and a log of what is happening. You can stop a scan at any time.
- **Automatic retries.** Pages that fail or have no screenshot are retried once.

### Design
- **Colours:** palette by screen area, text, accent and border colours, CSS variables and contrast checks.
- **Fonts:** families, type scale, weights and the font files the site loads.
- **Animations:** CSS `@keyframes`, transitions and animation libraries (GSAP, Lottie, AOS, Three.js, Lenis, Swiper and more).
- **Design.md:** a detailed design system file written by AI: overview, colours, typography, spacing, components, motion, layout, a Tailwind config and base CSS.
- **Design tokens:** CSS variables, a Tailwind config, a shadcn/ui theme, W3C design tokens (DTCG) and a Figma Tokens Studio file.
- **React + Tailwind components:** starter components (button, card, navbar, input and more) built from the site's real colours and fonts.

### Content
- **Pages:** title, headings, word count, images and links for every page.
- **Screenshots:** desktop, tablet and mobile captures, with filters and a full-screen viewer.
- **Media downloader:** every image, GIF and video found on the site. Preview them, download one at a time or get everything as a ZIP.
- **Asset kit ZIP:** logo, favicon, images, colours and fonts in one download.
- **About this website:** an AI summary of what the site is and who it is for.
- **Tech stack:** frameworks, CMS, analytics and hosting.

### Audit
- **Security (passive checks only):** security headers, SSL certificate, HTTP to HTTPS redirect, mixed content, cookies and outdated libraries.
- **SEO and links:** meta tags, headings, image alt text, sitemap and robots.txt, plus a broken link (404) check.
- **Core Web Vitals:** LCP, CLS, TBT and FCP for each page, with good / needs work / poor ratings.
- **Accessibility audit:** powered by axe-core, grouped by impact, with the exact elements to fix.
- **AI suggestions:** practical fixes for design, content, code and UX.

### Account
- **Sign in** with email and password or with Google. Your Google photo and name show in the top bar.
- **History:** every analysis is saved to your account (screenshots are not stored, so reopening a scan re-crawls to see them). Reopen or delete any of them.
- **Compare sites:** two analyses side by side (scores, colours, fonts, speed, tech).
- **What changed:** compare a new scan of a site with an earlier one and see what changed.
- **Share link:** create a read-only public link to a report.

### Exports
- **PDF:** a formal, detailed report with screenshots.
- **Excel**, **Markdown**, **HTML**, **CSV**, **JSON**, and a **ZIP** of everything.
- Every export carries the "Crafted by Agniv Sarkar" signature.

### Look and feel
- **Light and dark mode** with a metal toggle and a glowing crescent. The glass mode and notification buttons match it.
- **Glass mode:** frosted see-through panels, with the analysed site shown blurred behind them.
- **Match the website's theme:** the dashboard takes on the analysed site's colours. Light or dark always stays your choice.
- **GSAP animations** across the dashboard (can be turned off in Settings).
- **Greeting:** a new friendly greeting with your name and an emoji each time you log in.
- **Quick tour:** a short guided tour for new sign-ups that shows once. Replay it any time from **Settings → Quick tour**.
- **Notifications:** a bell with an unread badge for finished scans, saves, failures and plan limits. It can also show a desktop alert when a scan finishes while you are on another tab.
- **Sidebar** grouped into collapsible Design, Content, Audit and Account sections, and it can collapse to icons.
- **Settings:** theme, glass mode, site background and blur, site theme, animations and the default number of pages.
- **Mobile friendly:** every screen works on phones.

---

## Plans and limits

| | Guest (not signed in) | Free account | Pro (demo) |
|---|---|---|---|
| Pages per scan | 1 | As many as you choose | As many as you choose |
| Sites | Any | 10 different sites | Unlimited |
| Scans per site | Any | 5 | Unlimited |
| Locked screens | Design.md, code, media, audits, exports and more | None | None |
| History, compare, what changed, share | No | Yes | Yes |

The Pro plan uses a **demo checkout page**. No real payment is taken.

---

## Tech stack

- **Next.js 16** (App Router), **React**, **TypeScript**, **Tailwind CSS v4**
- **GSAP** for animations, **lucide-react** icons
- **puppeteer-core** with local Chrome, and **@sparticuz/chromium** on Vercel
- **axe-core** for accessibility checks
- **NVIDIA NIM** (free, OpenAI-compatible API) for the AI text
- **Firebase Auth + Firestore** for login, history, usage limits and share links
- **jsPDF**, **ExcelJS** and **JSZip** for exports
- Optional **Upstash Redis** for rate limits shared across servers

---

## Run locally

1. Install [Node.js](https://nodejs.org) 20+ and Google Chrome.
2. Copy `.env.example` to `.env.local` and add your NVIDIA key (free at https://build.nvidia.com, under your profile → API Keys).
3. Install and start:

```bash
npm install
npm run dev
```

4. Open http://localhost:3000

`npm run dev` is development mode and is 3 to 5 times slower. For full speed on your own PC, run `npm run fast` (it builds, then starts the production server on http://localhost:3000).

Without an NVIDIA key the app still works and uses rule-based suggestions.

To try every feature without setting up accounts, set `NEXT_PUBLIC_DISABLE_AUTH=1` in `.env.local`. Login is then turned off and nothing is locked.

---

## Login and history (Firebase)

Login is optional. Without the Firebase values the app runs without accounts.

1. Create a free project at https://console.firebase.google.com
2. In **Authentication → Sign-in method**, enable **Email/Password** and **Google**.
3. In **Authentication → Settings → Authorized domains**, add your Vercel domain (for example `your-app.vercel.app`).
4. Create a **Firestore** database. Paste the contents of `firestore.rules` into **Firestore → Rules** and publish. Do this again whenever `firestore.rules` changes.
5. Add the four `NEXT_PUBLIC_FIREBASE_*` values (from **Project settings → Your apps → Web app**) to `.env.local` and to Vercel.

Each user can only read and write their own data. This is enforced by the Firestore rules and by checking the user's ID token on the server.

---

## Deploy on Vercel

1. Import this repository at https://vercel.com/new
2. Add the environment variables below (at least `NVIDIA_API_KEY`, plus the Firebase values if you want login).
3. Deploy. Every push to `main` deploys again automatically.

Notes:
- On Vercel the app uses `@sparticuz/chromium` (headless Chrome for serverless functions).
- Each page is scanned in its own function call, so scans fit inside the function time limits.
- Rate limiting turns on automatically on Vercel.

---

## Environment variables

| Variable | Required | What it does |
|---|---|---|
| `NVIDIA_API_KEY` | Recommended | Free key from build.nvidia.com for AI suggestions, the site summary and design.md |
| `NVIDIA_MODEL` | No | Change the AI model (any chat model on build.nvidia.com) |
| `NVIDIA_FALLBACK_MODEL` | No | Model to use if the main one fails |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | For login | Firebase web app config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | For login | Firebase web app config |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | For login | Firebase web app config |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | For login | Firebase web app config |
| `ADMIN_EMAILS` | No | Admin accounts (comma separated, verified emails only): every feature, no plan or rate limits, up to 200 pages per scan |
| `NEXT_PUBLIC_DISABLE_AUTH` | No | `1` turns login off and unlocks everything (for testing) |
| `RATE_LIMIT` | No | `1` turns rate limiting on locally (it is always on on Vercel) |
| `AI_DAILY_LIMIT` | No | Total AI calls per day across all users (default 300) |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | No | Exact rate limits shared across all servers |
| `CHROME_PATH` | No | Path to Chrome on your PC if it is not found automatically |

Never commit `.env.local`. It is already in `.gitignore`.

---

## How it works

| API route | Job |
|---|---|
| `/api/discover` | Finds the site's pages (links, sitemap and a real browser for JavaScript sites) and checks plan limits |
| `/api/page` | Opens one page in headless Chrome: screenshots (desktop, tablet, mobile), colours, fonts, animations, tech, SEO, Core Web Vitals, accessibility and media |
| `/api/site` | Security headers, SSL certificate, robots.txt, sitemap and security.txt |
| `/api/links` | Checks links for 404s |
| `/api/media` | Safely downloads images and videos for the media downloader |
| `/api/ai` | NVIDIA NIM: site summary, suggestions and design.md |

The browser runs the scan step by step (discover, then pages two at a time, then links, then AI), so each server call stays short.

---

## Safety and limits

- **Passive security checks only.** The app reads public headers and pages. It never attacks or probes a site.
- **SSRF guard.** Private and local network addresses are blocked.
- **Rate limits per visitor** (per hour): 15 discovers, 200 page scans, 30 site checks, 30 link checks, 15 AI calls and 600 media downloads, plus a daily cap on AI calls.
- Please only analyse sites you are allowed to, and respect each site's terms.

---

## Project docs

The [`DOCS`](DOCS) folder has the full project documentation:

| File | What it covers |
|---|---|
| [PRD.md](DOCS/PRD.md) | Product requirements |
| [ARCHITECTURE.md](DOCS/ARCHITECTURE.md) | How the app is built |
| [API_CONTRACT.md](DOCS/API_CONTRACT.md) | API routes, inputs and outputs |
| [DATA_MODEL.md](DOCS/DATA_MODEL.md) | Data types and Firestore structure |
| [DESIGN.md](DOCS/DESIGN.md) | The app's own design system |
| [AGENTS.md](DOCS/AGENTS.md) | Notes for AI coding agents |
| [TASKS.md](DOCS/TASKS.md) | Done and planned work |
| [CHANGELOG.md](DOCS/CHANGELOG.md) | Version history |

---

Crafted by **Agniv Sarkar**.
