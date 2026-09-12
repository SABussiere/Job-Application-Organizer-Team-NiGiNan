import { db } from "@/lib/db";
import { withCors, corsPreflight } from "@/lib/cors";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET() {
  return withCors({ masterResume: db.getMasterResume() });
}

export async function PUT(request) {
  const { text } = await request.json();
  const masterResume = db.setMasterResume(text || "");
  return withCors({ masterResume });
}
