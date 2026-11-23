/**
 * Shared Gemini settings. Free only, never billed:
 * - Only gemini-2.5-flash / -flash-lite (free tier; also the only ones with free Search grounding).
 * - Whole app stops at GEMINI_DAILY_LIMIT (default 400, max 450) calls a day, under Google's 500.
 * - Keep the Google project for this key WITHOUT a billing account.
 */
export const FREE_OK = /^gemini-2\.[05]-flash(-lite)?(-\d{3})?$/;
const wanted = (process.env.GEMINI_MODEL || "").trim();
export const GEMINI_MODELS = [...new Set([FREE_OK.test(wanted) ? wanted : "gemini-2.5-flash", "gemini-2.5-flash-lite"])];
export const GEMINI_DAILY = Math.min(Number(process.env.GEMINI_DAILY_LIMIT) || 400, 450);
