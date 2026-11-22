"use client";
/* The user's profile (name and country). Stored in users/{uid} next to the sign-in counters. */
import { EmailAuthProvider, linkWithCredential, updateProfile } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

/** True when the user still has to fill in the profile form (country missing). */
export async function needsProfile(uid: string): Promise<boolean> {
  if (!db) return false;
  try { return !(await getDoc(doc(db, "users", uid))).data()?.country; } catch { return false; }
}

/** Saves name + country; for Google sign-ups it can also add a password so they can log in with email too. */
export async function completeProfile(f: { name: string; country: string; password?: string }) {
  const u = auth?.currentUser;
  if (!db || !u) throw new Error("Please log in first.");
  if (f.password) {
    try { await linkWithCredential(u, EmailAuthProvider.credential(u.email || "", f.password)); }
    catch (e) {
      const code = (e as { code?: string }).code || "";
      if (code === "auth/requires-recent-login") throw new Error("For safety, please log out, sign in with Google again, and then finish this form.");
      if (code === "auth/weak-password") throw new Error("Password is too weak (use at least 6 characters).");
      if (code === "auth/provider-already-linked" || code === "auth/credential-already-in-use" || code === "auth/email-already-in-use") { /* already has a password: carry on */ }
      else throw e;
    }
  }
  await updateProfile(u, { displayName: f.name.trim() });
  await setDoc(doc(db, "users", u.uid), { displayName: f.name.trim(), country: f.country, email: u.email ?? "" }, { merge: true });
}
