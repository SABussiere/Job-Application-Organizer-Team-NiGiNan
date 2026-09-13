// /prep — "Tips & Tricks": AI-generated interview prep for one application.
// Pick an existing case (pulls company/position/job description/notes
// automatically) or fill the fields in by hand. Generation happens
// server-side (app/api/interview-prep/route.js) since it needs the
// Anthropic API key.

"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const EMPTY_FORM = { company: "", position: "", jobDescription: "", notes: "" };

export default function PrepPage() {
  const [apps, setApps] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [prep, setPrep] = useState(null);

  useEffect(() => {
    api.listApplications().then(setApps);
  }, []);

  function selectApp(id) {
    setSelectedId(id);
    setPrep(null);
    if (!id) {
      setForm(EMPTY_FORM);
      return;
    }
    const app = apps.find(a => a.id === id);
    if (!app) return;
    setForm({
      company: app.company || "",
      position: app.position || "",
      jobDescription: app.jobDescription || "",
      notes: app.notes || ""
    });
  }

  async function generate(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setPrep(null);
    try {
      const res = await fetch("/api/interview-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setPrep(data.prep);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <h2>Tips &amp; Tricks</h2>
      <p className="hint">
        AI-generated interview prep for a specific company and role — likely questions,
        strengths to highlight, and good questions to ask back.
      </p>

      <form onSubmit={generate}>
        <div className="mfield" style={{ marginBottom: 14 }}>
          <label>Prep for one of your cases (optional)</label>
          <select value={selectedId} onChange={e => selectApp(e.target.value)}>
            <option value="">— Enter details manually —</option>
            {apps.map(a => (
              <option key={a.id} value={a.id}>{a.position} @ {a.company}</option>
            ))}
          </select>
        </div>

        <div className="mform-row">
          <div className="mfield">
            <label>Company</label>
            <input
              required
              value={form.company}
              onChange={e => setForm({ ...form, company: e.target.value })}
            />
          </div>
          <div className="mfield">
            <label>Position</label>
            <input
              required
              value={form.position}
              onChange={e => setForm({ ...form, position: e.target.value })}
            />
          </div>
        </div>

        <div className="mfield" style={{ marginBottom: 14 }}>
          <label>Job description (optional, but improves the results)</label>
          <textarea
            rows={5}
            value={form.jobDescription}
            onChange={e => setForm({ ...form, jobDescription: e.target.value })}
            placeholder="Paste the job posting text here..."
          />
        </div>

        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? "Generating..." : "Generate prep"}
        </button>
      </form>

      {error && <p className="tailor-error" style={{ marginTop: 14 }}>{error}</p>}

      {prep && (
        <div className="prep-results">
          <section>
            <h3 className="prep-section-title">Likely questions</h3>
            <ul className="prep-question-list">
              {prep.commonQuestions.map((q, i) => (
                <li key={i} className="prep-question">
                  <div className="prep-question-text">{q.question}</div>
                  <div className="prep-question-tip">{q.tip}</div>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="prep-section-title">Strengths to highlight</h3>
            <ul className="prep-bullet-list">
              {prep.strengthsToHighlight.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </section>

          <section>
            <h3 className="prep-section-title">On this company</h3>
            <p className="hint" style={{ margin: 0 }}>{prep.companyAngle}</p>
          </section>

          <section>
            <h3 className="prep-section-title">Ask the interviewer</h3>
            <ul className="prep-bullet-list">
              {prep.questionsToAsk.map((q, i) => <li key={i}>{q}</li>)}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
