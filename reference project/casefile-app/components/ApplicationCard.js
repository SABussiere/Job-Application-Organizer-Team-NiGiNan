"use client";

import { STAGES, STAGE_META } from "@/lib/constants";

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function ApplicationCard({ app, onOpen, onDragStart, onMove }) {
  const today = new Date().toISOString().slice(0, 10);
  const overdue = app.followUpDate && app.followUpDate <= today && app.status !== "rejected";

  return (
    <div
      className="card"
      style={{ "--stage-color": STAGE_META[app.status].color }}
      draggable
      onDragStart={e => onDragStart(e, app.id)}
    >
      <div onClick={() => onOpen(app.id)}>
        <div className="position">{app.position}</div>
        <div className="company">{app.company}</div>
        <div className="meta">
          <span>{formatDate(app.dateApplied)}</span>
          {app.location ? <span>{app.location}</span> : null}
        </div>
        {overdue ? <div className="followup-flag">Follow up due</div> : null}
      </div>
      <select
        className="quick-move"
        value={app.status}
        onClick={e => e.stopPropagation()}
        onChange={e => onMove(app.id, e.target.value)}
        aria-label={`Move ${app.position} to a different stage`}
      >
        {STAGES.map(s => (
          <option key={s} value={s}>Move to: {STAGE_META[s].label}</option>
        ))}
      </select>
    </div>
  );
}
