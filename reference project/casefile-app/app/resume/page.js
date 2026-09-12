"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function ResumePage() {
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMasterResume().then(t => { setText(t); setLoading(false); });
  }, []);

  async function save() {
    await api.setMasterResume(text);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="panel">
      <h2>Master Resume</h2>
      <p className="hint">
        This is your source of truth. When you file a new application, its tailored resume
        starts as a copy of this — edit that copy per-role without touching the master.
      </p>
      {loading ? (
        <p className="hint">Loading...</p>
      ) : (
        <>
          <textarea
            className="resume-input"
            placeholder="Paste or write your master resume here..."
            value={text}
            onChange={e => setText(e.target.value)}
          />
          <div style={{ marginTop: 12 }}>
            <button className="btn-primary" onClick={save}>Save master resume</button>
            {saved && <span className="saved-note">Saved.</span>}
          </div>
        </>
      )}
    </div>
  );
}
