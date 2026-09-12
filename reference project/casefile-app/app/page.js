"use client";

import { useEffect, useState, useCallback } from "react";
import { STAGES, STAGE_META } from "@/lib/constants";
import { api } from "@/lib/api";
import ApplicationCard from "@/components/ApplicationCard";
import ApplicationModal from "@/components/ApplicationModal";

export default function BoardPage() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    api.listApplications().then(data => {
      setApps(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDrop(e, stage) {
    e.preventDefault();
    setDragOverStage(null);
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    await api.updateApplication(id, { status: stage });
    load();
  }

  async function moveApp(id, stage) {
    await api.updateApplication(id, { status: stage });
    load();
  }

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
          ? `Scanned ${data.scanned}, queued ${data.queued} for review — check Email Review.`
          : `Scanned ${data.scanned}, nothing new to review.`
      );
    } catch (err) {
      setSyncMessage(err.message);
    } finally {
      setSyncing(false);
    }
  }

  async function disconnectGmail() {
    await fetch("/api/auth/google", { method: "DELETE" });
    setSyncMessage("Gmail disconnected — Sync Gmail will prompt you to connect a new account.");
  }

  async function createNew() {
    const app = await api.createApplication({
      company: "New Company",
      position: "New Position",
      dateApplied: new Date().toISOString().slice(0, 10),
      status: "applied"
    });
    await load();
    setOpenId(app.id);
  }

  return (
    <div>
      {!loading && (
        <div className="stats-row">
          <div className="stat-card">
            <div className="num">{apps.length}</div>
            <div className="label">Total applications</div>
          </div>
          {STAGES.slice(0, 3).map(stage => (
            <div className="stat-card" key={stage}>
              <div className="num">{apps.filter(a => a.status === stage).length}</div>
              <div className="label">{STAGE_META[stage].label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="board-toolbar">
        <button className="btn-stamp" onClick={createNew}>+ New application</button>
        <button className="btn-secondary-inline" onClick={syncGmail} disabled={syncing}>
          {syncing ? "Syncing..." : "📥 Sync Gmail"}
        </button>
        <button className="btn-secondary-inline" onClick={disconnectGmail}>
          Disconnect Gmail
        </button>
        {syncMessage && <span className="hint" style={{ margin: 0 }}>{syncMessage}</span>}
      </div>

      {loading ? (
        <p className="hint">Loading your applications...</p>
      ) : (
        <div className="board">
          {STAGES.map(stage => {
            const meta = STAGE_META[stage];
            const stageApps = apps.filter(a => a.status === stage);
            return (
              <div
                key={stage}
                className={`column ${dragOverStage === stage ? "drag-over" : ""}`}
                style={{ "--stage-color": meta.color }}
                onDragOver={e => { e.preventDefault(); setDragOverStage(stage); }}
                onDragLeave={() => setDragOverStage(null)}
                onDrop={e => handleDrop(e, stage)}
              >
                <div className="column-header">
                  <h3>{meta.label}</h3>
                  <span className="count">{stageApps.length}</span>
                </div>
                {stageApps.length === 0 ? (
                  <div className="empty-col">Nothing here yet</div>
                ) : (
                  stageApps.map(app => (
                    <ApplicationCard
                      key={app.id}
                      app={app}
                      onOpen={setOpenId}
                      onMove={moveApp}
                      onDragStart={(e, id) => e.dataTransfer.setData("text/plain", id)}
                    />
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}

      {openId && (
        <ApplicationModal appId={openId} onClose={() => setOpenId(null)} onChanged={load} />
      )}
    </div>
  );
}
