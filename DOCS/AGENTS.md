# AGENTS.md: rules for AI agents and contributors

Read this before changing code.

## Project basics
- Next.js **16** with breaking changes from older versions. Before using a Next.js API, read the docs in `node_modules/next/dist/docs/` (see root `AGENTS.md`).
- Run `npx tsc --noEmit` and `npx eslint src` before every commit. Both must pass with no output.
- Run `npx next build` before anything that will be deployed.

## Hard rules
1. **Passive security only.** Never add active scanning, fuzzing, payload injection, brute force, port scans or anything that sends attack traffic.
2. **Keep the SSRF guard.** Every server fetch of a user-supplied URL goes through `safeFetch` / `assertPublicHost` in `src/lib/url.ts`. Never call `fetch` on a user URL directly.
3. **Facts, not guesses.** design.md and dashboard numbers must come from measured data. AI text may describe, but must not change hex codes, fonts or px values.
4. **Serverless budget.** Keep each API call under its `maxDuration`. Do one page per `/api/page` call.
5. **No secrets in the client.** Only `NEXT_PUBLIC_*` values are public. `NVIDIA_API_KEY`, `GOOGLE_API_KEY` and `GEMINI_API_KEY` stay server-side. Never hard-code a key.
6. **User data is private.** All user data lives under `users/{uid}` in Firestore and `firestore.rules` must keep it owner-only. Don't store screenshots in history.
7. **Code inside the target page** lives in `src/lib/extractScript.ts` as a plain JS string. Don't import TS helpers into it.
8. **Don't break no-key mode.** The app must still run without `NVIDIA_API_KEY`, `GOOGLE_API_KEY`, `GEMINI_API_KEY` and without Firebase env vars (show a short note instead).
9. **Free services only.** New APIs must have a free tier. Route new paid-quota calls through `gate()` in `src/lib/gate.ts` and add a rate limit in `src/lib/rateLimit.ts`.

## Windows / encoding gotcha
On Windows PowerShell 5.1, `Get-Content` without `-Encoding UTF8` reads files as ANSI and corrupts characters like `·`, `…`, `≤`. When editing with PowerShell use:
```powershell
[IO.File]::ReadAllText($f, [Text.Encoding]::UTF8)
[IO.File]::WriteAllText($f, $t, (New-Object Text.UTF8Encoding $false))
```

## Style
- TypeScript, functional React components, Tailwind classes.
- Every colour class needs a `dark:` variant.
- Cards use `data-anim="card"`; small items use `data-pop`; numbers use `<Num>` so GSAP animates them.
- Keep user-facing text short and simple.

## Commits
- Small commits with a clear message (what + why).
- Don't commit `.env*` files (only `.env.example`).
