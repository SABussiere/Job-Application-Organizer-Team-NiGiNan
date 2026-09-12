"use client";

import { STAGE_META } from "@/lib/constants";

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function ApplicationCard({ app, onOpen, onDragStart }) {
  const today = new Date().toISOString().slice(0, 10);
  const overdue = app.followUpDate && app.followUpDate <= today && app.status !== "rejected";

  return (
    <div
      className="card"
      style={{ "--stage-color": STAGE_META[app.status].color }}
      draggable
      onDragStart={e => onDragStart(e, app.id)}
      onClick={() => onOpen(app.id)}
    >
      <div className="position">{app.position}</div>
      <div className="company">{app.company}</div>
      <div className="meta">
        <span>{formatDate(app.dateApplied)}</span>
        {app.location ? <span>{app.location}</span> : null}
      </div>
      {overdue ? <div className="followup-flag">Follow up due</div> : null}
    </div>
  );
}
