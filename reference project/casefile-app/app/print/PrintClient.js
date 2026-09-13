"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import ResumePreview from "@/components/ResumePreview";

function applyModuleOverrides(modules, overrides = {}) {
  return modules.map(module => {
    const override = overrides?.[module.id];
    if (!override) return module;
    return {
      ...module,
      content: typeof override.content === "string" ? override.content : module.content,
      bullets: Array.isArray(override.bullets)
        ? override.bullets.map(String).filter(Boolean)
        : module.bullets
    };
  });
}

/**
 * A bare page holding nothing but the resume sheet, so the browser's print
 * engine has no app chrome, scroll container or hidden-but-present siblings
 * to trip over. `?ids=` carries the exact module order the caller is looking
 * at, which is how an unsaved tailored selection prints correctly.
 */
export default function PrintClient() {
  const params = useSearchParams();
  const idsParam = params.get("ids");
  const appId = params.get("appId");
  const label = params.get("label") || "";

  const [profile, setProfile] = useState(null);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    document.documentElement.classList.add("print-route");
    return () => document.documentElement.classList.remove("print-route");
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.getResumeProfile(),
      api.listResumeModules(),
      appId ? api.getApplication(appId) : Promise.resolve(null)
    ])
      .then(([p, all, app]) => {
        if (cancelled) return;
        setProfile(p);
        const sourceModules = applyModuleOverrides(all, app?.resumeModuleOverrides);
        if (idsParam) {
          const wanted = idsParam.split(",").filter(Boolean);
          const byId = new Map(sourceModules.map(m => [m.id, m]));
          setModules(wanted.map(id => byId.get(id)).filter(Boolean));
        } else {
          setModules(sourceModules);
        }
        setLoading(false);
      })
      .catch(e => {
        if (cancelled) return;
        setError(e.message);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [idsParam, appId]);

  // Open the print dialog once the sheet is actually on screen. The frame
  // wait keeps Safari from printing a blank first paint.
  useEffect(() => {
    if (loading || error) return;
    const id = requestAnimationFrame(() => window.print());
    return () => cancelAnimationFrame(id);
  }, [loading, error]);

  return (
    <>
      <div className="print-bar">
        <button className="btn-primary" onClick={() => window.print()} disabled={loading}>
          Print / Save as PDF
        </button>
        <button className="btn-secondary-inline" onClick={() => window.close()}>
          Close tab
        </button>
        <p className="hint">
          {label ? `${label} — ` : ""}
          Choose &ldquo;Save as PDF&rdquo; as the destination, paper Letter,
          margins Default. Turn off headers and footers to drop the URL and
          date from the page.
        </p>
      </div>

      <div className="print-stage">
        {error ? (
          <p className="tailor-error" style={{ color: "#fff" }}>{error}</p>
        ) : loading ? (
          <p className="hint" style={{ color: "#fff" }}>Loading resume...</p>
        ) : (
          <ResumePreview profile={profile} modules={modules} />
        )}
      </div>
    </>
  );
}
