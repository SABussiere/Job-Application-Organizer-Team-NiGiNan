// /review — human-in-the-loop screen for the synced-email queue. Shows each
// pending guess so the user can confirm (writes it to the board) or dismiss
// it, instead of emails silently creating/editing applications on their own.

"use client";

import { useEffect, useState } from "react";

export default function ReviewPage() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function load() {
    setLoading(true);
    setError(null);
    fetch("/api/email/pending")
      .then(res => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json();
      })
      .then(data => { setPending(data.pending); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }

  useEffect(() => { load(); }, []);

  async function confirm(id) {
    try {
      const res = await fetch(`/api/email/pending/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function dismiss(id) {
    try {
      const res = await fetch(`/api/email/pending/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p className="hint">Loading...</p>;
  if (error) {
    return (
      <div>
        <p className="hint">Couldn&apos;t load the review queue: {error}</p>
        <button className="btn-secondary-inline" onClick={load}>Retry</button>
      </div>
    );
  }
  if (pending.length === 0) {
    return <p className="hint">Nothing to review — sync your inbox from the board page.</p>;
  }

  return (
    <div className="panel">
      <h2>Review queue</h2>
      <ul className="reminders-list">
        {pending.map(p => (
          <li key={p.id}>
            <div>
              <div className="r-pos">{p.extracted.position} @ {p.extracted.company}</div>
              <div className="r-co">Guessed status: {p.extracted.status}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-primary" onClick={() => confirm(p.id)}>Confirm</button>
              <button className="btn-danger" onClick={() => dismiss(p.id)}>Dismiss</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
