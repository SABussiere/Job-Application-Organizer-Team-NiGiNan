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
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18 }}>
        <button className="btn-stamp" onClick={createNew}>+ New Application</button>
      </div>

      {loading ? (
        <p className="hint">Loading your cases...</p>
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
                  <div className="empty-col">No applications here yet</div>
                ) : (
                  stageApps.map(app => (
                    <ApplicationCard
                      key={app.id}
                      app={app}
                      onOpen={setOpenId}
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
