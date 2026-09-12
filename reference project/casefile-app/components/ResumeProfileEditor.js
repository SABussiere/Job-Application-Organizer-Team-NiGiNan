"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const BLANK = { name: "", email: "", phone: "", location: "", links: [] };

/**
 * The resume heading — name and contact line. Jake's Resume puts these in a
 * centred block above the first section, so they live outside the module
 * list rather than being a module of their own.
 */
export default function ResumeProfileEditor({ onSaved }) {
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getResumeProfile().then(p => setForm({ ...BLANK, ...p, links: p.links || [] }));
  }, []);

  if (!form) return <p className="hint">Loading heading...</p>;

  function setField(field, value) {
    setForm({ ...form, [field]: value });
  }

  function setLink(i, patch) {
    const links = form.links.map((l, idx) => (idx === i ? { ...l, ...patch } : l));
    setForm({ ...form, links });
  }

  function addLink() {
    setForm({ ...form, links: [...form.links, { label: "", url: "" }] });
  }

  function removeLink(i) {
    setForm({ ...form, links: form.links.filter((_, idx) => idx !== i) });
  }

  async function save() {
    const profile = await api.updateResumeProfile({
      ...form,
      links: form.links.filter(l => l.url.trim() || l.label.trim())
    });
    setForm({ ...BLANK, ...profile, links: profile.links || [] });
    setSaved(true);
    setTimeout(() => setSaved(false), 1400);
    if (onSaved) onSaved(profile);
  }

  return (
    <div className="module-card profile-card">
      <div className="module-card-top">
        <span className="module-kicker">Resume heading</span>
      </div>

      <div className="mform-row">
        <div className="mfield">
          <label>Full name</label>
          <input value={form.name} onChange={e => setField("name", e.target.value)} placeholder="Jake Ryan" />
        </div>
        <div className="mfield">
          <label>Email</label>
          <input value={form.email} onChange={e => setField("email", e.target.value)} placeholder="you@example.com" />
        </div>
      </div>
      <div className="mform-row">
        <div className="mfield">
          <label>Phone</label>
          <input value={form.phone} onChange={e => setField("phone", e.target.value)} placeholder="780-555-0199" />
        </div>
        <div className="mfield">
          <label>Location</label>
          <input value={form.location} onChange={e => setField("location", e.target.value)} placeholder="Edmonton, AB" />
        </div>
      </div>

      <label className="field-label">Links</label>
      {form.links.length === 0 && (
        <p className="hint" style={{ margin: "0 0 8px" }}>
          No links yet — LinkedIn and GitHub are the usual two.
        </p>
      )}
      {form.links.map((link, i) => (
        <div className="link-row" key={i}>
          <input
            placeholder="Shown text — e.g. linkedin.com/in/jake"
            value={link.label}
            onChange={e => setLink(i, { label: e.target.value })}
          />
          <input
            placeholder="URL — e.g. https://linkedin.com/in/jake"
            value={link.url}
            onChange={e => setLink(i, { url: e.target.value })}
          />
          <button type="button" className="btn-icon" onClick={() => removeLink(i)} title="Remove link">×</button>
        </div>
      ))}

      <div className="module-card-bottom">
        <button type="button" className="btn-secondary-inline" onClick={addLink}>+ Add link</button>
        <div className="module-actions">
          <button type="button" className="btn-primary" onClick={save}>{saved ? "Saved ✓" : "Save heading"}</button>
        </div>
      </div>
    </div>
  );
}
