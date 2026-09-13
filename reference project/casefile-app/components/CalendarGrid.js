"use client";

import { WEEKDAY_LABELS, appsOnDate } from "@/lib/calendar";

// Follow-up dots reuse the same colours the board's follow-up chips and
// card badges already use, so a red dot here means exactly what a red badge
// means everywhere else. Applied and interview dots reuse the app's own
// accent and the Interview pipeline stage's colour, for the same reason.
const BUCKET_COLOR = {
  overdue: "var(--rejected)",
  soon: "#9A6400",
  scheduled: "var(--applied)"
};
const KIND_COLOR = {
  applied: "var(--accent)",
  interview: "#10B981"
};

const MAX_DOTS = 4;

/** One day's dots: a follow-up dot per urgency bucket present, plus one dot
 *  each for applied/interview if either happened that day -- capped with a
 *  "+N" overflow count so a busy day doesn't spill dots outside the cell. */
function DayDots({ entries }) {
  if (entries.length === 0) return null;

  const buckets = new Set();
  const kinds = new Set();
  entries.forEach(e => {
    if (e.kind === "followup") buckets.add(e.bucket);
    else kinds.add(e.kind);
  });

  const dots = [
    ...[...buckets].map(b => ({ key: `f-${b}`, color: BUCKET_COLOR[b] })),
    ...[...kinds].map(k => ({ key: k, color: KIND_COLOR[k] }))
  ];

  const shown = dots.slice(0, MAX_DOTS);
  const overflow = dots.length - shown.length;

  return (
    <span className="cal-dots">
      {shown.map(d => (
        <span key={d.key} className="cal-dot" style={{ background: d.color }} />
      ))}
      {overflow > 0 && <span className="cal-dot-more">+{overflow}</span>}
    </span>
  );
}

/**
 * A plain month grid -- the point of this tab is to just show the dates, not
 * to become a second board, so there's no drag-and-drop rescheduling here.
 * It does support filtering which event kinds are plotted at all (the page
 * decides that by pre-filtering `byDate` before handing it down).
 */
export default function CalendarGrid({ grid, byDate, selectedDate, onSelectDate }) {
  return (
    <div>
      <div className="cal-weekdays">
        {WEEKDAY_LABELS.map(w => <span key={w}>{w}</span>)}
      </div>
      <div className="cal-grid">
        {grid.map(cell => {
          const entries = byDate.get(cell.date) || [];
          const count = appsOnDate(byDate, cell.date).length;
          return (
            <button
              type="button"
              key={cell.date}
              className={
                `cal-day ${cell.inMonth ? "" : "outside"} ` +
                `${cell.isToday ? "today" : ""} ${selectedDate === cell.date ? "selected" : ""}`
              }
              onClick={() => onSelectDate(cell.date)}
              aria-pressed={selectedDate === cell.date}
              aria-label={
                count > 0
                  ? `${cell.date}, ${count} ${count === 1 ? "case" : "cases"}`
                  : cell.date
              }
            >
              <span className="cal-day-num">{cell.day}</span>
              <DayDots entries={entries} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
