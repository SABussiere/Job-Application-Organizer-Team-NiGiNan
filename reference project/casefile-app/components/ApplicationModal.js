"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// Mirrors lib/matching.js's assembleResumeText, but works off the
// match-summary rows (which already carry each module's content/order) so
// toggling a checkbox can rebuild the draft instantly, client-side.
function assembleFromSelection(matchSummary) {
  return matchSummary
    .filter(m => m.included)
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(m => (m.title ? `${m.title}\n${m.content}` : m.content))
    .join("\n\n")
    .trim();
}

export default function ApplicationModal({ appId, onClose, onChanged }) {
  const [tab, setTab] = useState("details");
  const [app, setApp] = useState(null);
  const [form, setForm] = useState(null);
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [matchSummary, setMatchSummary] = useState(null);
  const [tailoring, setTailoring] = useState(false);
  const [tailorError, setTailorError] = useState("");
  const [commType, setCommType] = useState("note");
  const [commDate, setCommDate] = useState(new Date().toISOString().slice(0, 10));
  const [commText, setCommText] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.getApplication(appId).then(data => {
      if (cancelled) return;
      setApp(data);
      setForm({
        company: data.company,
        position: data.position,
        dateApplied: data.dateApplied || "",
        status: data.status,
        followUpDate: data.followUpDate || "",
        location: data.location || "",
        jobUrl: data.jobUrl || "",
        notes: data.notes || ""
      });
      setResumeText(data.resumeVersion || "");
      setJobDescription(data.jobDescription || "");
    });
    return () => { cancelled = true; };
  }, [appId]);

  if (!app || !form) return null;

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
    await api.updateApplication(appId, { resumeVersion: resumeText });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1200);
  }

  async function resetFromMaster() {
    const text = await api.getFullMasterResumeText();
    setResumeText(text);
    setMatchSummary(null);
  }

  async function tailorFromJD() {
    if (!jobDescription.trim()) return;
    setTailoring(true);
    setTailorError("");
    try {
      const result = await api.tailorApplication(appId, jobDescription.trim());
      setResumeText(result.application.resumeVersion);
      setMatchSummary(result.matchSummary);
    } catch (e) {
      setTailorError(e.message);
    } finally {
      setTailoring(false);
    }
  }

  function toggleModuleIncluded(moduleId) {
    const updated = matchSummary.map(m =>
      m.moduleId === moduleId ? { ...m, included: !m.included } : m
    );
    setMatchSummary(updated);
    setResumeText(assembleFromSelection(updated));
  }

  async function logComm(e) {
    e.preventDefault();
    if (!commText.trim()) return;
    const updated = await api.addCommunication(appId, { type: commType, date: commDate, text: commText.trim() });
    setApp(updated);
    setCommText("");
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <button className="modal-close" onClick={onClose}>&times;</button>

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
                <input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
              </div>
              <div className="mfield">
                <label>Position</label>
                <input value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} />
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
                  <option value="applied">Applied</option>
                  <option value="interview">Interview</option>
                  <option value="offer">Offer</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div className="mfield">
                <label>Follow up on</label>
                <input type="date" value={form.followUpDate} onChange={e => setForm({ ...form, followUpDate: e.target.value })} />
              </div>
            </div>
            <div className="mform-row">
              <div className="mfield">
                <label>Location</label>
                <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
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
                {tailorError && <span className="tailor-error">{tailorError}</span>}
              </div>
              {matchSummary && (
                <div className="match-summary">
                  <p className="hint" style={{ margin: "10px 0 6px" }}>
                    Included {matchSummary.filter(m => m.included).length} of {matchSummary.length} master modules.
                    Uncheck any that don't fit — the draft below updates right away.
                  </p>
                  <ul className="match-list">
                    {matchSummary.map(m => (
                      <li key={m.moduleId} className={m.included ? "matched" : "skipped"}>
                        <label className="match-check">
                          <input
                            type="checkbox"
                            checked={m.included}
                            onChange={() => toggleModuleIncluded(m.moduleId)}
                          />
                          <span className="match-title">{m.title || "(untitled)"}</span>
                        </label>
                        {m.alwaysIncluded ? (
                          <span className="match-reason">always included by default</span>
                        ) : m.matchedTags.length || m.matchedWords.length ? (
                          <span className="match-reason">
                            matched: {[...m.matchedTags, ...m.matchedWords].slice(0, 5).join(", ")}
                          </span>
                        ) : (
                          <span className="match-reason">no overlap — left out</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <p className="hint" style={{ marginTop: 18 }}>This text is what gets saved as the tailored resume. Edit freely — it never changes your master modules.</p>
            <textarea className="resume-input" value={resumeText} onChange={e => setResumeText(e.target.value)} />
            <div className="modal-actions">
              <button className="btn-secondary-inline" onClick={resetFromMaster}>Reset to full master</button>
              <button className="btn-primary" onClick={saveResume}>{savedFlash ? "Saved ✓" : "Save tailored resume"}</button>
            </div>
          </div>
        )}

        {tab === "comms" && (
          <div>
            <form className="comm-form" onSubmit={logComm}>
              <select value={commType} onChange={e => setCommType(e.target.value)}>
                <option value="note">Note</option>
                <option value="email">Email</option>
                <option value="call">Call</option>
                <option value="interview">Interview</option>
              </select>
              <input type="date" value={commDate} onChange={e => setCommDate(e.target.value)} />
              <input type="text" placeholder="What happened?" value={commText} onChange={e => setCommText(e.target.value)} />
              <button type="submit" className="btn-primary">Log</button>
            </form>
            <ul className="comm-list">
              {(app.communications || []).length === 0 && (
                <li style={{ background: "transparent", fontStyle: "italic", color: "#786d59" }}>No communications logged yet.</li>
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
