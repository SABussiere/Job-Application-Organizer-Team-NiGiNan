import { db } from "@/lib/db";
import { withCors, corsPreflight } from "@/lib/cors";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET() {
  return withCors({ profile: db.getResumeProfile() });
}

export async function PATCH(request) {
  const patch = await request.json();
  return withCors({ profile: db.updateResumeProfile(patch) });
}
