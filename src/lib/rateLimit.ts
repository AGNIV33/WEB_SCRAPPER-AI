/**
 * Simple rate limiting for the API routes (protects the free NVIDIA quota and Vercel server time).
 *
 * - Default: in-memory counters. On Vercel, warm server instances are reused, so this catches most abuse
 *   for free with no extra service. Counters reset when an instance restarts.
 * - Optional: set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (free Upstash Redis) for exact,
 *   shared limits across all instances.
 * - Off on your own PC (npm run dev / npm run fast) unless RATE_LIMIT=1.
 */

import { getCaller, isAdmin } from "./serverAuth";

type Rule = { limit: number; windowSec: number };

/** Per visitor (IP) limits. One analysis of 50 pages = 1 discover + up to ~100 page calls (with retries). */
export const RULES = {
  discover: { limit: 15, windowSec: 3600 },
  page: { limit: 200, windowSec: 3600 },
  site: { limit: 30, windowSec: 3600 },
  links: { limit: 30, windowSec: 3600 },
  ai: { limit: 15, windowSec: 3600 },
  media: { limit: 600, windowSec: 3600 }, // media downloads (one call per file)
} satisfies Record<string, Rule>;

/** Whole-app daily cap on AI calls (all visitors together), to protect the NVIDIA free tier. */
const AI_DAILY_TOTAL = Number(process.env.AI_DAILY_LIMIT) || 300;

const enabled = () => process.env.RATE_LIMIT === "1" || (!!process.env.VERCEL && process.env.RATE_LIMIT !== "0");

const mem = new Map<string, { count: number; reset: number }>();
function memHit(key: string, windowSec: number) {
  const now = Date.now();
  let e = mem.get(key);
  if (!e || e.reset <= now) { e = { count: 0, reset: now + windowSec * 1000 }; mem.set(key, e); }
  e.count++;
  if (mem.size > 5000) for (const [k, v] of mem) if (v.reset <= now) mem.delete(k); // keep memory small
  return { count: e.count, resetSec: Math.ceil((e.reset - now) / 1000) };
}

async function redisHit(key: string, windowSec: number) {
  const url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const bucket = Math.floor(Date.now() / 1000 / windowSec);
    const k = `rl:${key}:${bucket}`;
    const r = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify([["INCR", k], ["EXPIRE", k, String(windowSec)]]),
    });
    const j = (await r.json()) as { result: number }[];
    return { count: j[0].result, resetSec: windowSec - (Math.floor(Date.now() / 1000) % windowSec) };
  } catch {
    return null; // Redis problem: fall back to memory instead of blocking users
  }
}

const hit = async (key: string, windowSec: number) => (await redisHit(key, windowSec)) ?? memHit(key, windowSec);

export function clientIp(req: Request) {
  return (req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "unknown").trim();
}

const wait = (s: number) => (s >= 60 ? `${Math.ceil(s / 60)} min` : `${s} s`);

/** Returns a 429 Response if the caller is over the limit, otherwise null. */
export async function rateLimit(req: Request, name: keyof typeof RULES): Promise<Response | null> {
  if (!enabled()) return null;
  if (req.headers.get("authorization") && isAdmin(await getCaller(req))) return null; // admins are never limited
  const rule = RULES[name];
  const ip = clientIp(req);
  const r = await hit(`${name}:${ip}`, rule.windowSec);
  if (r.count > rule.limit) {
    return Response.json(
      { error: `Too many requests. Please try again in ${wait(r.resetSec)}.`, rateLimited: true },
      { status: 429, headers: { "retry-after": String(r.resetSec) } }
    );
  }
  return null;
}

/** Counts one AI run against the whole-app daily cap. False = cap reached (use rule-based results). */
export async function aiBudgetLeft(admin = false): Promise<boolean> {
  if (!enabled() || admin) return true;
  const g = await hit("ai:all", 86400);
  return g.count <= AI_DAILY_TOTAL;
}
