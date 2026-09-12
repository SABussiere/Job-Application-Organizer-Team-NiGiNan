// lib/firebaseClient.js — Firebase client SDK, initialized once for the
// browser. There is no server API layer anymore: components talk to
// Firestore directly (see lib/api.js), so this file is imported from
// client components only.
//
// The config values below are PUBLIC — they identify your Firebase project,
// they are not secrets. What actually protects each user's data is
// firestore.rules (checked on every read/write against request.auth.uid),
// not keeping this config hidden.
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const firestore = getFirestore(app);
