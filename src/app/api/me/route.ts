import { adminEmails, authConfigured, getCaller, isAdmin } from "@/lib/serverAuth";

/**
 * Tells the browser whether the signed-in user is an admin (the admin list stays on the server).
 * Also gives a short, safe status (no emails) so a missing setting is easy to spot:
 * open /api/me in the browser and check "adminListSet" and "loginSetUp".
 */
export async function GET(req: Request) {
  const why: { error?: string } = {};
  const caller = await getCaller(req, why);
  const sentToken = (req.headers.get("authorization") || "").startsWith("Bearer ");
  const admin = isAdmin(caller);
  const adminListSet = adminEmails().length > 0;
  const reason = admin ? "ok"
    : !authConfigured() ? "login-not-set-up"
    : !caller ? (sentToken ? `token-rejected (${why.error || "unknown"})` : "not-signed-in")
    : !adminListSet ? "admin-list-empty"
    : !caller.emailVerified ? "email-not-verified"
    : "email-not-in-admin-list";
  return Response.json({ signedIn: !!caller, admin, adminListSet, loginSetUp: authConfigured(), reason }, { headers: { "cache-control": "no-store" } });
}
