import { getCaller, isAdmin } from "@/lib/serverAuth";

/** Tells the browser whether the signed-in user is an admin (the admin list stays on the server). */
export async function GET(req: Request) {
  const caller = await getCaller(req);
  return Response.json({ signedIn: !!caller, admin: isAdmin(caller) }, { headers: { "cache-control": "no-store" } });
}
