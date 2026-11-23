# API CONTRACT

All routes are `POST` (except `/api/media` and `/api/me`), JSON in and JSON out, under `/api`. The browser sends the Firebase ID token as `Authorization: Bearer <token>` when signed in. Guests get reduced results (no AI, no extra sections) when login is set up. Types are in `src/lib/report.ts` and `src/lib/insights.ts`.

Errors: routes return `{ "error": "message" }`. `/api/discover` and `/api/site` use status 400; `/api/page` returns status 200 with `error` set so one bad page doesn't stop the crawl.

---

## POST /api/discover
Finds pages on the same site (HTML links, breadth-first, then `sitemap.xml` if needed).

**Request**
```json
{ "url": "https://example.com" }
```
Counts pages: breadth-first HTML crawl (up to 500 URLs or about 25 s), then sitemap (robots.txt / sitemap.xml / sitemap_index.xml).

**Response**
```json
{ "root": "https://example.com/", "pages": ["https://example.com/", "https://example.com/about"], "total": 120, "atLeast": false, "sitemapCount": 118, "maxAnalyze": 50, "seconds": 6.2 }
```
`pages` is ordered main pages first. `atLeast: true` means the site may have more than `total`. The browser then asks the user how many to analyse (1 to `min(total, maxAnalyze)`).
```text
```

---

## POST /api/page
Opens one page in headless Chrome.

**Request**
```json
{ "url": "https://example.com/", "mobile": true }
```
`mobile: true` also takes a 390×844 screenshot and fetches the favicon (used for the homepage).

**Response:** `PageResult` (see DATA_MODEL.md), e.g.
```json
{
  "url": "https://example.com/", "finalUrl": "https://example.com/", "status": 200, "loadMs": 2400,
  "screenshot": "data:image/jpeg;base64,...", "mobileScreenshot": "data:image/jpeg;base64,...", "faviconData": "data:image/png;base64,...",
  "colors": { "background": [["#ffffff", 1024000]], "text": [["#111111", 900]], "border": [] },
  "typography": { "families": [["Inter", 900]], "sizes": [["16px", 600]], "weights": [["400", 700]], "loadedFonts": [], "fontFaces": [] },
  "design": { "spacing": [["16px", 40]], "radius": [["8px", 12]], "buttons": [], "...": "..." },
  "animations": { "keyframes": [], "libraries": [{ "name": "GSAP", "version": "3.15.0" }], "...": "..." },
  "tech": [{ "name": "Next.js", "version": null }],
  "seo": { "title": "Example", "h1": ["Hello"], "...": "..." },
  "security": { "https": true, "mixedContent": [], "cookies": [], "libIssues": [], "...": "..." }
}
```
Max duration 60 s.

---

## POST /api/site
Site-wide passive checks.

**Request** `{ "url": "https://example.com/" }`

**Response** (`SiteResult`)
```json
{
  "finalUrl": "https://example.com/", "status": 200, "redirects": [],
  "headers": { "content-type": "text/html" },
  "checks": [{ "name": "Strict-Transport-Security (HSTS)", "ok": false, "severity": "medium", "detail": "Missing" }],
  "ssl": { "valid": true, "issuer": "Let's Encrypt", "protocol": "TLSv1.3", "daysLeft": 61 },
  "hosting": ["Cloudflare"],
  "stack": [{ "name": "WordPress", "category": "CMS", "version": "6.4.2", "how": "generator tag" }],
  "robots": "User-agent: *", "hasSitemap": true, "securityTxt": false, "compression": "br"
}
```
Severity: `high | medium | low | info`.

---

## POST /api/links
**Request** `{ "links": ["https://example.com/a", "https://other.com/b"] }` (max 150 checked, about 45 s budget)

**Response**
```json
{ "checked": 120, "total": 120, "blocked": 3, "broken": [{ "url": "https://example.com/old", "status": 404 }] }
```
401 / 403 / 429 are counted in `blocked`, not `broken`.

---

## POST /api/chat
**Request (chat)** `{ "mode": "chat", "facts": { …reportFacts() }, "messages": [{ "role": "user", "content": "What should I fix first?" }] }` (last 8 turns, 1500 chars each)

**Request (compare)** `{ "mode": "compare", "names": ["a.com", "b.com"], "facts": { … }, "factsB": { … } }`

**Response** `{ "answer": "markdown text" }` or `{ "error": "…" }`. Needs sign-in; counts toward the AI daily cap.

---

## POST /api/a11yfix
**Request** `{ "issues": [{ "id": "color-contrast", "help": "…", "description": "…", "html": ["<a …>"], "why": ["Element has insufficient color contrast of 2.1 …"] }] }` (max 12)

**Response** `{ "fixes": { "color-contrast": { "fix": "simple explanation", "code": "corrected HTML or CSS" } } }` or `{ "error": "…" }`.

---

## GET /api/media?url=...
Downloads one public media file (image/video/audio/font) so the browser can put it in a ZIP. Blocks private addresses, max 4 MB (Vercel response limit). Errors: `413 {error:"too-large"}`, `415` not media, `502` site error, `429` rate limit (600/hour per IP).

---

## POST /api/ai
**Request**
```json
{ "summary": { "...": "Summary" }, "textSample": "homepage text…", "screenshot": "data:image/jpeg;base64,..." }
```

**Response** (`AiResult`)
```json
{
  "ai": true, "model": "nvidia/nemotron-3.5-super-vl-120b-a12b",
  "suggestions": [{ "area": "Security", "priority": "high", "title": "Add HSTS", "detail": "…" }],
  "designMd": "# Design System: example.com …", "rawDesignMd": "…", "error": null
}
```
Without `NVIDIA_API_KEY`: `ai: false`, rule-based `suggestions`, measured `designMd`, and a `note`.
Max duration 120 s (main model 75 s, then fallback model 35 s, text only).

---

## POST /api/speed
**Request** `{ "url": "https://example.com/", "bytes": 1850000 }` (`bytes` = page weight we measured, used only if PageSpeed fails)

**Response** (`SpeedResult`)
```json
{
  "url": "https://example.com/",
  "runs": [{ "strategy": "mobile", "score": 72,
    "metrics": [{ "key": "largest-contentful-paint", "label": "Largest Contentful Paint", "value": "3.1 s", "score": 55 }],
    "field": [{ "key": "LARGEST_CONTENTFUL_PAINT_MS", "label": "LCP", "value": "2.4 s", "rating": "fast" }],
    "opportunities": [{ "title": "Reduce unused JavaScript", "saving": "Est savings of 120 KiB" }], "bytes": 1850000 }],
  "carbon": { "grams": 0.29, "rating": "E", "green": false, "host": "example.com", "bytes": 1850000, "yearlyKg10k": 34.8 }
}
```
Without a key Google's shared quota is used (often 429); `note` then suggests adding `GOOGLE_API_KEY`. Max 120 s.

---

## POST /api/trust
**Request** `{ "url": "https://example.com/", "signals": { "privacy": true, "terms": true, "contact": true, "about": false, "passwordOnHttp": false } }`
(`signals` come from the crawled pages' links.)

**Response** (`TrustResult`)
```json
{ "score": 90, "verdict": "safe", "domain": "example.com",
  "checks": [{ "name": "Google Safe Browsing", "ok": true, "weight": "high", "detail": "Not on Google's list of unsafe sites." }],
  "domainInfo": { "created": "1995-08-14T04:00:00Z", "expires": "2027-08-13T04:00:00Z", "registrar": "RESERVED-IANA", "ageDays": 11424 } }
```
`ok: null` = could not check. Score: 100 minus 30 / 15 / 5 for each failed high / medium / low check; a Safe Browsing match caps it at 5. Verdict: `safe` ≥ 75, `caution` ≥ 45, else `risky`.

---

## POST /api/seofix
**Request** `{ "pages": [{ "url", "title", "description", "h1", "h2", "canonical", "lang", "viewport", "robots", "ogTitle", "ogImage", "twitterCard", "images", "imagesNoAlt", "jsonLd", "wordCount", "text" }], "hasSitemap": false, "hasRobots": true, "logo": null }` (max 25 pages)

**Response** (`SeoFixResult`)
```json
{ "ai": true, "fixes": [{ "page": "/", "issue": "No meta description, so Google picks random text.", "fix": "Put this AI-written description in the <head>.", "code": "<meta name=\"description\" content=\"…\">", "lang": "html", "priority": "medium", "ai": true }] }
```
Tags, URLs, sitemap, robots.txt and JSON-LD are built from measured data. NIM only writes title/description text (falls back to current text with a `note`).

---

## POST /api/competitors
**Request** `{ "url": "https://example.com/", "title": "…", "description": "…", "headings": ["…"], "text": "home page text" }`

**Response** (`CompetitorResult`)
```json
{ "summary": "…", "model": "gemini-2.5-flash",
  "competitors": [{ "name": "Acme", "url": "https://acme.com", "why": "…", "strengths": "…" }],
  "sources": [{ "title": "acme.com", "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/…" }] }
```
Without `GEMINI_API_KEY`: `{ "note": "Add GEMINI_API_KEY …" }`. The analysed site and duplicates are removed.

---

## GET /api/me
Returns `{ signedIn, admin, adminListSet, loginSetUp, reason }` for the signed-in user (no emails). Used to show the admin dashboard.

---

## Firebase (browser → Firestore, not Next.js routes)
`src/lib/history.ts`:
| Function | Does |
|---|---|
| `saveAnalysis({pages, site, summary, ai, seconds})` | adds a document without screenshots, returns id |
| `listAnalyses()` | latest 100 documents (id, host, date, scores, favicon) |
| `loadAnalysis(id)` | full document, JSON parsed (no screenshots) |
| `deleteAnalysis(id)` | deletes the document |

Other browser → Firestore helpers: `feedback.ts` (Contact us), `admin.ts` (admin dashboard, live), `track.ts` (usage events, time spent), `share.ts` (share links), `usage.ts` (free plan counters), `profile.ts` (name + country).
