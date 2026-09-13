// /review — human-in-the-loop screen for the synced-email queue. Shows each
// pending guess so the user can confirm (writes it to the board, via the
// same Firestore-backed lib/api.js every other page uses) or dismiss it,
// instead of emails silently creating/editing applications on their own.
// Company/position/status are editable inline before confirming, since the
// classifier is a heuristic guess and sometimes has nothing to go on (e.g.
// a rejection email that never names the role).

"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { STAGES, stageMeta } from "@/lib/constants";

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function ReviewPage() {
  const [pending, setPending] = useState([]);
  const [edits, setEdits] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [busyId, setBusyId] = useState(null);

  function load() {
    setLoading(true);
    setError(null);
    fetch("/api/email/pending")
      .then(res => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json();
      })
      .then(data => {
        setPending(data.pending);
        setEdits(Object.fromEntries(data.pending.map(p => [p.id, { ...p.extracted }])));
        setLoading(false);
      })
      .catch(err => { setError(err.message); setLoading(false); });
  }

  useEffect(() => { load(); }, []);

  async function syncGmail() {
    setSyncing(true);
    setSyncMessage("");
    try {
      const res = await fetch("/api/email/sync", { method: "POST" });
      if (res.status === 401) {
        window.location.href = "/api/auth/google";
        return;
      }
      if (!res.ok) throw new Error(`Sync failed (${res.status})`);
      const data = await res.json();
      setSyncMessage(
        data.queued > 0
          ? `Scanned ${data.scanned}, queued ${data.queued} new.`
          : `Scanned ${data.scanned}, nothing new.`
      );
      load();
    } catch (err) {
      setSyncMessage(err.message);
    } finally {
      setSyncing(false);
    }
  }

  function setField(id, field, value) {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  async function confirm(entry) {
    const fields = edits[entry.id] || entry.extracted;
    setBusyId(entry.id);
    try {
      // The application write has to happen here, in the browser — this is
      // the only place with a signed-in Firebase session. api.* is the
      // team's existing Firestore-backed client from lib/api.js, untouched;
      // this just calls it the same way any other page does.
      const applications = await api.listApplications();
      const existing = applications.find(a => a.emailThreadId === entry.threadId);

      if (existing) {
        await api.updateApplication(existing.id, {
          status: fields.status,
          emailMessageIds: [...(existing.emailMessageIds || []), entry.messageId]
        });
      } else {
        const created = await api.createApplication({
          company: fields.company,
          position: fields.position,
          status: fields.status,
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
    } finally {
      setBusyId(null);
    }
  }

  async function dismiss(id) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/email/pending/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
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
