import { db } from "@/lib/db";
import { scoreModules, selectModules, assembleResumeText } from "@/lib/matching";
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

  const { selected } = selectModules(jobDescription, modules);
  const resumeVersion = assembleResumeText(selected);
  const selectedIds = new Set(selected.map(m => m.id));

  const updated = db.updateApplication(params.id, {
    resumeVersion,
    jobDescription,
    tailoredFrom: {
      generatedAt: new Date().toISOString(),
      moduleCount: selected.length,
      totalModules: modules.length
    }
  });

  // Return match detail for EVERY master module — not just the ones that
  // made the automatic cut — so the UI can show the full picture (including
  // modules that got left out) and let the user manually check/uncheck any
  // of them. `content`/`order` ride along so the client can reassemble the
  // resume text itself when the user overrides the selection, without a
  // round trip.
  const matchSummary = scoreModules(jobDescription, modules)
    .map(d => ({
      moduleId: d.module.id,
      title: d.module.title,
      content: d.module.content,
      order: d.module.order,
      score: d.score,
      alwaysIncluded: !!d.module.alwaysInclude,
      included: selectedIds.has(d.module.id),
      matchedTags: d.matchedTags,
      matchedWords: d.matchedWords
    }))
    // .sort((a, b) => b.score - a.score);

  return withCors({ application: updated, matchSummary });
}
