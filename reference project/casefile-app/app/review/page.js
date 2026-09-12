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
        <p className="hint">Couldn&apost load the review queue: {error}</p>
        <button className="btn-secondary-inline" onClick={load}>Retry</button>
      </div>
    );
  }
  if (pending.length === 0) {
    return <p className="hint">Nothing to review — sync your inbox from the board page.</p>;
  }

  return (
    <div className="panel">
      <div className="review-header">
        <div>
          <h2>Email review</h2>
          <p className="hint" style={{ margin: 0 }}>
            Guesses from your synced inbox — check the fields, then confirm or dismiss.
          </p>
        </div>
        <button className="btn-secondary-inline" onClick={syncGmail} disabled={syncing}>
          {syncing ? "Syncing..." : "Scan Gmail"}
        </button>
      </div>
      {syncMessage && <p className="hint">{syncMessage}</p>}

      {pending.length === 0 ? (
        <p className="hint">Nothing to review right now.</p>
      ) : (
        <>
          <p className="review-count">{pending.length} to review</p>
          <ul className="review-list">
            {pending.map(p => {
              const fields = edits[p.id] || p.extracted;
              const meta = stageMeta(fields.status);
              const lowConfidence = p.extracted.confidence < 0.5;
              return (
                <li key={p.id} className="review-item" style={{ "--stage-color": meta.color }}>
                  <div className="review-source">
                    From an email received {formatDate(p.receivedAt)}
                    {lowConfidence && <span className="review-confidence low">Low confidence — double-check</span>}
                  </div>

                  <div className="review-fields">
                    <div className="review-field">
                      <label>Company</label>
                      <input
                        value={fields.company}
                        onChange={e => setField(p.id, "company", e.target.value)}
                      />
                    </div>
                    <div className="review-field">
                      <label>Position</label>
                      <input
                        value={fields.position}
                        onChange={e => setField(p.id, "position", e.target.value)}
                      />
                    </div>
                    <div className="review-field" style={{ maxWidth: 160 }}>
                      <label>Stage</label>
                      <select
                        value={fields.status}
                        onChange={e => setField(p.id, "status", e.target.value)}
                      >
                        {STAGES.map(stage => (
                          <option key={stage} value={stage}>{stageMeta(stage).label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="review-actions">
                    <button
                      className="btn-danger"
                      onClick={() => dismiss(p.id)}
                      disabled={busyId === p.id}
                    >
                      Dismiss
                    </button>
                    <button
                      className="btn-primary"
                      onClick={() => confirm(p)}
                      disabled={busyId === p.id}
                    >
                      {busyId === p.id ? "Working..." : "Confirm"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
