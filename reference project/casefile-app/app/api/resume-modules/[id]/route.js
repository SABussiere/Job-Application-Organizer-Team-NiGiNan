import { db } from "@/lib/db";
import { withCors, corsPreflight } from "@/lib/cors";

export async function OPTIONS() {
  return corsPreflight();
}

export async function PATCH(request, { params }) {
  const patch = await request.json();
  const module = db.updateMasterModule(params.id, patch);
  if (!module) return withCors({ error: "not found" }, { status: 404 });
  return withCors({ module });
}

export async function DELETE(request, { params }) {
  const ok = db.deleteMasterModule(params.id);
  if (!ok) return withCors({ error: "not found" }, { status: 404 });
  return withCors({ deleted: true });
}
