import { db } from "@/lib/db";
import { withCors, corsPreflight } from "@/lib/cors";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET() {
  return withCors({ modules: db.listMasterModules() });
}

export async function POST(request) {
  const data = await request.json();
  const module = db.createMasterModule(data);
  return withCors({ module }, { status: 201 });
}
