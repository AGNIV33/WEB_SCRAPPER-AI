"use client";
/* Usage tracking for signed-in users, stored in Firestore for the admin dashboard.
 * - events: one document per finished scan or error (no page content, no screenshots).
 * - users/{uid}: profile (email, name), sign-in count and time spent.
 * Everything is best effort: a failure here never disturbs the app. */
import { addDoc, collection, doc, getDoc, increment, serverTimestamp, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { auth, db, type User } from "./firebase";

export type TrackEvent = {
  type: "scan" | "error";
  host?: string; pagesOk?: number; pagesFailed?: number; lite?: number; seconds?: number; apiCalls?: number; ai?: boolean;
  status?: "ok" | "stopped" | "error"; where?: string; message?: string;
};

export function trackEvent(e: TrackEvent) {
  const uid = auth?.currentUser?.uid;
  if (!db || !uid) return;
  const data: Record<string, unknown> = Object.fromEntries(Object.entries(e).filter(([, v]) => v !== undefined));
  if (typeof data.message === "string") data.message = data.message.slice(0, 300);
  addDoc(collection(db, "events"), { ...data, uid, at: serverTimestamp() }).catch(() => {});
}

/** Saves/refreshes the user's profile. Counts one sign-in per browser session. */
export function touchProfile(u: User) {
  if (!db) return;
  let newSession = false;
  try { newSession = !sessionStorage.getItem("sess"); sessionStorage.setItem("sess", "1"); } catch { /* ignore */ }
  setDoc(doc(db, "users", u.uid), {
    email: u.email ?? "", displayName: u.displayName ?? "", photoURL: u.photoURL ?? "",
    createdAt: Timestamp.fromDate(new Date(u.metadata.creationTime || Date.now())),
    lastSeen: serverTimestamp(),
    ...(newSession ? { logins: increment(1) } : {}),
  }, { merge: true }).catch(() => {});
}

/** Adds one minute of "time spent" for every minute the app is open and in focus. */
export function startHeartbeat() {
  const id = setInterval(() => {
    const uid = auth?.currentUser?.uid;
    if (!db || !uid || document.visibilityState !== "visible" || !document.hasFocus()) return;
    updateDoc(doc(db, "users", uid), { timeSpentSec: increment(60), lastSeen: serverTimestamp() }).catch(() => {});
  }, 60000);
  return () => clearInterval(id);
}

/** True if the admin removed this account (blocked/{uid}). Owners may read their own block document. */
export async function isAccountBlocked(uid: string): Promise<boolean> {
  if (!db) return false;
  try { return (await getDoc(doc(db, "blocked", uid))).exists(); } catch { return false; }
}