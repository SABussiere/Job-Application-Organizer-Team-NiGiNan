import { db } from "@/lib/db";
import { withCors, corsPreflight } from "@/lib/cors";

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(request, { params }) {
  const { direction } = await request.json();
  if (direction !== "up" && direction !== "down") {
    return withCors({ error: "direction must be 'up' or 'down'" }, { status: 400 });
  }
  const modules = db.reorderMasterModule(params.id, direction);
  if (!modules) return withCors({ error: "not found" }, { status: 404 });
  return withCors({ modules });
}
