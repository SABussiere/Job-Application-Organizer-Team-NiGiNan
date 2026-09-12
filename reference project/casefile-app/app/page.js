"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { STAGES, stageMeta } from "@/lib/constants";
import { api } from "@/lib/api";
import { countByBucket, todayStr } from "@/lib/followups";
import { EMPTY_FILTERS, filterApplications } from "@/lib/filters";
import ApplicationCard from "@/components/ApplicationCard";
import ApplicationModal from "@/components/ApplicationModal";
import BoardFilters from "@/components/BoardFilters";
import NewApplicationForm from "@/components/NewApplicationForm";

export default function BoardPage() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  // Pinned once per mount so every card, badge and count agrees on what
  // "today" is even if the tab stays open past midnight.
  const today = useMemo(() => todayStr(), []);

  const load = useCallback(() => {
    setLoading(true);
    api.listApplications().then(data => {
      setApps(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => countByBucket(apps, today), [apps, today]);
  const visible = useMemo(
    () => filterApplications(apps, filters, today),
    [apps, filters, today]
  );

  async function handleDrop(e, stage) {
    e.preventDefault();
    setDragOverStage(null);
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    await api.updateApplication(id, { status: stage });
    load();
  }

  async function moveApp(id, stage) {
    if (!stage) return;
    await api.updateApplication(id, { status: stage });
    load();
  }

  function handleCreated() {
    setCreating(false);
    load();
  }

  return (
    <div>
      {!loading && (
        <div className="stats-row">
          <div className="stat-card">
            <div className="num">{apps.length}</div>
            <div className="label">Total applications</div>
          </div>
          {STAGES.slice(0, 2).map(stage => (
            <div className="stat-card" key={stage}>
              <div className="num">{apps.filter(a => a.status === stage).length}</div>
              <div className="label">{stageMeta(stage).label}</div>
            </div>
          ))}
          <div className={`stat-card ${counts.overdue ? "alert" : ""}`}>
            <div className="num">{counts.overdue}</div>
            <div className="label">Follow-ups past due</div>
          </div>
        </div>
      )}

      <div className="board-toolbar">
        <BoardFilters
          apps={apps}
          filters={filters}
          onChange={setFilters}
          today={today}
          resultCount={visible.length}
        />
        <button className="btn-stamp" onClick={() => setCreating(true)}>+ New application</button>
      </div>

      {loading ? (
        <p className="hint">Loading your applications...</p>
      ) : (
        <div className="board">
          {STAGES.map(stage => {
            const meta = stageMeta(stage);
            const stageApps = visible.filter(a => a.status === stage);
            const hiddenCount =
              apps.filter(a => a.status === stage).length - stageApps.length;
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
                  <div className="empty-col">
                    {hiddenCount > 0 ? "Nothing matches these filters" : "Nothing here yet"}
                  </div>
                ) : (
                  stageApps.map(app => (
                    <ApplicationCard
                      key={app.id}
                      app={app}
                      today={today}
                      onOpen={setOpenId}
                      onMove={moveApp}
                      onDragStart={(e, id) => e.dataTransfer.setData("text/plain", id)}
                    />
                  ))
                )}
                {hiddenCount > 0 && stageApps.length > 0 && (
                  <div className="column-hidden-note">
                    {hiddenCount} hidden by filters
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {creating && (
        <NewApplicationForm
          apps={apps}
          onClose={() => setCreating(false)}
          onCreated={handleCreated}
        />
      )}

      {openId && (
        <ApplicationModal
          appId={openId}
          apps={apps}
          onClose={() => setOpenId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
