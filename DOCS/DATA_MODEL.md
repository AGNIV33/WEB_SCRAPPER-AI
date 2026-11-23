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
`finalUrl, status, headers, checks[{name, ok, severity, detail}], ssl, hosting[], stack[{name, category, version?, how?}], robots, hasSitemap, compression`

### LinksResult (from `/api/links`)
`checked, total, blocked, broken[{url, status, error?}]`

### Summary (from `buildSummary()`)
`url, pagesAnalyzed, pagesFailed, palette, typography, animations, tech, hosting, design, seoScore, seo{pages, hasSitemap, hasRobots}, security{checks, ssl, mixedContent, insecureForms, passwordOnHttp, cookies, libIssues, thirdPartyDomains, blankNoopener, score}, performance{avgLoadMs, pages, compression}, brokenLinks, linksChecked, linksBlocked`

### AiResult (from `/api/ai`)
`ai: boolean, model?, note?, error?, suggestions[{area, priority, title, detail}], designMd, rawDesignMd?, about?, extras?`

### Extras (`AiResult.extras`, types in `src/lib/insights.ts`)
| Field | Type | From |
|---|---|---|
| speed | `SpeedResult`: runs[{strategy, score, metrics, field, opportunities, bytes}], carbon{grams, rating, green, bytes, yearlyKg10k} | `/api/speed` |
| trust | `TrustResult`: score, verdict, domain, checks[{name, ok, weight, detail}], domainInfo{created, expires, registrar, ageDays} | `/api/trust` |
| seoFixes | `SeoFixResult`: ai, note?, fixes[{page, issue, fix, code, lang, priority, ai?}] | `/api/seofix` |
| competitors | `CompetitorResult`: summary, competitors[{name, url, why, strengths}], sources[{title, url}], model | `/api/competitors` |

Any of them can instead be `{ error }` or `{ note }`. They are saved inside `aiJson`, so history shows them again.

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

### Other collections
| Path | What |
|---|---|
| `users/{uid}` | profile: displayName, country, email, plan, timeSpentSec, lastSeen |
| `users/{uid}/meta/usage` | free plan counters (sites, scans per site); counts can only go up |
| `events/{id}` | usage events (scan, error, login) for the admin dashboard |
| `feedback/{id}` | Contact us messages: uid, email, type, subject, message, status (new / seen / resolved), reply |
| `blocked/{uid}` | removed accounts |
| `shares/{id}` | public read-only report links |

**Security rules** (`firestore.rules`): users read and write only their own data; the admin email (set inside the rules) can read usage, events and feedback and manage users. Everything else is closed.

When a saved analysis is reopened, screenshot areas show a "Re-crawl to see screenshots" button.