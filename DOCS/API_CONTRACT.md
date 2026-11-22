# API CONTRACT

All routes are `POST`, JSON in and JSON out, under `/api`. No auth is needed to call them (they don't store anything). Types are in `src/lib/report.ts`.

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
  "hosting": ["Cloudflare"], "robots": "User-agent: *", "hasSitemap": true, "securityTxt": false, "compression": "br"
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

## Firebase (browser → Firestore, not Next.js routes)
`src/lib/history.ts`:
| Function | Does |
|---|---|
| `saveAnalysis({pages, site, summary, ai, seconds})` | adds a document without screenshots, returns id |
| `listAnalyses()` | latest 100 documents (id, host, date, scores, favicon) |
| `loadAnalysis(id)` | full document, JSON parsed (no screenshots) |
| `deleteAnalysis(id)` | deletes the document |
