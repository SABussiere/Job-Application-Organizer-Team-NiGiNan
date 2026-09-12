import { db } from "@/lib/db";
import { selectModules, assembleResumeText } from "@/lib/matching";
import { withCors, corsPreflight } from "@/lib/cors";

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(request, { params }) {
  const { jobDescription } = await request.json();
  if (!jobDescription || !jobDescription.trim()) {
    return withCors({ error: "jobDescription is required" }, { status: 400 });
  }

  const app = db.getApplication(params.id);
  if (!app) return withCors({ error: "application not found" }, { status: 404 });

  const modules = db.listMasterModules();
  if (modules.length === 0) {
    return withCors(
      { error: "No master resume modules yet — add some on the Master Resume page first." },
      { status: 400 }
    );
  }

  const { selected, details } = selectModules(jobDescription, modules);
  const resumeVersion = assembleResumeText(selected);

  const updated = db.updateApplication(params.id, {
    resumeVersion,
    jobDescription,
    tailoredFrom: {
      generatedAt: new Date().toISOString(),
      moduleCount: selected.length,
      totalModules: modules.length
    }
  });

  // Return per-module match detail too, so the UI can show *why* each
  // module was picked (matched tags/words) — keeps the matching transparent
  // instead of a black box.
  const matchSummary = details
    .sort((a, b) => b.score - a.score)
    .map(d => ({
      moduleId: d.module.id,
      title: d.module.title,
      score: d.score,
      alwaysIncluded: !!d.module.alwaysInclude,
      matchedTags: d.matchedTags,
      matchedWords: d.matchedWords
    }));

  return withCors({ application: updated, matchSummary });
}
