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
  const selectedIds = selected.map(m => m.id);

  const updated = db.updateApplication(params.id, {
    resumeVersion,
    resumeModuleIds: selectedIds,
    jobDescription,
    tailoredFrom: {
      generatedAt: new Date().toISOString(),
      moduleCount: selected.length,
      totalModules: modules.length
    }
  });

  // Return match detail for EVERY master module — not just the ones that
  // made the automatic cut — so the UI can show the full picture (including
  // modules that got left out) and let the user check, uncheck and reorder
  // any of them. The whole module rides along so the client can reassemble
  // the resume text itself when the selection changes, without a round trip.
  const chosen = new Set(selectedIds);
  const byId = new Map(
    scoreModules(jobDescription, modules).map(d => [
      d.module.id,
      {
        moduleId: d.module.id,
        module: d.module,
        score: d.score,
        alwaysIncluded: !!d.module.alwaysInclude,
        included: chosen.has(d.module.id),
        matchedTags: d.matchedTags,
        matchedWords: d.matchedWords
      }
    ])
  );

  // Selected modules first, in the order they'll appear in the resume, then
  // everything that was left out — so the list reads top to bottom like the
  // document it produces.
  const matchSummary = [
    ...selectedIds.map(id => byId.get(id)),
    ...modules.filter(m => !chosen.has(m.id)).map(m => byId.get(m.id))
  ].filter(Boolean);

  return withCors({ application: updated, matchSummary });
}
