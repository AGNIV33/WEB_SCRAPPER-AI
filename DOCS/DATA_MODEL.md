# DATA MODEL

Two kinds of data:
1. **In-memory analysis objects** (TypeScript, `src/lib/report.ts`). Nothing is stored unless the user is logged in.
2. **Supabase** (only for logged-in users): table `public.analyses` + storage bucket `screenshots`.

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

## 2. Supabase

### Table `public.analyses`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | `gen_random_uuid()` (client sends its own UUID so screenshots can be uploaded first) |
| user_id | uuid | default `auth.uid()`, FK `auth.users`, cascade delete |
| url | text | |
| host | text | |
| created_at | timestamptz | default `now()` |
| duration_s | real | |
| pages_count | int | |
| security_score | int | |
| seo_score | int | |
| summary | jsonb | Summary |
| ai | jsonb | AiResult |
| site | jsonb | SiteResult |
| pages | jsonb | PageResult[] without image data; has `screenshotPath`, `mobilePath` |
| thumbnail_path | text | first screenshot path |

Index: `(user_id, created_at desc)`.

**RLS:** select / insert / update / delete only where `auth.uid() = user_id`.

### Storage bucket `screenshots` (private)
- Path: `{user_id}/{analysis_id}/{index}.jpg` and `{index}-mobile.jpg`.
- Policies: authenticated users can read, upload and delete only inside the folder named with their user id.
- Read via signed URLs (1 hour).

Migration: `supabase/migrations/001_history.sql`.
