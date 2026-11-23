/* Browser side: POST to one of our AI routes with the user's login token. Throws on an error answer. */
import { idToken } from "./firebase";

export async function askApi<T>(path: string, body: unknown): Promise<T> {
  const token = await idToken();
  const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  const j = (await r.json().catch(() => ({ error: `Server error ${r.status}` }))) as T & { error?: string; note?: string };
  if (j.error || j.note) throw new Error(j.error || j.note);
  if (!r.ok) throw new Error(`Server error ${r.status}`);
  return j;
}
