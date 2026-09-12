import { db } from "@/lib/db";
import { withCors, corsPreflight } from "@/lib/cors";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET() {
  const applications = db.listApplications();
  return withCors({ applications });
}

export async function POST(request) {
  const data = await request.json();
  if (!data.company || !data.position) {
    return withCors({ error: "company and position are required" }, { status: 400 });
  }
  const app = db.createApplication(data);
  return withCors({ application: app }, { status: 201 });
}
