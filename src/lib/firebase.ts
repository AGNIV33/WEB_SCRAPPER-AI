import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, signInWithPopup, GoogleAuthProvider, sendPasswordResetEmail, sendEmailVerification,
  type Auth, type User,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

// Web config from Firebase console > Project settings > Your apps. These values are public by design;
// data is protected by Firestore security rules (see firestore.rules).
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// NEXT_PUBLIC_DISABLE_AUTH=1 turns accounts off (handy for local testing): everything unlocked, no login.
export const authEnabled = process.env.NEXT_PUBLIC_DISABLE_AUTH !== "1" && !!(config.apiKey && config.authDomain && config.projectId && config.appId);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
if (authEnabled) {
  app = getApps()[0] || initializeApp(config);
  auth = getAuth(app);
  db = getFirestore(app);
}

export { auth, db };
export type { User };

export function onUser(cb: (u: User | null) => void) {
  if (!auth) return () => {};
  return onAuthStateChanged(auth, cb);
}

const friendly = (e: unknown) => {
  const code = (e as { code?: string }).code || "";
  const map: Record<string, string> = {
    "auth/invalid-credential": "Wrong email or password.",
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/email-already-in-use": "An account with this email already exists. Log in instead.",
    "auth/weak-password": "Password is too weak (use at least 6 characters).",
    "auth/too-many-requests": "Too many tries. Wait a minute and try again.",
    "auth/operation-not-allowed": "Email/password sign-in is not enabled in Firebase yet.",
    "auth/network-request-failed": "Network error. Check your connection.",
    "auth/popup-closed-by-user": "The Google window was closed before signing in.",
    "auth/popup-blocked": "Your browser blocked the Google window. Allow pop-ups for this site and try again.",
    "auth/unauthorized-domain": "This website address is not allowed in Firebase yet (Authentication > Settings > Authorized domains).",
  };
  return new Error(map[code] || (e as Error).message);
};

export async function login(email: string, password: string) {
  if (!auth) throw new Error("Login is not configured");
  try { await signInWithEmailAndPassword(auth, email, password); } catch (e) { throw friendly(e); }
}

export async function signup(email: string, password: string) {
  if (!auth) throw new Error("Login is not configured");
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(cred.user).catch(() => {}); // proves the user owns the email
  } catch (e) { throw friendly(e); }
}

/** Emails a link to set a new password (also adds a password to an account that was made with Google). */
export async function resetPassword(email: string) {
  if (!auth) throw new Error("Login is not configured");
  try { await sendPasswordResetEmail(auth, email); } catch (e) { throw friendly(e); }
}

export async function logout() {
  if (auth) await signOut(auth);
}

/** One-click Google sign-in (Google must be enabled in Firebase > Authentication > Sign-in method). */
export async function loginWithGoogle() {
  if (!auth) throw new Error("Login is not configured");
  try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (e) { throw friendly(e); }
}

/** Firebase ID token for the logged-in user (sent to our API so the server knows who is calling). */
export async function idToken(): Promise<string | null> {
  try { return (await auth?.currentUser?.getIdToken()) || null; } catch { return null; }
}