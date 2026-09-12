import { db } from "@/lib/db";
import { renderLatexResume } from "@/lib/latex";
import { withCors, corsPreflight } from "@/lib/cors";

export async function OPTIONS() {
  return corsPreflight();
}

// The tailored resume for one application, as LaTeX. Applications created
// before module selections existed have no resumeModuleIds, so they fall
// back to the full master resume.
export async function GET(request, { params }) {
  const app = db.getApplication(params.id);
  if (!app) return withCors({ error: "not found" }, { status: 404 });

  const modules = Array.isArray(app.resumeModuleIds)
    ? db.listMasterModulesByIds(app.resumeModuleIds)
    : db.listMasterModules();

  const latex = renderLatexResume(db.getResumeProfile(), modules, {
    sortByTypeOrder: !Array.isArray(app.resumeModuleIds)
  });
  return withCors({ latex, moduleCount: modules.length });
}
