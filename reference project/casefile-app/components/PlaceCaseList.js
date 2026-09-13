"use client";

import { UNKNOWN_TYPE, stageMeta } from "@/lib/constants";
import { followUpBucket, followUpLabel, formatDate } from "@/lib/followups";

function known(value) {
  return value && value !== UNKNOWN_TYPE;
}

function Row({ label, empty, children }) {
  if (!children) return null;
  return (
    <div className="pc-row">
      <span className="pc-label">{label}</span>
      <span className={`pc-value ${empty ? "pc-value-empty" : ""}`}>{children}</span>
    </div>
  );
}

/**
 * Read-only detail for every case at one pin, in a scrolling column. The point
 * is to answer "what did I apply for here" without opening anything: the
 * fields are laid out to be read, and editing stays behind the explicit
 * "Open case" button.
 */
export default function PlaceCaseList({ place, today, onOpen }) {
  return (
    <ul className="pc-list">
      {place.apps.map(app => {
        const stage = stageMeta(app.status);
        const bucket = followUpBucket(app, today);
        return (
          <li className="pc-item" key={app.id}>
            <div className="pc-head">
              <span className="pc-position">{app.position}</span>
              <span className="pc-stage" style={{ background: stage.color }}>
                {stage.label}
              </span>
            </div>
            <div className="pc-company">{app.company}</div>

            {(known(app.jobType) || known(app.employmentType) || known(app.locationType)) && (
              <div className="pc-tags">
                {known(app.jobType) && <span className="job-type-tag">{app.jobType}</span>}
                {known(app.employmentType) && <span className="plain-tag">{app.employmentType}</span>}
                {known(app.locationType) && <span className="plain-tag">{app.locationType}</span>}
              </div>
            )}

            <div className="pc-rows">
              <Row label="Applied">{formatDate(app.dateApplied)}</Row>
              <Row label="Req ID">{app.requisitionId}</Row>
              <Row label="Follow-up" empty={bucket === "none"}>
                {bucket === "none"
                  ? "none set"
                  : `${followUpLabel(app, today)} (${formatDate(app.followUpDate)})`}
              </Row>
              <Row label="Contact log" empty={!app.communications?.length}>
                {app.communications?.length
                  ? `${app.communications.length} ${app.communications.length === 1 ? "entry" : "entries"}`
                  : "nothing logged"}
              </Row>
            </div>

            {app.notes ? <p className="pc-notes">{app.notes}</p> : null}

            <div className="pc-actions">
              {app.jobUrl ? (
                <a
                  className="btn-link"
                  href={app.jobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Job posting ↗
                </a>
              ) : <span />}
              <button className="pc-open" onClick={() => onOpen(app.id)}>Open case</button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
