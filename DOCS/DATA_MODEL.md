# DATA MODEL

Two kinds of data:
1. **In-memory analysis objects** (TypeScript, `src/lib/report.ts`). Nothing is stored unless the user is logged in.
2. **Firebase Firestore** (only for logged-in users): `users/{uid}/analyses`. Screenshots are **not** stored; users re-crawl to see them.

## 1. TypeScript objects

### PageResult (one per page, from `/api/page`)
| Field | Type | Notes |
|---|---|---|
| url, finalUrl | string | requested / after redirects |
| status | number \| null | HTTP status |
| loadMs | number | time to `networkidle2` |
| screenshot | string | JPEG data URL (desktop, max 3600px tall) |
| mobileScreenshot | string \| null | homepage only, 390×844 |
| faviconData | string \| null | homepage only, data URL |
| colors | {background, text, border}: [hex, weight][] | weight = area or text length |
| cssVars | Record<string,string> | from `:root` / `html` rules |
| design | DesignRaw | spacing, radius, shadows, gradients, line heights, max-widths, durations, easings, z-index, breakpoints, text styles, buttons, input, link, cards, header, footer, icons |
| typography | families, sizes, weights, loadedFonts, fontFaces | |
| animations | keyframes, cssAnimated, transitionEls, transitionProps, running, libraries, blockedSheets | |
| tech | {name, version}[] | |
| seo | title, description, lang, canonical, robots, viewport, og*, twitterCard, favicon, h1/h2/h3, wordCount, images, imagesNoAlt, jsonLd | |
| links | {href, text, blank, rel}[] | |
| forms | {action, method, hasPassword}[] | |
| perf | ttfb, domContentLoaded, load, requests, transferKB, domNodes | |
| security | https, mixedContent, insecureForms, passwordOnHttp, cookies, thirdPartyDomains, blankNoopener, libIssues | |
| error | string | set when the page failed |

### SiteResult (from `/api/site`)
`finalUrl, status, headers, checks[{name, ok, severity, detail}], ssl, hosting[], robots, hasSitemap, compression`

### LinksResult (from `/api/links`)
`checked, total, blocked, broken[{url, status, error?}]`

### Summary (from `buildSummary()`)
`url, pagesAnalyzed, pagesFailed, palette, typography, animations, tech, hosting, design, seoScore, seo{pages, hasSitemap, hasRobots}, security{checks, ssl, mixedContent, insecureForms, passwordOnHttp, cookies, libIssues, thirdPartyDomains, blankNoopener, score}, performance{avgLoadMs, pages, compression}, brokenLinks, linksChecked, linksBlocked`

### AiResult (from `/api/ai`)
`ai: boolean, model?, note?, error?, suggestions[{area, priority, title, detail}], designMd, rawDesignMd?`

## 2. Firebase Firestore

### Collection `users/{uid}/analyses/{id}`
One document per saved analysis. Large objects are stored as **JSON strings** because Firestore doesn't allow nested arrays (colour data uses `[hex, weight]` pairs) and documents must be under 1 MB.

| Field | Type | Notes |
|---|---|---|
| url | string | |
| host | string | |
| created_at | timestamp | `serverTimestamp()` |
| duration_s | number | |
| pages_count | number | |
| security_score | number | |
| seo_score | number | |
| favicon | string \| null | small data URL of the site icon (< 60 KB) |
| summaryJson | string | `Summary` |
| aiJson | string | `AiResult` (includes design.md) |
| siteJson | string | `SiteResult` |
| pagesJson | string | `PageResult[]` without screenshots; trimmed in steps (links, then per-page extras) until the document is < 950 KB |

**Security rules** (`firestore.rules`): a user can read, create and delete only under `users/{their uid}`. Updates are blocked. Everything else is closed.

When a saved analysis is reopened, screenshot areas show a "Re-crawl to see screenshots" button.