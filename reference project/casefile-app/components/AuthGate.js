"use client";

import { useAuth } from "@/components/AuthProvider";
import LoginScreen from "@/components/LoginScreen";

// Renders children only once we know someone is signed in. While Firebase
// is still checking for an existing session, and whenever it comes back
// signed-out, we short-circuit before the rest of the app (which assumes
// auth.currentUser exists) ever mounts.
export default function AuthGate({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <p className="hint" style={{ padding: 40, textAlign: "center" }}>Loading...</p>;
  }

  if (!user) {
    return <LoginScreen />;
  }

  return children;
}
