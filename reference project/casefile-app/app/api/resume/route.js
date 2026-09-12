import { db } from "@/lib/db";
import { withCors, corsPreflight } from "@/lib/cors";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET() {
  return withCors({
    masterResume: db.getMasterResume(),
    masterStories: db.getMasterStories()
  });
}

export async function PUT(request) {
  const { text, stories } = await request.json();
  const masterResume = db.setMasterResume(text || "");
  const masterStories = db.setMasterStories(stories || []);
  return withCors({ masterResume, masterStories });
}
