// Server-side Firebase access for Vercel functions.
// Needs the FIREBASE_SERVICE_ACCOUNT environment variable in Vercel:
// the service-account JSON from Firebase → Project settings → Service accounts.
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

let db = null;

function readServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || "";
  if (!raw.trim()) return null;
  try {
    const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const sa = JSON.parse(text);
    if (sa.private_key) sa.private_key = String(sa.private_key).replace(/\\n/g, "\n");
    return sa;
  } catch {
    return null;
  }
}

export function configured() {
  return !!readServiceAccount();
}

export function getDb() {
  if (db) return db;
  const sa = readServiceAccount();
  if (!sa) throw new Error("FIREBASE_SERVICE_ACCOUNT is missing or not valid JSON");
  const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(sa), projectId: sa.project_id });
  db = getFirestore(app);
  return db;
}
