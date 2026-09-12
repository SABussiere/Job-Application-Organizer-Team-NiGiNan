import { db } from "@/lib/db";
import { withCors, corsPreflight } from "@/lib/cors";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET(request, { params }) {
  const app = db.getApplication(params.id);
  if (!app) return withCors({ error: "not found" }, { status: 404 });
  return withCors({ application: app });
}

export async function PATCH(request, { params }) {
  const patch = await request.json();
  const app = db.updateApplication(params.id, patch);
  if (!app) return withCors({ error: "not found" }, { status: 404 });
  return withCors({ application: app });
}

export async function DELETE(request, { params }) {
  const ok = db.deleteApplication(params.id);
  if (!ok) return withCors({ error: "not found" }, { status: 404 });
  return withCors({ deleted: true });
}
