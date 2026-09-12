"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "signin") {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
    } catch (err) {
      // Firebase error messages come prefixed with "Firebase: " — trim that
      // off so it reads like a normal, human error.
      setError(err.message.replace(/^Firebase:\s*/, ""));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-glow auth-glow-a" aria-hidden="true" />
      <div className="auth-glow auth-glow-b" aria-hidden="true" />
      <div className="auth-glow auth-glow-c" aria-hidden="true" />

      <div className="auth-shell">
        <img src="/logo.png" alt="Casefile logo" className="auth-badge" />
        <div className="auth-title-row">
          <p className="auth-brand">Casefile</p>
          <p className="auth-tagline">Track applications, tailor resumes, land the offer.</p>
        </div>

        <div className="auth-card">
          <h2>{mode === "signin" ? "Sign in" : "Create your account"}</h2>
          <p className="hint">
            {mode === "signin"
              ? "Your cases and master resume are private to your account."
              : "Takes a few seconds — just an email and a password."}
          </p>
          <form onSubmit={submit}>
            <div className="mfield" style={{ marginBottom: 14 }}>
              <label>Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div className="mfield" style={{ marginBottom: 14 }}>
              <label>Password</label>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="tailor-error" style={{ marginBottom: 12 }}>{error}</p>}
            <button className="btn-primary" type="submit" disabled={busy} style={{ width: "100%" }}>
              {busy ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
          <p className="hint" style={{ marginTop: 16, marginBottom: 0 }}>
            {mode === "signin" ? (
              <>No account yet?{" "}
                <button type="button" className="link-btn" onClick={() => { setMode("signup"); setError(""); }}>
                  Create one
                </button>
              </>
            ) : (
              <>Already have an account?{" "}
                <button type="button" className="link-btn" onClick={() => { setMode("signin"); setError(""); }}>
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}