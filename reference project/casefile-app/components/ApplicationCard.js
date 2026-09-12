"use client";

import { STAGES, stageMeta } from "@/lib/constants";
import { followUpBucket, followUpLabel, formatDate } from "@/lib/followups";

export default function ApplicationCard({ app, onOpen, onDragStart, onMove, today }) {
  const stage = stageMeta(app.status);
  const bucket = followUpBucket(app, today);

  return (
    <div
      className="card"
      style={{ "--stage-color": stage.color }}
      draggable
      onDragStart={e => onDragStart(e, app.id)}
    >
      <button className="card-open" onClick={() => onOpen(app.id)}>
        <span className="position">{app.position}</span>
        <span className="company">{app.company}</span>
        {(app.jobType || app.requisitionId) && (
          <span className="card-tags">
            {app.jobType ? <span className="job-type-tag">{app.jobType}</span> : null}
            {app.requisitionId ? (
              <span className="req-id" title="Requisition ID">{app.requisitionId}</span>
            ) : null}
          </span>
        )}
        <span className="meta">
          <span>{formatDate(app.dateApplied)}</span>
          {app.location ? <span>{app.location}</span> : null}
        </span>
        {bucket === "none" ? (
          app.status === "rejected" ? null : (
            <span className="followup-badge none">No follow-up set</span>
          )
        ) : (
          <span
            className={`followup-badge ${bucket}`}
            title={`Follow up on ${formatDate(app.followUpDate)}`}
          >
            {bucket === "overdue" ? "⚠ " : bucket === "soon" ? "🔔 " : "🗓 "}
            {followUpLabel(app, today)}
          </span>
        )}
      </button>
      <select
        className="quick-move"
        value={STAGES.includes(app.status) ? app.status : ""}
        onClick={e => e.stopPropagation()}
        onChange={e => onMove(app.id, e.target.value)}
        aria-label={`Move ${app.position} to a different stage`}
      >
        {!STAGES.includes(app.status) && <option value="">Move to...</option>}
        {STAGES.map(s => (
          <option key={s} value={s}>Move to: {stageMeta(s).label}</option>
        ))}
      </select>
    </div>
  );
}
