"use client";

import { useState } from "react";

// Overleaf's documented "Open in Overleaf" entry point. Posting the source
// as `encoded_snip` opens a new project with it, which is the cheapest way
// to get an actual compiled PDF without shipping a TeX distribution.
const OVERLEAF_URL = "https://www.overleaf.com/docs";

/**
 * Shows generated LaTeX with copy, download and compile-in-Overleaf actions.
 */
export default function LatexPanel({ latex, fileName, loading, error, onRefresh }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(latex || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard access can be blocked (insecure origin, denied permission);
      // the preview below is still selectable by hand in that case.
      setCopied(false);
    }
  }

  function download() {
    const blob = new Blob([latex || ""], { type: "application/x-tex" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName || "resume.tex";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // A real form POST rather than fetch: the response is a page Overleaf
  // wants to render in a new tab, not data for us to read.
  function openInOverleaf() {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = OVERLEAF_URL;
    form.target = "_blank";
    form.rel = "noopener";

    const add = (name, value) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    };
    add("encoded_snip", encodeURIComponent(latex || ""));
    add("engine", "pdflatex");

    document.body.appendChild(form);
    form.submit();
    form.remove();
  }

  return (
    <div className="latex-panel">
      <div className="latex-actions">
        <button className="btn-primary" onClick={openInOverleaf} disabled={!latex}>
          Compile PDF in Overleaf ↗
        </button>
        <button className="btn-secondary-inline" onClick={copy} disabled={!latex}>
          {copied ? "Copied ✓" : "Copy LaTeX"}
        </button>
        <button className="btn-secondary-inline" onClick={download} disabled={!latex}>
          Download .tex
        </button>
        {onRefresh && (
          <button className="btn-secondary-inline" onClick={onRefresh} disabled={loading}>
            {loading ? "Rendering..." : "Regenerate"}
          </button>
        )}
      </div>
      <p className="latex-hint">
        Overleaf opens a new project with this source and compiles it with
        pdfLaTeX — that&apos;s your rendered PDF. This is Jake&apos;s Resume
        template, so the output is the standard one-page layout.
      </p>

      {error ? (
        <p className="tailor-error">{error}</p>
      ) : (
        <pre className="latex-preview">{loading ? "Rendering..." : latex || "(nothing to render yet)"}</pre>
      )}
    </div>
  );
}
