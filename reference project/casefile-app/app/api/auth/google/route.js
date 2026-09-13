// GET /api/auth/google — "Connect Gmail" entry point. Redirects the browser
// to Google's OAuth consent screen.
// DELETE /api/auth/google — "Disconnect Gmail": clears saved tokens so the
// next Sync/Connect starts a fresh OAuth flow (lets you switch accounts).

import { getAuthUrl } from "@/lib/googleAuth";
import { db } from "@/lib/db";
import { withCors, corsPreflight } from "@/lib/cors";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET() {
  return Response.redirect(getAuthUrl());
}

export async function DELETE() {
  db.clearGoogleTokens();
  return withCors({ disconnected: true });
}
