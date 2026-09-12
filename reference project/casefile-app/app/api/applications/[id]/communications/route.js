import { db } from "@/lib/db";
import { withCors, corsPreflight } from "@/lib/cors";

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(request, { params }) {
  const comm = await request.json();
  if (!comm.text) return withCors({ error: "text is required" }, { status: 400 });
  const app = db.addCommunication(params.id, comm);
  if (!app) return withCors({ error: "not found" }, { status: 404 });
  return withCors({ application: app }, { status: 201 });
}
