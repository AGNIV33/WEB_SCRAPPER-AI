# Scrapper AI: Website Analyzer

Paste any website link and get a full dashboard of its design, content, speed, security, SEO, trust and competitors in about a minute. It also writes a ready-to-use `design.md`, design tokens and React + Tailwind components, so you can rebuild a site's look or audit your own.

Built with Next.js, headless Chrome, a free NVIDIA AI model and free Google APIs (PageSpeed, Safe Browsing, Gemini). Crafted by **Agniv Sarkar**.

---

## Contents

- [Features](#features)
- [Plans and limits](#plans-and-limits)
- [Tech stack](#tech-stack)
- [Run locally](#run-locally)
- [Login and history (Firebase)](#login-and-history-firebase)
- [Deploy on Vercel](#deploy-on-vercel)
- [Environment variables](#environment-variables)
- [Free API keys (step by step)](#free-api-keys-step-by-step)
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
- **Tech stack detector:** 130+ technologies grouped by type (CMS, site builder, e-commerce, framework, back-end, hosting/CDN, web server, analytics, ads, marketing, chat, payments, security, cookie consent and more). Found from the live page, the page code, response headers and cookies, with versions where shown.

### Audit
- **Security (passive checks only):** security headers, SSL certificate, HTTP to HTTPS redirect, mixed content, cookies and outdated libraries.
- **SEO and links:** meta tags, headings, image alt text, sitemap and robots.txt, plus a broken link (404) check.
- **Core Web Vitals:** LCP, CLS, TBT and FCP for each page, with good / needs work / poor ratings.
- **Google speed score:** the official PageSpeed Insights score (0-100) for phone and computer, lab metrics, real-visitor data from Chrome (when Google has it) and the top "how to make it faster" tips.
- **Carbon per visit:** grams of CO₂ per page view and an A+ to F rating (Sustainable Web Design model v4 via CO2.js), green hosting check (Green Web Foundation) and a yearly estimate for 10,000 visits a month.
- **Trust check (scam check):** a trust score and a simple verdict (looks trustworthy, be careful, high risk) from Google Safe Browsing, HTTPS and the SSL certificate, domain age, renewal date and registrar (RDAP), and whether the site has contact, privacy, terms and about pages.
- **Accessibility audit:** powered by axe-core (WCAG 2.1 A/AA), score out of 100, issues grouped by impact, the exact elements, why each one fails (for example the real contrast ratio) and the element's HTML. **Get fix code with AI** writes a simple fix and corrected HTML/CSS for each issue, with a copy button.
- **AI suggestions:** practical fixes for design, content, code and UX.

### Ask AI
- **Chat with the report:** ask anything about the scan in plain words ("What should I fix first?", "Is this site safe?"). The AI (NVIDIA NIM, free) only uses the measured facts, so it does not make things up. Starter questions are shown. Needs sign-in.

### Grow
- **SEO fixes with ready-to-paste code:** every SEO problem per page with a simple fix and a copy button: `<title>`, meta description, H1, canonical, Open Graph / X tags, alt text, lang, viewport, noindex, plus a ready `sitemap.xml`, `robots.txt` and JSON-LD for the site. AI (NVIDIA) writes new titles and descriptions; all tags and URLs come from the measured data.
- **Competitor finder:** Google Gemini with live Google Search finds up to 6 real competitors, says why each one competes and what it does well, and lists the sources. One click analyses a competitor.

### Account
- **Sign in** with email and password or with Google. Your Google photo and name show in the top bar.
- **+ New button:** top of the sidebar (also in the small icon sidebar). Clears the current report and URL and opens the fresh start screen, like "New chat". Your last scan is already saved in History. If a scan is still running, it asks first, then stops it.
- **History:** every analysis is saved to your account (screenshots are not stored, so reopening a scan re-crawls to see them). Reopen or delete any of them.
- **Compare sites:** two analyses side by side (security, SEO, accessibility, Google speed, trust, load time, colours, fonts, tech) with a winner count. **AI verdict** says who wins and why, where each site is better, and what each should copy from the other.
- **What changed:** compare a new scan of a site with an earlier one and see what changed.
- **Share link:** create a read-only public link to a report.

### Admin dashboard and Contact us
- **Contact us:** every signed-in user can send feedback, report an issue or suggest an idea. They can follow the status (sent, seen, resolved) and read the admin's reply.
- **Admin dashboard** (only for the admin account, in the sidebar): overall usage, new users, scans and websites crawled per user, API calls per account, error rate overall and per user, time spent, email, free or paid plan, and graphs (scans, API calls, new users and errors per day, free vs paid, most scanned websites).
- **User management:** search and sort users, switch a user between the free and paid plan, remove or restore an account, export the user list as CSV.
- **Feedback inbox:** read messages, reply, mark as resolved or delete. New messages show a badge in the sidebar and a notification in the bell.

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
- **Sidebar** grouped into collapsible Design, Content, Audit, Grow and Account sections, and it can collapse to icons.
- **Settings:** theme, glass mode, site background and blur, site theme, animations and the default number of pages.
- **Mobile friendly:** every screen works on phones.

---

## Plans and limits

| | Guest (not signed in) | Free account | Pro (demo) |
|---|---|---|---|
| Pages per scan | 1 | As many as you choose | As many as you choose |
| Sites | Any | 10 different sites | Unlimited |
| Scans per site | Any | 5 | Unlimited |
| Locked screens | Design.md, code, media, audits, trust, SEO fixes, competitors, exports and more | None | None |
| History, compare, what changed, share | No | Yes | Yes |

The Pro plan uses a **demo checkout page**. No real payment is taken.

---

## Tech stack

- **Next.js 16** (App Router), **React**, **TypeScript**, **Tailwind CSS v4**
- **GSAP** for animations, **lucide-react** icons
- **puppeteer-core** with local Chrome, and **@sparticuz/chromium** on Vercel
- **axe-core** for accessibility checks
- **NVIDIA NIM** (free, OpenAI-compatible API) for the AI text
- **Google PageSpeed Insights**, **Google Safe Browsing** and **Gemini** (with Google Search grounding), all on free tiers
- **CO2.js** (Green Web Foundation) for the carbon estimate, **RDAP** for domain age
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
5. Admin dashboard: in the rules you paste, replace `ADMIN_EMAIL_HERE` with your admin email (it is checked by the database itself, so it is not visible in the app).
6. Add the four `NEXT_PUBLIC_FIREBASE_*` values (from **Project settings → Your apps → Web app**) to `.env.local` and to Vercel.

Each user can only read and write their own data. This is enforced by the Firestore rules and by checking the user's ID token on the server.

---

## Deploy on Vercel

1. Import this repository at https://vercel.com/new
2. Add the environment variables below (at least `NVIDIA_API_KEY`, plus the Firebase values if you want login, and `GOOGLE_API_KEY` + `GEMINI_API_KEY` for the speed score, trust check and competitors).
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
| `GOOGLE_API_KEY` | Recommended | Free Google Cloud API key with **PageSpeed Insights API** and **Safe Browsing API** turned on. Used for the speed score and the trust check |
| `PAGESPEED_API_KEY` / `SAFE_BROWSING_API_KEY` | No | Use these instead if you want separate keys |
| `GEMINI_API_KEY` | For competitors | Free key from Google AI Studio (aistudio.google.com → Get API key) |
| `GEMINI_MODEL` | No | Gemini model. Only free models with free Google Search are allowed (`gemini-2.5-flash` default, `gemini-2.5-flash-lite`); anything else is ignored |
| `GEMINI_DAILY_LIMIT` | No | Competitor searches per day for the whole app (default 400, max 450; Google gives 500 free) |
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

## Free API keys (step by step)

Every key is free. Without a key the app still works; that section just shows a short note.

**Google key (speed score + trust check)**
1. Open https://console.cloud.google.com and create a project (any name).
2. Go to **APIs & Services → Library**. Turn on **PageSpeed Insights API** and **Safe Browsing API**.
3. Go to **APIs & Services → Credentials → Create credentials → API key**. Copy it.
4. Optional but safer: **Edit API key → API restrictions → Restrict key** to those two APIs.
5. Add it as `GOOGLE_API_KEY`.

**Gemini key (competitor finder)**
1. Open https://aistudio.google.com and sign in.
2. Click **Get API key → Create API key**. Copy it.
3. Add it as `GEMINI_API_KEY`.

**Add keys to Vercel:** Vercel → your project → **Settings → Environment Variables** → add the name and value → Save → **Deployments → Redeploy**. For your PC, add the same lines to `.env.local` and restart `npm run dev`.

**Never get billed:**
- Do **not** add a billing account (credit card) to these Google projects. Without billing, Google can't charge you; when a free limit runs out, the app just shows a short "try again later" note.
- PageSpeed Insights and Safe Browsing have no paid plan, so they are free.
- Gemini: the app only uses `gemini-2.5-flash` / `gemini-2.5-flash-lite`, the models whose Google Search is free (500 a day). Newer and Pro models charge for Search, so the app refuses them. It also stops itself at 400 searches a day.
- NVIDIA NIM uses the free key from build.nvidia.com.

Note: Google's Safe Browsing API is free for non-commercial use. For a paid product, Google asks you to use the Web Risk API instead.

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
| `/api/speed` | Google PageSpeed score (phone + computer) and carbon per visit |
| `/api/trust` | Trust check: Safe Browsing, SSL, domain age (RDAP) and trust pages |
| `/api/seofix` | SEO fix list with ready-to-paste code (AI writes titles and descriptions) |
| `/api/competitors` | Gemini + Google Search: real competitors with sources |
| `/api/chat` | NVIDIA NIM: chat with the report, and the AI verdict on Compare sites |
| `/api/a11yfix` | NVIDIA NIM: fix code for accessibility issues |
| `/api/me` | Tells the app if the signed-in user is an admin |

The browser runs the scan step by step (discover, then pages two at a time, then links, then AI together with speed, trust, SEO fixes and competitors), so each server call stays short.

---

## Safety and limits

- **Passive security checks only.** The app reads public headers and pages. It never attacks or probes a site.
- **SSRF guard.** Private and local network addresses are blocked.
- **Rate limits per visitor** (per hour): 15 discovers, 200 page scans, 30 site checks, 30 link checks, 15 AI calls, 600 media downloads, 20 speed scores, 30 trust checks, 15 SEO fix lists and 10 competitor searches, plus a daily cap on AI calls.
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
