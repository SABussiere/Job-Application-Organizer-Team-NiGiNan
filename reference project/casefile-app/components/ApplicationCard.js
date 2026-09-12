"use client";

import { STAGES, stageMeta } from "@/lib/constants";
import { followUpBucket, followUpLabel, formatDate } from "@/lib/followups";
import { UNKNOWN_TYPE } from "@/lib/constants";

// Unknown is the default for both type fields, so showing it would put a
// meaningless tag on most cards.
function knownType(value) {
  return value && value !== UNKNOWN_TYPE;
}

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
        {(app.jobType || app.requisitionId || knownType(app.employmentType) ||
          knownType(app.locationType)) && (
          <span className="card-tags">
            {app.jobType ? <span className="job-type-tag">{app.jobType}</span> : null}
            {knownType(app.employmentType) ? (
              <span className="plain-tag">{app.employmentType}</span>
            ) : null}
            {knownType(app.locationType) ? (
              <span className="plain-tag">{app.locationType}</span>
            ) : null}
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
            {bucket === "overdue" ? "\u26a0 " : bucket === "soon" ? "\ud83d\udd14 " : "\ud83d\udcc5 "}
            {followUpLabel(app, today)}
          </span>
        )}
      </button>

      {/* A labelled "Move" control, taken from development: the label carries
          the verb, so each option stays a bare stage name. */}
      <div className="move-select">
        <span>Move</span>
        <select
          value={STAGES.includes(app.status) ? app.status : ""}
          onClick={e => e.stopPropagation()}
          onChange={e => onMove(app.id, e.target.value)}
          aria-label={`Move ${app.position} to a different stage`}
        >
          {!STAGES.includes(app.status) && <option value="">Choose a stage</option>}
          {STAGES.map(s => (
            <option key={s} value={s}>{stageMeta(s).label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
