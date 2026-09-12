"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { MODULE_TYPES } from "@/lib/constants";

function ModuleCard({ module, onSaved, onDeleted, onReorder, isFirst, isLast }) {
  const [form, setForm] = useState({
    type: module.type,
    title: module.title,
    content: module.content,
    tags: (module.tags || []).join(", "),
    alwaysInclude: module.alwaysInclude
  });
  const [saved, setSaved] = useState(false);

  async function save() {
    const patch = {
      type: form.type,
      title: form.title,
      content: form.content,
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
        <div className="module-reorder">
          <button disabled={isFirst} onClick={() => onReorder(module.id, "up")} title="Move up">↑</button>
          <button disabled={isLast} onClick={() => onReorder(module.id, "down")} title="Move down">↓</button>
        </div>
      </div>

      <input
        className="module-title-input"
        placeholder="e.g. Senior Engineer — Northwind Analytics"
        value={form.title}
        onChange={e => setForm({ ...form, title: e.target.value })}
      />
      <textarea
        className="module-content-input"
        placeholder="Bullet points or description for this section..."
        value={form.content}
        onChange={e => setForm({ ...form, content: e.target.value })}
        rows={4}
      />
      <input
        className="module-tags-input"
        placeholder="Tags for matching, comma-separated — e.g. react, leadership, api-design"
        value={form.tags}
        onChange={e => setForm({ ...form, tags: e.target.value })}
      />

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
  const [preview, setPreview] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  function load() {
    setLoading(true);
    api.listResumeModules().then(data => { setModules(data); setLoading(false); });
  }

  useEffect(() => { load(); }, []);

  async function addModule() {
    const module = await api.createResumeModule({
      type: "experience",
      title: "",
      content: "",
      tags: [],
      alwaysInclude: false
    });
    setModules(prev => [...prev, module]);
  }

  function handleSaved(updated) {
    setModules(prev => prev.map(m => (m.id === updated.id ? updated : m)));
  }

  function handleDeleted(id) {
    setModules(prev => prev.filter(m => m.id !== id));
  }

  async function handleReorder(id, direction) {
    const reordered = await api.reorderResumeModule(id, direction);
    setModules(reordered);
  }

  async function togglePreview() {
    if (!showPreview) {
      const text = await api.getFullMasterResumeText();
      setPreview(text);
    }
    setShowPreview(!showPreview);
  }

  return (
    <div className="panel" style={{ maxWidth: 860 }}>
      <h2>Master Resume</h2>
      <p className="hint">
        Break your resume into modules — a summary, each job, each project, your skills.
        Tag each one with a few keywords. When you tailor a resume for a specific job posting,
        modules whose tags match that posting's description are picked automatically, and you
        can still edit the result by hand afterward.
      </p>

      {loading ? (
        <p className="hint">Loading...</p>
      ) : modules.length === 0 ? (
        <div className="empty-col" style={{ marginBottom: 16 }}>
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
        <button className="btn-secondary-inline" onClick={togglePreview}>
          {showPreview ? "Hide full resume preview" : "Preview full resume"}
        </button>
      </div>

      {showPreview && (
        <pre className="resume-preview">{preview || "(nothing to preview yet)"}</pre>
      )}
    </div>
  );
}
