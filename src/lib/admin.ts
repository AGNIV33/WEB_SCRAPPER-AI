"use client";
/* Admin dashboard data and actions. All of this is protected by firestore.rules (only the admin email can read it),
 * the buttons in the UI are just a convenience. */
import {
  collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where, writeBatch, type Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { toItem, type FeedbackItem, type FeedbackStatus } from "./feedback";

const toDate = (v: unknown) => { const t = v as Timestamp | undefined; return t && typeof t.toDate === "function" ? t.toDate() : null; };
const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : 0);

export type UserRow = {
  uid: string; email: string; name: string; photo: string; createdAt: Date | null; lastSeen: Date | null; logins: number; timeSpentSec: number;
  plan: "free" | "pro"; sites: Record<string, number>; uniqueCount: number; total: number; blocked: boolean; blockedAt: Date | null; known: boolean;
};
export type EventRow = {
  id: string; uid: string; type: "scan" | "error"; at: Date; host: string; pagesOk: number; pagesFailed: number; lite: number;
  seconds: number; apiCalls: number; ai: boolean; status: string; where: string; message: string;
};
export type AdminData = { users: UserRow[]; events: EventRow[]; feedback: FeedbackItem[]; eventsTruncated: boolean; loadedAt: Date };

const EVENT_LIMIT = 3000;

export async function loadAdminData(): Promise<AdminData> {
  if (!db) throw new Error("Login is not configured");
  const [profiles, metas, evs, fb, blocked] = await Promise.all([
    getDocs(query(collection(db, "users"), limit(2000))),
    getDocs(collectionGroup(db, "meta")),
    getDocs(query(collection(db, "events"), orderBy("at", "desc"), limit(EVENT_LIMIT))),
    getDocs(query(collection(db, "feedback"), orderBy("createdAt", "desc"), limit(300))),
    getDocs(collection(db, "blocked")),
  ]);

  const users = new Map<string, UserRow>();
  const blank = (uid: string): UserRow => ({ uid, email: "", name: "", photo: "", createdAt: null, lastSeen: null, logins: 0, timeSpentSec: 0, plan: "free", sites: {}, uniqueCount: 0, total: 0, blocked: false, blockedAt: null, known: false });
  const get = (uid: string) => { let u = users.get(uid); if (!u) { u = blank(uid); users.set(uid, u); } return u; };

  profiles.forEach((d) => {
    const x = d.data(); const u = get(d.id);
    Object.assign(u, { email: String(x.email || ""), name: String(x.displayName || ""), photo: String(x.photoURL || ""), createdAt: toDate(x.createdAt), lastSeen: toDate(x.lastSeen), logins: num(x.logins), timeSpentSec: num(x.timeSpentSec), known: true });
  });
  metas.forEach((d) => {
    if (d.id !== "usage") return;
    const uid = d.ref.parent.parent?.id; if (!uid) return;
    const x = d.data(); const u = get(uid);
    u.plan = x.plan === "pro" ? "pro" : "free"; u.sites = (x.sites || {}) as Record<string, number>; u.uniqueCount = num(x.uniqueCount); u.total = num(x.total);
  });
  const events: EventRow[] = evs.docs.map((d) => {
    const x = d.data();
    return { id: d.id, uid: String(x.uid || ""), type: x.type === "error" ? "error" : "scan", at: toDate(x.at) || new Date(0), host: String(x.host || ""), pagesOk: num(x.pagesOk), pagesFailed: num(x.pagesFailed), lite: num(x.lite), seconds: num(x.seconds), apiCalls: num(x.apiCalls), ai: !!x.ai, status: String(x.status || ""), where: String(x.where || ""), message: String(x.message || "") };
  });
  events.forEach((e) => { if (e.uid) get(e.uid); });
  blocked.forEach((d) => { const u = get(d.id); u.blocked = true; u.blockedAt = toDate(d.data().at); if (!u.email) u.email = String(d.data().email || ""); });

  return {
    users: [...users.values()], events, eventsTruncated: evs.size >= EVENT_LIMIT,
    feedback: fb.docs.map((d) => toItem(d.id, d.data())), loadedAt: new Date(),
  };
}

/** Switch a user between the free and the paid (Pro) plan. The server reads this same field. */
export async function setPlan(uid: string, plan: "free" | "pro") {
  if (!db) return;
  const ref = doc(db, "users", uid, "meta", "usage");
  if ((await getDoc(ref)).exists()) await updateDoc(ref, { plan });
  else await setDoc(ref, { plan, sites: {}, uniqueCount: 0, total: 0 });
}

async function deleteAll(refs: { ref: Parameters<typeof deleteDoc>[0] }[]) {
  if (!db) return;
  for (let i = 0; i < refs.length; i += 400) {
    const b = writeBatch(db);
    refs.slice(i, i + 400).forEach((r) => b.delete(r.ref));
    await b.commit();
  }
}

/**
 * Removes a user from the app: deletes their saved analyses, usage and share links, and blocks the account so it
 * can't be used any more. (The sign-in record itself lives in Firebase Authentication and can only be deleted
 * in the Firebase console; the block makes it unusable meanwhile.)
 */
export async function removeUser(uid: string, email: string) {
  if (!db) return;
  await setDoc(doc(db, "blocked", uid), { email, at: serverTimestamp() });
  await deleteAll((await getDocs(collection(db, "users", uid, "analyses"))).docs);
  await deleteAll((await getDocs(query(collection(db, "shares"), where("ownerUid", "==", uid)))).docs);
  await deleteDoc(doc(db, "users", uid, "meta", "usage")).catch(() => {});
}

export async function restoreUser(uid: string) {
  if (!db) return;
  await deleteDoc(doc(db, "blocked", uid));
}

export async function updateFeedback(id: string, patch: { status?: FeedbackStatus; reply?: string }) {
  if (!db) return;
  await updateDoc(doc(db, "feedback", id), { ...patch, ...(patch.reply !== undefined ? { repliedAt: serverTimestamp() } : {}) });
}

export async function deleteFeedback(id: string) {
  if (!db) return;
  await deleteDoc(doc(db, "feedback", id));
}

/** Live list of messages that have not been opened yet (drives the admin's bell and the badge in the sidebar). */
export function watchNewFeedback(cb: (items: FeedbackItem[]) => void): () => void {
  if (!db) return () => {};
  return onSnapshot(query(collection(db, "feedback"), where("status", "==", "new")), (s) => cb(s.docs.map((d) => toItem(d.id, d.data()))), () => cb([]));
}