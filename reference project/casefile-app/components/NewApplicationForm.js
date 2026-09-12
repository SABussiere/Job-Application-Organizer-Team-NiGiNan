"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import {
  EMPLOYMENT_TYPES,
  JOB_TYPE_SUGGESTIONS,
  LOCATION_TYPES,
  STAGES,
  stageMeta
} from "@/lib/constants";
import { todayStr } from "@/lib/followups";
import { suggestionValues } from "@/lib/filters";
import SuggestInput from "@/components/SuggestInput";
import LocationInput from "@/components/LocationInput";

/**
 * Creating a case is deliberately a form rather than an instant placeholder
 * card: nothing is written until "Create case" is pressed, so abandoning the
 * form leaves the board untouched.
 */
export default function NewApplicationForm({ onClose, onCreated, apps = [] }) {
  const [form, setForm] = useState({
    company: "",
    position: "",
    jobType: "",
    requisitionId: "",
    dateApplied: todayStr(),
    status: "applied",
    employmentType: "Unknown",
    locationType: "Unknown",
    location: "Unknown",
    geo: null,
    jobUrl: "",
    followUpDate: "",
    notes: ""
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const firstField = useRef(null);

  useEffect(() => {
    firstField.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ready = form.company.trim() && form.position.trim();

  // Suggestions come from what's already on the board, so the same employer
  // doesn't get stored three different ways and split its filter option.
  // Locations already on the board, with whatever coordinates they carry, so
  // reusing one keeps its pin without another lookup.
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

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    setError("");
    try {
      const app = await api.createApplication({
        ...form,
        company: form.company.trim(),
        position: form.position.trim(),
        jobType: form.jobType.trim(),
        requisitionId: form.requisitionId.trim()
      });
      onCreated(app);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="modal modal-narrow" onSubmit={submit}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Cancel">&times;</button>

        <h2 className="modal-heading">New application</h2>
        <p className="hint">
          Nothing is saved until you press Create. Company and position are the
          only required fields — everything else can be filled in later.
        </p>

        <div className="mform-row">
          <div className="mfield">
            <label htmlFor="na-company">Company *</label>
            <SuggestInput
              id="na-company"
              inputRef={firstField}
              value={form.company}
              onChange={v => set("company", v)}
              options={suggest.company}
              placeholder="Acme Robotics"
            />
          </div>
          <div className="mfield">
            <label htmlFor="na-position">Position *</label>
            <SuggestInput
              id="na-position"
              value={form.position}
              onChange={v => set("position", v)}
              options={suggest.position}
              placeholder="Backend Engineer Intern"
            />
          </div>
        </div>

        <div className="mform-row">
          <div className="mfield">
            <label htmlFor="na-jobtype">Job type</label>
            <SuggestInput
              id="na-jobtype"
              value={form.jobType}
              onChange={v => set("jobType", v)}
              options={suggest.jobType}
              placeholder="Backend"
            />
            <p className="field-note">
              Groups differently-worded titles so you can filter by the kind
              of role, not the exact wording.
            </p>
          </div>
          <div className="mfield">
            <label htmlFor="na-employment">Employment</label>
            <select
              id="na-employment"
              value={form.employmentType}
              onChange={e => set("employmentType", e.target.value)}
            >
              {EMPLOYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="mfield">
            <label htmlFor="na-loctype">On-site / remote</label>
            <select
              id="na-loctype"
              value={form.locationType}
              onChange={e => set("locationType", e.target.value)}
            >
              {LOCATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="mform-row">
          <div className="mfield">
            <label htmlFor="na-location">Location</label>
            <LocationInput
              id="na-location"
              value={form.location}
              geo={form.geo}
              recent={recentLocations}
              onChange={({ location, geo }) =>
                setForm(prev => ({ ...prev, location, geo }))
              }
            />
          </div>
        </div>

        <div className="mform-row">
          <div className="mfield">
            <label htmlFor="na-req">Requisition ID</label>
            <input
              id="na-req"
              value={form.requisitionId}
              onChange={e => set("requisitionId", e.target.value)}
              placeholder="REQ-20481"
            />
          </div>
          <div className="mfield">
            <label htmlFor="na-url">Job posting link</label>
            <input
              id="na-url"
              value={form.jobUrl}
              onChange={e => set("jobUrl", e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>

        <div className="mform-row">
          <div className="mfield">
            <label htmlFor="na-applied">Date applied</label>
            <input
              id="na-applied"
              type="date"
              value={form.dateApplied}
              onChange={e => set("dateApplied", e.target.value)}
            />
          </div>
          <div className="mfield">
            <label htmlFor="na-status">Stage</label>
            <select id="na-status" value={form.status} onChange={e => set("status", e.target.value)}>
              {STAGES.map(s => (
                <option key={s} value={s}>{stageMeta(s).label}</option>
              ))}
            </select>
          </div>
          <div className="mfield">
            <label htmlFor="na-followup">Follow up on</label>
            <input
              id="na-followup"
              type="date"
              value={form.followUpDate}
              onChange={e => set("followUpDate", e.target.value)}
            />
          </div>
        </div>

        <div className="mfield">
          <label htmlFor="na-notes">Notes</label>
          <textarea
            id="na-notes"
            rows={3}
            value={form.notes}
            onChange={e => set("notes", e.target.value)}
            placeholder="Referral, salary range, where you found it..."
          />
        </div>

        {error && <p className="tailor-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn-secondary-inline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={!ready || saving}>
            {saving ? "Creating..." : "Create case"}
          </button>
        </div>
      </form>
    </div>
  );
}
