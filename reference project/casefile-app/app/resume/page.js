"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { MODULE_TYPES, SECTION_TITLES, typeFields } from "@/lib/constants";
import LatexPanel from "@/components/LatexPanel";
import ResumeProfileEditor from "@/components/ResumeProfileEditor";
import ResumeSheetPanel from "@/components/ResumeSheetPanel";

function toForm(module) {
  return {
    type: module.type,
    title: module.title || "",
    organization: module.organization || "",
    location: module.location || "",
    startDate: module.startDate || "",
    endDate: module.endDate || "",
    content: module.content || "",
    bullets: (module.bullets || []).join("\n"),
    tags: (module.tags || []).join(", "),
    alwaysInclude: !!module.alwaysInclude
  };
}

const previewModules = [
  {
    type: "summary",
    title: "Professional Summary",
    content: "Software engineer focused on building reliable web applications and user-friendly tools.",
    tags: ["javascript", "react", "web development"],
    alwaysInclude: true
  },
  {
    type: "experience",
    title: "Software Engineer — Example Company",
    content: "Built responsive React interfaces.\nCollaborated with designers and backend engineers.\nImproved application performance and usability.",
    tags: ["react", "javascript", "frontend"],
    alwaysInclude: false
  },
  {
    type: "skill",
    title: "Technical Skills",
    content: "JavaScript, React, Next.js, Node.js, Firebase, Git",
    tags: ["javascript", "react", "nextjs", "firebase"],
    alwaysInclude: true
  }
];

function ModuleCard({ module, onSaved, onDeleted, onReorder, isFirst, isLast }) {
  const [form, setForm] = useState(() => toForm(module));
  const [saved, setSaved] = useState(false);
  const fields = typeFields(form.type);

  async function save() {
    const patch = {
      type: form.type,
      title: form.title,
      organization: form.organization,
      location: form.location,
      startDate: form.startDate,
      endDate: form.endDate,
      content: form.content,
      bullets: form.bullets.split("\n").map(b => b.trim()).filter(Boolean),
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      alwaysInclude: form.alwaysInclude
    };
    const updated = await api.updateResumeModule(module.id, patch);
    onSaved(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  }

  async function del() {
    if (!confirm(`Delete "${form.title || "this module"}"? This can't be undone.`)) return;
    await api.deleteResumeModule(module.id);
    onDeleted(module.id);
  }

  return (
    <div className="module-card">
      <div className="module-card-top">
        <select
          className="module-type-select"
          value={form.type}
          onChange={e => setForm({ ...form, type: e.target.value })}
        >
          {MODULE_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <span className="module-kicker">→ {SECTION_TITLES[form.type] || "Additional"}</span>
        <div className="module-reorder">
          <button disabled={isFirst} onClick={() => onReorder(module.id, "up")} title="Move up">↑</button>
          <button disabled={isLast} onClick={() => onReorder(module.id, "down")} title="Move down">↓</button>
        </div>
      </div>

      <div className="mform-row">
        <div className="mfield">
          <label>{fields.title.label}</label>
          <input
            value={form.title}
            placeholder={fields.title.placeholder}
            onChange={e => setForm({ ...form, title: e.target.value })}
          />
        </div>
        {fields.organization && (
          <div className="mfield">
            <label>{fields.organization.label}</label>
            <input
              value={form.organization}
              placeholder={fields.organization.placeholder}
              onChange={e => setForm({ ...form, organization: e.target.value })}
            />
          </div>
        )}
      </div>

      {(fields.dates || fields.location) && (
        <div className="mform-row">
          {fields.dates && (
            <>
              <div className="mfield">
                <label>Start</label>
                <input
                  value={form.startDate}
                  placeholder="May 2024"
                  onChange={e => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
              <div className="mfield">
                <label>End</label>
                <input
                  value={form.endDate}
                  placeholder="Present"
                  onChange={e => setForm({ ...form, endDate: e.target.value })}
                />
              </div>
            </>
          )}
          {fields.location && (
            <div className="mfield">
              <label>Location</label>
              <input
                value={form.location}
                placeholder="Edmonton, AB"
                onChange={e => setForm({ ...form, location: e.target.value })}
              />
            </div>
          )}
        </div>
      )}

      <div className="mfield">
        <label>{fields.content.label}</label>
        <textarea
          className="module-content-input"
          placeholder={fields.content.placeholder}
          value={form.content}
          onChange={e => setForm({ ...form, content: e.target.value })}
          rows={form.type === "summary" ? 4 : 2}
        />
      </div>

      {fields.bullets && (
        <div className="mfield">
          <label>{fields.bullets.label}</label>
          <textarea
            className="module-content-input"
            placeholder={fields.bullets.placeholder}
            value={form.bullets}
            onChange={e => setForm({ ...form, bullets: e.target.value })}
            rows={4}
          />
        </div>
      )}

      <div className="mfield">
        <label>Matching tags</label>
        <input
          className="module-tags-input"
          placeholder="Comma-separated — e.g. react, leadership, api-design"
          value={form.tags}
          onChange={e => setForm({ ...form, tags: e.target.value })}
        />
      </div>

      <div className="module-card-bottom">
        <label className="module-always">
          <input
            type="checkbox"
            checked={form.alwaysInclude}
            onChange={e => setForm({ ...form, alwaysInclude: e.target.checked })}
          />
          Always include, regardless of match
        </label>
        <div className="module-actions">
          <button className="btn-danger" onClick={del}>Delete</button>
          <button className="btn-primary" onClick={save}>{saved ? "Saved ✓" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

export default function ResumePage() {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState(null); // null | "preview" | "text" | "latex"
  const [text, setText] = useState("");
  const [latex, setLatex] = useState("");
  const [profile, setProfile] = useState(null);
  const [rendering, setRendering] = useState(false);

  async function load() {
    setLoading(true);

    const data = await api.listResumeModules();

    if (data.length === 0) {
      const createdModules = [];

      for (const module of previewModules) {
        const created = await api.createResumeModule(module);
        createdModules.push(created);
      }
    
      setModules(createdModules);
    }
    else {
      setModules(data);
    }

    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function addModule() {
    const module = await api.createResumeModule({ type: "experience" });
    setModules(prev => [...prev, module]);
  }

  function handleSaved(updated) {
    setModules(prev => prev.map(m => (m.id === updated.id ? updated : m)));
    // A saved edit changes whatever preview is open, so refresh it.
    if (view) renderView(view);
  }

  function handleDeleted(id) {
    setModules(prev => prev.filter(m => m.id !== id));
    if (view) renderView(view);
  }

  async function handleReorder(id, direction) {
    const reordered = await api.reorderResumeModule(id, direction);
    setModules(reordered);
    if (view) renderView(view);
  }

  async function renderView(which) {
    setRendering(true);
    try {
      if (which === "text") setText(await api.getFullMasterResumeText());
      else if (which === "latex") setLatex(await api.getMasterLatex());
      // The preview renders client-side from modules already in state, so
      // it only needs the heading fetched.
      else setProfile(await api.getResumeProfile());
      setView(which);
    } finally {
      setRendering(false);
    }
  }

  function showView(next) {
    if (view === next) { setView(null); return; }
    renderView(next);
  }

  return (
    <div className="panel" style={{ maxWidth: 900 }}>
      <h2>Master Resume</h2>
      <p className="hint hint-wide">
        Break your resume into modules — a summary, each job, each project, your
        skills. Each one carries its own dates, organisation and bullet points,
        so it can be typeset straight into the Jake&apos;s Resume LaTeX template.
        Tag each module with a few keywords, and the tailoring step picks the
        matching ones for a specific posting.
      </p>

      <ResumeProfileEditor />

      {loading ? (
        <p className="hint">Loading...</p>
      ) : modules.length === 0 ? (
        <div className="empty-col" style={{ margin: "16px 0" }}>
          No modules yet. Add your summary, your most recent role, and a skills module to start.
        </div>
      ) : (
        <div className="module-list">
          {modules.map((m, i) => (
            <ModuleCard
              key={m.id}
              module={m}
              onSaved={handleSaved}
              onDeleted={handleDeleted}
              onReorder={handleReorder}
              isFirst={i === 0}
              isLast={i === modules.length - 1}
            />
          ))}
        </div>
      )}

      <div className="module-list-actions">
        <button className="btn-secondary-inline" onClick={addModule}>+ Add module</button>
        <button className="btn-secondary-inline" onClick={() => showView("preview")}>
          {view === "preview" ? "Hide resume preview" : "Preview resume / PDF"}
        </button>
        <button className="btn-secondary-inline" onClick={() => showView("text")}>
          {view === "text" ? "Hide plain text" : "Plain text"}
        </button>
        <button className="btn-secondary-inline" onClick={() => showView("latex")}>
          {view === "latex" ? "Hide LaTeX" : "Preview LaTeX"}
        </button>
      </div>

      {view === "preview" && (
        <ResumeSheetPanel
          profile={profile}
          modules={modules}
          moduleIds={modules.map(m => m.id)}
          label="Master resume"
          loading={rendering}
        />
      )}

      {view === "text" && (
        <pre className="resume-preview">
          {rendering ? "Rendering..." : text || "(nothing to preview yet)"}
        </pre>
      )}

      {view === "latex" && (
        <LatexPanel
          latex={latex}
          loading={rendering}
          fileName="master-resume.tex"
          onRefresh={() => renderView("latex")}
        />
      )}
    </div>
  );
}