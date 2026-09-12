// GET /api/auth/google/callback — Google redirects here after the user
// approves (or denies) the consent screen. Exchanges the ?code= for tokens
// and saves them, so future syncs don't need the user to re-auth.

import { exchangeCodeForTokens } from "@/lib/googleAuth";
import { db } from "@/lib/db";

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) return Response.redirect(`${origin}/?gmail=denied`);

  try {
    const tokens = await exchangeCodeForTokens(code);
    db.saveGoogleTokens(tokens);
    return Response.redirect(`${origin}/?gmail=connected`);
  } catch (err) {
    console.error("Google OAuth token exchange failed:", err);
    return Response.redirect(`${origin}/?gmail=error`);
  }
}
