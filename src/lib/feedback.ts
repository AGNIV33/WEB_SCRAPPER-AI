"use client";
/* Contact us: feedback, issue reports and ideas. Stored in Firestore (feedback/{id}), read by the admin dashboard. */
import { addDoc, collection, getDocs, query, serverTimestamp, where, type Timestamp } from "firebase/firestore";
import { auth, db } from "./firebase";

export type FeedbackType = "feedback" | "issue" | "idea";
export type FeedbackStatus = "new" | "read" | "resolved";
export type FeedbackItem = {
  id: string; uid: string; email: string; name: string; type: FeedbackType; subject: string; message: string;
  view?: string; ua?: string; status: FeedbackStatus; createdAt: Date | null; reply?: string; repliedAt?: Date | null;
};

export const TYPE_LABEL: Record<FeedbackType, string> = { feedback: "Feedback", issue: "Issue", idea: "Idea" };

const toDate = (v: unknown) => { const t = v as Timestamp | undefined; return t && typeof t.toDate === "function" ? t.toDate() : null; };
export const toItem = (id: string, d: Record<string, unknown>): FeedbackItem => ({
  id, uid: String(d.uid || ""), email: String(d.email || ""), name: String(d.name || ""),
  type: (d.type as FeedbackType) || "feedback", subject: String(d.subject || ""), message: String(d.message || ""),
  view: d.view as string | undefined, ua: d.ua as string | undefined, status: (d.status as FeedbackStatus) || "new",
  createdAt: toDate(d.createdAt), reply: d.reply as string | undefined, repliedAt: toDate(d.repliedAt),
});

export async function sendFeedback(f: { type: FeedbackType; subject: string; message: string; view?: string }) {
  const u = auth?.currentUser;
  if (!db || !u) throw new Error("Please log in first.");
  await addDoc(collection(db, "feedback"), {
    uid: u.uid, email: u.email || "", name: u.displayName || "", type: f.type,
    subject: f.subject.trim().slice(0, 120), message: f.message.trim().slice(0, 4000),
    view: f.view || "", ua: (typeof navigator !== "undefined" ? navigator.userAgent : "").slice(0, 200),
    status: "new", createdAt: serverTimestamp(),
  });
}

/** The signed-in user's own messages, newest first (sorted here, so no Firestore index is needed). */
export async function myFeedback(): Promise<FeedbackItem[]> {
  const uid = auth?.currentUser?.uid;
  if (!db || !uid) return [];
  const snap = await getDocs(query(collection(db, "feedback"), where("uid", "==", uid)));
  return snap.docs.map((d) => toItem(d.id, d.data())).sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
}

/** Replies the user has already seen (so the bell only announces new ones). */
const seenKey = (uid: string) => `seenReplies:${uid}`;
export const replyKey = (f: FeedbackItem) => `${f.id}:${f.repliedAt?.getTime() || 0}`;
export function seenReplies(uid: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(seenKey(uid)) || "[]")); } catch { return new Set(); }
}
export function markRepliesSeen(uid: string, items: FeedbackItem[]) {
  try { const s = seenReplies(uid); items.forEach((f) => { if (f.reply) s.add(replyKey(f)); }); localStorage.setItem(seenKey(uid), JSON.stringify([...s].slice(-200))); } catch { /* ignore */ }
}