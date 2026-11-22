# TASKS

## In progress / waiting
- [ ] **Set up Firebase for login + history.** Code is done. Owner creates the Firebase project, enables Email/Password, creates Firestore, pastes `firestore.rules`, and adds the 4 `NEXT_PUBLIC_FIREBASE_*` values to `.env.local`.
- [ ] **Test login flow end to end:** sign up → confirm email → log in → analyze → appears in History → reopen (shows re-crawl prompt for screenshots) → delete.
- [ ] **Push to GitHub:** `git push -u origin main` (local commits not pushed yet).
- [ ] **Deploy to Vercel** after the owner reviews locally. Add env vars in Vercel. Check `/api/page` works with `@sparticuz/chromium` and stays under limits.

## Next
- [ ] Firebase Auth > Settings > Authorized domains: add the Vercel domain.
- [ ] Optional: password reset email and email verification.
- [ ] Optional Google sign-in.
- [x] Rate limit the API routes on the deployed app (per IP) to protect NVIDIA quota and server time.
- [ ] Show progress per page (which page is scanning) in the Pages view.
- [ ] Compare two analyses of the same site over time (history diff).
- [ ] Export design.md as PDF.
- [ ] Hover/focus state capture for buttons and links (currently not measured).
- [ ] Lighthouse-style metrics (LCP, CLS) via the Performance API.

## Known issues
- `npm audit`: moderate advisory in `uuid` (pulled in by `exceljs`). It only affects code that passes its own buffer to uuid; exceljs doesn't. Recheck when exceljs updates.
- PDF uses built-in fonts (Latin only); non-Latin text in titles shows as `?`.
- `npm audit` reports high advisories in `@grpc/grpc-js` (pulled in by `firebase`). They affect gRPC servers in Node; this app only uses Firestore in the browser. Recheck when Firebase updates.
- Cross-origin stylesheets can't be read, so some @keyframes, CSS variables and breakpoints may be missing (shown in the UI).
- Some sites block headless Chrome or rate-limit; pages can fail with timeouts.
- `bis_skin_checked` hydration warning can still appear in dev with some antivirus browser extensions (harmless, dev only).

## Done
- [x] Next.js app, crawler, screenshots, colours, fonts, animations, tech, SEO, passive security
- [x] Broken-link checker (bot-blocked codes excluded)
- [x] NVIDIA NIM suggestions + fallback model, thinking off
- [x] Detailed design.md (measured tokens + AI notes from screenshot)
- [x] Dashboard matching mockup, light/dark theme, GSAP animations, responsive
- [x] Logo + favicon; site favicon fetched server-side
- [x] Login + history (code)
- [x] DOCS folder
