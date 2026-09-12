"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { COMM_TYPES, JOB_TYPE_SUGGESTIONS, STAGES, SECTION_TITLES, stageMeta } from "@/lib/constants";
import { suggestionValues } from "@/lib/filters";
import SuggestInput from "@/components/SuggestInput";
import { assembleResumeText } from "@/lib/matching";
import { dateRange, latexFileName } from "@/lib/latex";
import { formatDate } from "@/lib/followups";
import LatexPanel from "@/components/LatexPanel";
import ResumeSheetPanel from "@/components/ResumeSheetPanel";

/**
 * Builds the selection rows for the tailored resume: the application's own
 * ordered picks first, then every remaining master module, unchecked, so any
 * of them can be swapped in without leaving the modal.
 */
function buildRows(masterModules, selectedIds, matchSummary) {
  const matchById = new Map((matchSummary || []).map(m => [m.moduleId, m]));
  const byId = new Map(masterModules.map(m => [m.id, m]));
  const ordered = [];
  const seen = new Set();

  (selectedIds || []).forEach(id => {
    const module = byId.get(id);
    if (!module || seen.has(id)) return;
    seen.add(id);
    ordered.push({ module, included: true, match: matchById.get(id) || null });
  });

  masterModules.forEach(module => {
    if (seen.has(module.id)) return;
    ordered.push({ module, included: false, match: matchById.get(module.id) || null });
  });

  return ordered;
}

function reasonFor(row) {
  const { match, module } = row;
  if (module.alwaysInclude) return "always included";
  if (!match) return "";
  const hits = [...(match.matchedTags || []), ...(match.matchedWords || [])];
  if (hits.length) return `matched: ${hits.slice(0, 5).join(", ")}`;
  return "no overlap with this posting";
}

export default function ApplicationModal({ appId, onClose, onChanged, apps = [] }) {
  const [tab, setTab] = useState("details");
  const [app, setApp] = useState(null);
  const [form, setForm] = useState(null);
  const [modules, setModules] = useState([]);
  const [rows, setRows] = useState([]);
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [output, setOutput] = useState("preview"); // "preview" | "text" | "latex"
  const [profile, setProfile] = useState(null);
  const [latex, setLatex] = useState("");
  const [latexLoading, setLatexLoading] = useState(false);
  const [latexError, setLatexError] = useState("");
  const [tailoring, setTailoring] = useState(false);
  const [tailorError, setTailorError] = useState("");
  const [commType, setCommType] = useState("note");
  const [commDate, setCommDate] = useState(new Date().toISOString().slice(0, 10));
  const [commText, setCommText] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.getApplication(appId),
      api.listResumeModules(),
      api.getResumeProfile()
    ]).then(
      ([data, masterModules, resumeProfile]) => {
        if (cancelled) return;
        setApp(data);
        setModules(masterModules);
        setProfile(resumeProfile);
        // Cases saved before selections existed fall back to the full
        // master, which is what their resume text was built from.
        const initialIds = Array.isArray(data.resumeModuleIds)
          ? data.resumeModuleIds
          : masterModules.map(m => m.id);
        setRows(buildRows(masterModules, initialIds, null));
        setForm({
          company: data.company,
          position: data.position,
          requisitionId: data.requisitionId || "",
          jobType: data.jobType || "",
          dateApplied: data.dateApplied || "",
          status: data.status,
          followUpDate: data.followUpDate || "",
          location: data.location || "",
          jobUrl: data.jobUrl || "",
          notes: data.notes || ""
        });
        setResumeText(data.resumeVersion || "");
        setJobDescription(data.jobDescription || "");
      }
    );
    return () => { cancelled = true; };
  }, [appId]);

  if (!app || !form) return null;

  const suggest = {
    company: suggestionValues(apps, "company"),
    position: suggestionValues(apps, "position"),
    location: suggestionValues(apps, "location"),
    jobType: suggestionValues(apps, "jobType", JOB_TYPE_SUGGESTIONS)
  };

  const selectedRows = rows.filter(r => r.included);
  const selectedIds = selectedRows.map(r => r.module.id);
  const selectedModules = selectedRows.map(r => r.module);

  async function saveDetails() {
    await api.updateApplication(appId, form);
    onChanged();
    onClose();
  }

  async function deleteCase() {
    if (!confirm("Delete this case? This can't be undone.")) return;
    await api.deleteApplication(appId);
    onChanged();
    onClose();
  }

  async function saveResume() {
    await api.updateApplication(appId, {
      resumeVersion: resumeText,
      resumeModuleIds: selectedIds
    });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1200);
  }

  function resetFromMaster() {
    const next = buildRows(modules, modules.map(m => m.id), null);
    applyRows(next);
  }

  /** Any change to the selection or its order rebuilds the text and LaTeX. */
  function applyRows(next) {
    setRows(next);
    const chosen = next.filter(r => r.included).map(r => r.module);
    setResumeText(assembleResumeText(chosen, { sort: false }));
    setLatex("");
    if (output === "latex") renderLatex(chosen.map(m => m.id));
  }

  function toggleIncluded(moduleId) {
    applyRows(
      rows.map(r => (r.module.id === moduleId ? { ...r, included: !r.included } : r))
    );
  }

  function moveRow(index, direction) {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= rows.length) return;
    const next = rows.slice();
    [next[index], next[target]] = [next[target], next[index]];
    applyRows(next);
  }

  async function renderLatex(ids = selectedIds) {
    setLatexLoading(true);
    setLatexError("");
    try {
      setLatex(await api.renderLatex(ids));
    } catch (e) {
      setLatexError(e.message);
    } finally {
      setLatexLoading(false);
    }
  }

  function showOutput(which) {
    setOutput(which);
    if (which === "latex" && !latex) renderLatex();
  }

  async function tailorFromJD() {
    if (!jobDescription.trim()) return;
    setTailoring(true);
    setTailorError("");
    try {
      const result = await api.tailorApplication(appId, jobDescription.trim());
      setApp(result.application);
      const ids = result.application.resumeModuleIds || [];
      const next = buildRows(modules, ids, result.matchSummary);
      setRows(next);
      setResumeText(result.application.resumeVersion);
      setLatex("");
      if (output === "latex") renderLatex(ids);
    } catch (e) {
      setTailorError(e.message);
    } finally {
      setTailoring(false);
    }
  }

  async function logComm(e) {
    e.preventDefault();
    if (!commText.trim()) return;
    const updated = await api.addCommunication(appId, {
      type: commType,
      date: commDate,
      text: commText.trim()
    });
    setApp(updated);
    setCommText("");
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <button className="modal-close" onClick={onClose}>&times;</button>

        <div className="modal-heading-row">
          <h2 className="modal-heading">{app.position || "Untitled position"}</h2>
          <p className="modal-subheading">
            {app.company}
            {app.requisitionId ? ` · ${app.requisitionId}` : ""}
          </p>
        </div>

        <div className="modal-tabs">
          <button className={`modal-tab-btn ${tab === "details" ? "active" : ""}`} onClick={() => setTab("details")}>Details</button>
          <button className={`modal-tab-btn ${tab === "resume" ? "active" : ""}`} onClick={() => setTab("resume")}>Tailored Resume</button>
          <button className={`modal-tab-btn ${tab === "comms" ? "active" : ""}`} onClick={() => setTab("comms")}>Communications</button>
        </div>

        {tab === "details" && (
          <div>
            <div className="mform-row">
              <div className="mfield">
                <label>Company</label>
                <SuggestInput
                  value={form.company}
                  onChange={v => setForm({ ...form, company: v })}
                  options={suggest.company}
                />
              </div>
              <div className="mfield">
                <label>Position</label>
                <SuggestInput
                  value={form.position}
                  onChange={v => setForm({ ...form, position: v })}
                  options={suggest.position}
                />
              </div>
            </div>
            <div className="mform-row">
              <div className="mfield">
                <label>Job type</label>
                <SuggestInput
                  value={form.jobType}
                  onChange={v => setForm({ ...form, jobType: v })}
                  options={suggest.jobType}
                  placeholder="Backend"
                />
              </div>
              <div className="mfield">
                <label>Location</label>
                <SuggestInput
                  value={form.location}
                  onChange={v => setForm({ ...form, location: v })}
                  options={suggest.location}
                />
              </div>
            </div>
            <div className="mform-row">
              <div className="mfield">
                <label>Date applied</label>
                <input type="date" value={form.dateApplied} onChange={e => setForm({ ...form, dateApplied: e.target.value })} />
              </div>
              <div className="mfield">
                <label>Stage</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  {STAGES.map(s => (
                    <option key={s} value={s}>{stageMeta(s).label}</option>
                  ))}
                </select>
              </div>
              <div className="mfield">
                <label>Follow up on</label>
                <input type="date" value={form.followUpDate} onChange={e => setForm({ ...form, followUpDate: e.target.value })} />
              </div>
            </div>
            <div className="mform-row">
              <div className="mfield">
                <label>Requisition ID</label>
                <input
                  value={form.requisitionId}
                  placeholder="REQ-20481"
                  onChange={e => setForm({ ...form, requisitionId: e.target.value })}
                />
              </div>
              <div className="mfield">
                <label>Job posting link</label>
                <input value={form.jobUrl} onChange={e => setForm({ ...form, jobUrl: e.target.value })} />
              </div>
            </div>
            <div className="mfield">
              <label>Notes</label>
              <textarea rows={4} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Referral, salary range, interview prep notes..." />
            </div>
            <div className="modal-actions">
              <button className="btn-danger" onClick={deleteCase}>Delete case</button>
              <button className="btn-primary" onClick={saveDetails}>Save changes</button>
            </div>
          </div>
        )}

        {tab === "resume" && (
          <div>
            <div className="tailor-box">
              <label className="tailor-label">Job description</label>
              <textarea
                className="jd-input"
                rows={5}
                placeholder="Paste the job posting text here..."
                value={jobDescription}
                onChange={e => setJobDescription(e.target.value)}
              />
              <div className="tailor-actions">
                <button className="btn-primary" onClick={tailorFromJD} disabled={tailoring || !jobDescription.trim()}>
                  {tailoring ? "Matching..." : "Generate tailored resume"}
                </button>
                <button className="btn-secondary-inline" onClick={resetFromMaster}>
                  Reset to full master
                </button>
                {tailorError && <span className="tailor-error">{tailorError}</span>}
              </div>
            </div>

            {modules.length === 0 ? (
              <p className="hint" style={{ marginTop: 16 }}>
                No master resume modules yet. Add some on the Master Resume page first.
              </p>
            ) : (
              <div className="match-summary">
                <p className="hint" style={{ margin: "16px 0 8px" }}>
                  {selectedIds.length} of {rows.length} modules included. Check or
                  uncheck to swap a section in or out, and use the arrows to
                  reorder — sections land in whatever order their first module
                  sits, so moving a module can move its whole section.
                </p>
                <ul className="match-list ordered">
                  {rows.map((row, i) => (
                    <li key={row.module.id} className={row.included ? "matched" : "skipped"}>
                      <div className="match-order">
                        <button
                          disabled={i === 0}
                          onClick={() => moveRow(i, "up")}
                          title="Move up"
                        >↑</button>
                        <button
                          disabled={i === rows.length - 1}
                          onClick={() => moveRow(i, "down")}
                          title="Move down"
                        >↓</button>
                      </div>
                      <label className="match-check">
                        <input
                          type="checkbox"
                          checked={row.included}
                          onChange={() => toggleIncluded(row.module.id)}
                        />
                        <span className="match-body">
                          <span className="match-title">
                            {row.module.title || "(untitled)"}
                            {row.module.organization ? ` — ${row.module.organization}` : ""}
                          </span>
                          <span className="match-meta">
                            <span className="match-section">
                              {SECTION_TITLES[row.module.type] || "Additional"}
                            </span>
                            {dateRange(row.module) ? ` · ${dateRange(row.module)}` : ""}
                            {reasonFor(row) ? ` · ${reasonFor(row)}` : ""}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="output-tabs">
              <button
                className={`output-tab ${output === "preview" ? "active" : ""}`}
                onClick={() => showOutput("preview")}
              >Preview</button>
              <button
                className={`output-tab ${output === "text" ? "active" : ""}`}
                onClick={() => showOutput("text")}
              >Plain text</button>
              <button
                className={`output-tab ${output === "latex" ? "active" : ""}`}
                onClick={() => showOutput("latex")}
              >LaTeX</button>
            </div>

            {output === "preview" && (
              <ResumeSheetPanel
                profile={profile}
                modules={selectedModules}
                moduleIds={selectedIds}
                label={[app.company, app.position].filter(Boolean).join(" — ")}
              />
            )}

            {output === "text" && (
              <>
                <p className="hint">
                  This text is what gets saved as the tailored resume. Edit
                  freely — it never changes your master modules. Changing the
                  selection above rebuilds it.
                </p>
                <textarea className="resume-input" value={resumeText} onChange={e => setResumeText(e.target.value)} />
              </>
            )}

            {output === "latex" && (
              <LatexPanel
                latex={latex}
                loading={latexLoading}
                error={latexError}
                fileName={latexFileName(app.company, app.position)}
                onRefresh={() => renderLatex()}
              />
            )}

            <div className="modal-actions">
              <span className="hint" style={{ margin: 0 }}>
                {app.tailoredFrom
                  ? `Last tailored ${formatDate(app.tailoredFrom.generatedAt.slice(0, 10))}`
                  : "Not tailored from a posting yet"}
              </span>
              <button className="btn-primary" onClick={saveResume}>
                {savedFlash ? "Saved ✓" : "Save tailored resume"}
              </button>
            </div>
          </div>
        )}

        {tab === "comms" && (
          <div>
            <form className="comm-form" onSubmit={logComm}>
              <select value={commType} onChange={e => setCommType(e.target.value)}>
                {COMM_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <input type="date" value={commDate} onChange={e => setCommDate(e.target.value)} />
              <input type="text" placeholder="What happened?" value={commText} onChange={e => setCommText(e.target.value)} />
              <button type="submit" className="btn-primary">Log</button>
            </form>
            <ul className="comm-list">
              {(app.communications || []).length === 0 && (
                <li className="comm-empty">No communications logged yet.</li>
              )}
              {(app.communications || []).map(c => (
                <li key={c.id}>
                  <div className="c-meta">{c.type} · {formatDate(c.date)}</div>
                  <div>{c.text}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
