import { db } from "@/lib/db";
import { renderLatexResume } from "@/lib/latex";
import { withCors, corsPreflight } from "@/lib/cors";

export async function OPTIONS() {
  return corsPreflight();
}

// Full master resume, in the conventional section order.
export async function GET() {
  const latex = renderLatexResume(db.getResumeProfile(), db.listMasterModules(), {
    sortByTypeOrder: true
  });
  return withCors({ latex });
}

// A specific selection of modules, rendered in exactly the order given —
// this is what the tailored-resume view posts after the user reorders or
// unchecks modules, so the preview matches what they see on screen.
export async function POST(request) {
  const { moduleIds } = await request.json();
  if (!Array.isArray(moduleIds)) {
    return withCors({ error: "moduleIds must be an array" }, { status: 400 });
  }
  const modules = db.listMasterModulesByIds(moduleIds);
  const latex = renderLatexResume(db.getResumeProfile(), modules);
  return withCors({ latex, moduleCount: modules.length });
}
