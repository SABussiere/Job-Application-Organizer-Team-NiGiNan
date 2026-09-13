"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import {
  COMM_TYPES,
  EMPLOYMENT_TYPES,
  JOB_TYPE_SUGGESTIONS,
  LOCATION_TYPES,
  STAGES,
  SECTION_TITLES,
  stageMeta
} from "@/lib/constants";
import { isLocationResolved } from "@/lib/geocode";
import { suggestionValues } from "@/lib/filters";
import SuggestInput from "@/components/SuggestInput";
import LocationInput from "@/components/LocationInput";
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

export default function ApplicationModal({ appId, onClose, onChanged, apps = [], origin }) {
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
  const [detailsError, setDetailsError] = useState("");

  // Folder-opening / page-flip animation. Handled imperatively via refs
  // rather than React state driving the transform, because this is the
  // classic FLIP technique: it needs to read the modal's actual laid-out
  // position *after* mount, then animate from there, which a plain
  // declarative style prop can't express without an extra render.
  const [closing, setClosing] = useState(false);
  const [flipping, setFlipping] = useState(false);
  const modalRef = useRef(null);
  const hasOpenedRef = useRef(false);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    reducedMotionRef.current =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  }, []);

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
          location: data.location || "Unknown",
          geo: data.geo || null,
          employmentType: data.employmentType || "Unknown",
          locationType: data.locationType || "Unknown",
          jobUrl: data.jobUrl || "",
          notes: data.notes || ""
        });
        setResumeText(data.resumeVersion || "");
        setJobDescription(data.jobDescription || "");
      }
    );
    return () => { cancelled = true; };
  }, [appId]);

  // Runs the first time the modal actually has something to show (data
  // loads after mount, so the ref isn't attached on the very first pass).
  // Guarded by hasOpenedRef so a later data refresh (saving, tailoring)
  // never replays the entrance.
  useLayoutEffect(() => {
    if (hasOpenedRef.current) return;
    const el = modalRef.current;
    if (!el) return;
    hasOpenedRef.current = true;
    if (reducedMotionRef.current) return;

    if (!origin) {
      // No card to open from (e.g. launched from the map) -- a plain,
      // gentle entrance rather than matching a specific rectangle.
      el.style.transform = "scale(0.94)";
      el.style.opacity = "0";
      requestAnimationFrame(() => {
        el.style.transition =
          "transform 220ms cubic-bezier(0.22,1,0.36,1), opacity 180ms ease-out";
        el.style.transform = "none";
        el.style.opacity = "1";
      });
      return;
    }

    // Classic FLIP: place the modal at its natural final position, measure
    // it, then set an inline transform that makes it *look* like it is
    // still sitting where the folder card was -- same centre, scaled down
    // to the card's size, tipped back slightly as if the lid is still
    // down. Clearing that transform on the next frame, with a transition
    // active, is what plays as the folder lifting open and growing into
    // the full case file.
    const final = el.getBoundingClientRect();
    const scaleX = origin.width / final.width;
    const scaleY = origin.height / final.height;
    const dx = (origin.left + origin.width / 2) - (final.left + final.width / 2);
    const dy = (origin.top + origin.height / 2) - (final.top + final.height / 2);

    el.style.transformOrigin = "center";
    el.style.transform =
      `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY}) rotateX(-14deg)`;
    el.style.opacity = "0.5";

    requestAnimationFrame(() => {
      el.style.transition =
        "transform 340ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease-out";
      el.style.transform = "none";
      el.style.opacity = "1";
    });
  }, [app, form, origin]);

  /**
   * Plays the close animation (the reverse of the open one -- shrinking
   * back down into the card it came from) and only tells the parent to
   * actually unmount once it has finished, so the folder visibly closes
   * instead of just vanishing.
   */
  function requestClose() {
    if (closing) return;
    setClosing(true);
    const el = modalRef.current;
    if (!el || reducedMotionRef.current) { onClose(); return; }

    el.style.transition =
      "transform 220ms cubic-bezier(0.4, 0, 1, 1), opacity 200ms ease-in";
    if (origin) {
      const final = el.getBoundingClientRect();
      const scaleX = origin.width / final.width;
      const scaleY = origin.height / final.height;
      const dx = (origin.left + origin.width / 2) - (final.left + final.width / 2);
      const dy = (origin.top + origin.height / 2) - (final.top + final.height / 2);
      el.style.transform =
        `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY}) rotateX(-14deg)`;
    } else {
      el.style.transform = "scale(0.94)";
    }
    el.style.opacity = "0";

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.removeEventListener("transitionend", finish);
      onClose();
    };
    el.addEventListener("transitionend", finish);
    // Safety net: transitionend can fail to fire (e.g. the tab loses
    // focus mid-transition), and the modal must not get stuck open.
    setTimeout(finish, 260);
  }

  /**
   * Switches tabs with a quick page-flip: the current sheet rotates to
   * edge-on (invisible, since a flat plane viewed exactly side-on has no
   * width), the content swaps at that point, then it rotates back to
   * face-on -- one element, not two layered faces, which is what keeps
   * this simple and reliable rather than a full 3D card flip.
   */
  function switchTab(next) {
    if (next === tab || flipping) return;
    if (reducedMotionRef.current) { setTab(next); return; }
    setFlipping(true);
    setTimeout(() => {
      setTab(next);
      requestAnimationFrame(() => setFlipping(false));
    }, 150);
  }

  if (!app || !form) return null;

  const recentLocations = [];
  const seenLocations = new Set();
  apps.forEach(a => {
    const key = (a.location || "").toLowerCase();
    if (!a.location || seenLocations.has(key)) return;
    seenLocations.add(key);
    recentLocations.push({ location: a.location, geo: a.geo || null });
  });

  const suggest = {
    company: suggestionValues(apps, "company"),
    position: suggestionValues(apps, "position"),
    jobType: suggestionValues(apps, "jobType", JOB_TYPE_SUGGESTIONS)
  };

  const selectedRows = rows.filter(r => r.included);
  const selectedIds = selectedRows.map(r => r.module.id);
  const selectedModules = selectedRows.map(r => r.module);

  async function saveDetails() {
    // Locations saved before checking was required can still be sitting on a
    // case. Rather than quietly re-saving one, ask for it to be resolved.
    if (!isLocationResolved(form.location, form.geo)) {
      setDetailsError(
        "This location was never checked against a real place. Pick a match, or set it to Unknown."
      );
      return;
    }
    setDetailsError("");
    await api.updateApplication(appId, form);
    onChanged();
    requestClose();
  }

  async function deleteCase() {
    if (!confirm("Delete this case? This can't be undone.")) return;
    await api.deleteApplication(appId);
    onChanged();
    requestClose();
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
    const trimmedJobDescription = jobDescription.trim();
    if (!trimmedJobDescription) return;
    setTailoring(true);
    setTailorError("");
    try {
      const result = await api.tailorApplication(appId, trimmedJobDescription);
      setApp(result.application);
      setJobDescription(trimmedJobDescription);
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
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) requestClose(); }}>
      <div
        className={`modal ${closing ? "closing" : ""} ${flipping ? "flipping" : ""}`}
        ref={modalRef}
      >
        <button type="button" className="modal-close" onClick={requestClose}>&times;</button>

        <div className="modal-heading-row">
          <h2 className="modal-heading">{app.position || "Untitled position"}</h2>
          <p className="modal-subheading">
            {app.company}
            {app.requisitionId ? ` · ${app.requisitionId}` : ""}
          </p>
        </div>

        <div className="paper-stack-tabs">
          {/* Purely decorative: suggests the three sheets below are held
              together, the way a physical case file would be. */}
          {/* Feather Icons "paperclip" glyph (MIT licensed) -- a proven
              shape rather than a hand-derived guess at one. */}
          <svg
            className="paperclip"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
          <button
            type="button"
            className={`paper-tab ${tab === "details" ? "active" : ""}`}
            onClick={() => switchTab("details")}
          >Details</button>
          <button
            type="button"
            className={`paper-tab ${tab === "resume" ? "active" : ""}`}
            onClick={() => switchTab("resume")}
          >Tailored Resume</button>
          <button
            type="button"
            className={`paper-tab ${tab === "comms" ? "active" : ""}`}
            onClick={() => switchTab("comms")}
          >Communications</button>
        </div>

        {tab === "details" && (
          <div className="paper-sheet-content">
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
                <label>Employment</label>
                <select
                  value={form.employmentType}
                  onChange={e => setForm({ ...form, employmentType: e.target.value })}
                >
                  {EMPLOYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="mfield">
                <label>On-site / remote</label>
                <select
                  value={form.locationType}
                  onChange={e => setForm({ ...form, locationType: e.target.value })}
                >
                  {LOCATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="mform-row">
              <div className="mfield">
                <label>Location</label>
                <LocationInput
                  value={form.location}
                  geo={form.geo}
                  recent={recentLocations}
                  onChange={({ location, geo }) => setForm({ ...form, location, geo })}
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
            {detailsError && <p className="tailor-error">{detailsError}</p>}
            <div className="modal-actions">
              <button type="button" className="btn-danger" onClick={deleteCase}>Delete case</button>
              <button type="button" className="btn-primary" onClick={saveDetails}>Save changes</button>
            </div>
          </div>
        )}

        {tab === "resume" && (
          <div className="paper-sheet-content">
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
                <button type="button" className="btn-primary" onClick={tailorFromJD} disabled={tailoring || !jobDescription.trim()}>
                  {tailoring ? "Matching..." : "Generate tailored resume"}
                </button>
                <button type="button" className="btn-secondary-inline" onClick={resetFromMaster}>
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
                          type="button"
                          disabled={i === 0}
                          onClick={() => moveRow(i, "up")}
                          title="Move up"
                        >↑</button>
                        <button
                          type="button"
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
                type="button"
                className={`output-tab ${output === "preview" ? "active" : ""}`}
                onClick={() => showOutput("preview")}
              >Preview</button>
              <button
                type="button"
                className={`output-tab ${output === "text" ? "active" : ""}`}
                onClick={() => showOutput("text")}
              >Plain text</button>
              <button
                type="button"
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
          <div className="paper-sheet-content">
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
