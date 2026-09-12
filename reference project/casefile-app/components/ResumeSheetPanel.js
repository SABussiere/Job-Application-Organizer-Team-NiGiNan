"use client";

import ResumePreview from "@/components/ResumePreview";

/** Builds the /print URL carrying the exact module order being previewed. */
export function printUrl(moduleIds, label) {
  const params = new URLSearchParams();
  if (moduleIds && moduleIds.length) params.set("ids", moduleIds.join(","));
  if (label) params.set("label", label);
  const query = params.toString();
  return query ? `/print?${query}` : "/print";
}

/**
 * The on-page resume: a letter-sized sheet you can read, plus a Save as PDF
 * action. Printing happens on the bare /print route rather than here, since
 * printing in place misparginates inside the case modal.
 */
export default function ResumeSheetPanel({ profile, modules, moduleIds, label, loading }) {
  function openPrint() {
    window.open(printUrl(moduleIds, label), "_blank", "noopener");
  }

  return (
    <div className="sheet-panel">
      <div className="latex-actions">
        <button className="btn-primary" onClick={openPrint} disabled={loading}>
          Save as PDF ↗
        </button>
        <span className="latex-hint">
          Opens a print-only tab and your browser&apos;s print dialog. Pick
          &ldquo;Save as PDF&rdquo; as the destination. This is an
          approximation of the LaTeX typography — the LaTeX tab is the
          authority on exact output.
        </span>
      </div>

      {loading ? (
        <p className="hint">Loading preview...</p>
      ) : (
        <div className="sheet-frame">
          <ResumePreview profile={profile} modules={modules} />
        </div>
      )}
    </div>
  );
}
