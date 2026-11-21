# WEB_SCRAPPER-AI

Paste a website URL and get a dashboard with:

- **Colours**: palette by screen area, text/accent/border colours, CSS variables, contrast check
- **Fonts**: families, type scale, weights, loaded font files
- **Pages**: crawl with a page limit, info for each page (title, headings, words, images, links)
- **Screenshots**: every page (desktop) + homepage on mobile
- **Animations**: CSS `@keyframes`, transitions, libraries (GSAP, Lottie, AOS, Three.js, Lenis, Swiper…)
- **Security (passive only)**: security headers, SSL certificate, HTTP→HTTPS, mixed content, cookies, outdated libraries
- **SEO & links**: meta tags, H1s, alt text, sitemap/robots, broken links
- **Tech stack**: frameworks, CMS, analytics, hosting
- **AI suggestions + design.md**: written by the free NVIDIA NIM API
- Light and dark theme

## Run locally

1. Install [Node.js](https://nodejs.org) 20+ and Google Chrome.
2. Copy `.env.example` to `.env.local` and paste your NVIDIA key (free at https://build.nvidia.com).
3. Run:

```bash
npm install
npm run dev
```

4. Open http://localhost:3000

Without a key the app still works and uses rule-based suggestions.

## Login and history (optional)

1. Create a free project on https://supabase.com
2. Run `supabase/migrations/001_history.sql` in the Supabase SQL editor.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to `.env.local` (and to Vercel).

Logged-in users get every analysis saved (without screenshots; re-crawl to see them) and can reopen or delete it from **History**. Each user can only see their own data (row level security).

## Deploy on Vercel

1. Import this repo on https://vercel.com/new
2. Add environment variable `NVIDIA_API_KEY` (and optionally `NVIDIA_MODEL`).
3. Deploy.

Notes:
- On Vercel the app uses `@sparticuz/chromium` (headless Chrome for serverless).
- Each page is scanned in its own function call, so it fits inside function time limits.
- Private / local network addresses are blocked on purpose.

## How it works

| API route | Job |
|---|---|
| `/api/discover` | Finds pages (links + sitemap) up to the limit |
| `/api/page` | Opens one page in headless Chrome: screenshot, colours, fonts, animations, tech, SEO |
| `/api/site` | Headers, SSL certificate, robots.txt, sitemap, security.txt |
| `/api/links` | Checks links for 404s |
| `/api/ai` | NVIDIA NIM: suggestions + design.md |
