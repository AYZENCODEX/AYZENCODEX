import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { logger } from "./logger";

let initialized = false;

export function getFirebaseAdmin(): boolean {
  if (initialized) return true;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    logger.warn("Firebase Admin SDK not configured — FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY required");
    return false;
  }

  try {
    if (!getApps().length) {
      initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    }
    initialized = true;
    logger.info("Firebase Admin SDK initialized");
    return true;
  } catch (err: any) {
    logger.error({ err: err?.message }, "Failed to initialize Firebase Admin SDK");
    return false;
  }
}

export async function verifyFirebaseToken(idToken: string): Promise<{ uid: string; email?: string; name?: string; picture?: string } | null> {
  if (!getFirebaseAdmin()) return null;
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    return { uid: decoded.uid, email: decoded.email, name: decoded.name, picture: decoded.picture };
  } catch (err: any) {
    logger.warn({ err: err?.message }, "Firebase token verification failed");
    return null;
  }
}
