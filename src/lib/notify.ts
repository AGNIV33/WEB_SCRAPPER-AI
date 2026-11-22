"use client";
/* In-app notifications: a small list kept in localStorage (per account, or "guest"), shown by the bell.
 * When the tab is in the background and the user allowed it, a browser notification is shown too. */
import { useCallback, useEffect, useState } from "react";

export type NoteKind = "success" | "error" | "info" | "warning";
export type Note = { id: string; kind: NoteKind; title: string; body?: string; at: number; read: boolean; view?: string };

const MAX = 30;
const keyFor = (uid: string | null) => `notes:${uid || "guest"}`;
const load = (uid: string | null): Note[] => { try { return JSON.parse(localStorage.getItem(keyFor(uid)) || "[]"); } catch { return []; } };

export function useNotifications(uid: string | null) {
  const [notes, setNotes] = useState<Note[]>(() => (typeof window === "undefined" ? [] : load(uid)));
  const [owner, setOwner] = useState(uid);
  if (owner !== uid) { setOwner(uid); setNotes(typeof window === "undefined" ? [] : load(uid)); } // switch lists on login/logout

  useEffect(() => { try { localStorage.setItem(keyFor(owner), JSON.stringify(notes)); } catch { /* ignore */ } }, [notes, owner]);

  const push = useCallback((n: Omit<Note, "id" | "at" | "read">) => {
    setNotes((l) => [{ ...n, id: Math.random().toString(36).slice(2), at: Date.now(), read: false }, ...l].slice(0, MAX));
    // Background tab: also show a system notification (only if the user already allowed it)
    try {
      if (document.hidden && "Notification" in window && Notification.permission === "granted") new Notification(n.title, { body: n.body, icon: "/icon.svg" });
    } catch { /* ignore */ }
  }, []);
  const markAllRead = useCallback(() => setNotes((l) => (l.some((n) => !n.read) ? l.map((n) => ({ ...n, read: true })) : l)), []);
  const remove = useCallback((id: string) => setNotes((l) => l.filter((n) => n.id !== id)), []);
  const clear = useCallback(() => setNotes([]), []);
  return { notes, unread: notes.filter((n) => !n.read).length, push, markAllRead, remove, clear };
}

export const ago = (t: number) => {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
};
