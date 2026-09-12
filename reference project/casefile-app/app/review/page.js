// /review — human-in-the-loop screen for the synced-email queue. Shows each
// pending guess so the user can confirm (writes it to the board, via the
// same Firestore-backed lib/api.js every other page uses) or dismiss it,
// instead of emails silently creating/editing applications on their own.

"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

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

  async function confirm(entry) {
    try {
      // The application write has to happen here, in the browser — this is
      // the only place with a signed-in Firebase session. api.* is the
      // team's existing Firestore-backed client from lib/api.js, untouched;
      // this just calls it the same way any other page does.
      const applications = await api.listApplications();
      const existing = applications.find(a => a.emailThreadId === entry.threadId);

      if (existing) {
        await api.updateApplication(existing.id, {
          status: entry.extracted.status,
          emailMessageIds: [...(existing.emailMessageIds || []), entry.messageId]
        });
      } else {
        const created = await api.createApplication({
          company: entry.extracted.company,
          position: entry.extracted.position,
          status: entry.extracted.status,
          dateApplied: new Date().toISOString().slice(0, 10)
        });
        await api.updateApplication(created.id, {
          emailThreadId: entry.threadId,
          emailMessageIds: [entry.messageId]
        });
      }

      const res = await fetch(`/api/email/pending/${entry.id}`, { method: "DELETE" });
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
              <button className="btn-primary" onClick={() => confirm(p)}>Confirm</button>
              <button className="btn-danger" onClick={() => dismiss(p.id)}>Dismiss</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
