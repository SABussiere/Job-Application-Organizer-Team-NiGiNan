// GET /api/email/pending — lists everything /api/email/sync has queued that
// the user hasn't confirmed or dismissed yet. Read-only; confirming/
// dismissing one entry lives in the [id]/route.js sibling.

import { db } from "@/lib/db";
import { withCors, corsPreflight } from "@/lib/cors";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET() {
  return withCors({ pending: db.listPendingEmailApplications() });
}
