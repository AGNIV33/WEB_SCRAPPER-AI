/** Shared checks for the extra report routes: sign-in, blocked accounts, rate limits, AI budget. */
import { authConfigured, getCaller, isAdmin, isBlocked } from "./serverAuth";
import { aiBudgetLeft, rateLimit, type RULES } from "./rateLimit";

/** Returns { stop } with a JSON answer to send back, or { stop: null } when the caller may go on. */
export async function gate(req: Request, name: keyof typeof RULES, opts: { needLogin?: boolean; ai?: boolean } = {}) {
  const caller = authConfigured() ? await getCaller(req) : null;
  if (caller && !isAdmin(caller) && (await isBlocked(caller))) return { stop: Response.json({ error: "This account has been removed. Please contact support." }, { status: 403 }), caller };
  if (opts.needLogin && authConfigured() && !caller) return { stop: Response.json({ note: "Sign in to unlock this section." }), caller };
  const limited = await rateLimit(req, name);
  if (limited) return { stop: Response.json({ error: ((await limited.json()) as { error: string }).error }), caller };
  if (opts.ai && !(await aiBudgetLeft(isAdmin(caller)))) return { stop: Response.json({ error: "The AI has reached today's limit. Try again tomorrow." }), caller };
  return { stop: null, caller };
}
