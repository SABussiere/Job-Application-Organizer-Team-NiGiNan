"use client";

import { WEEKDAY_LABELS, appsOnDate } from "@/lib/calendar";

// Same colours the board's follow-up chips and card badges already use, so
// a red dot here means exactly what a red badge means everywhere else.
const BUCKET_COLOR = {
  overdue: "var(--rejected)",
  soon: "#9A6400",
  scheduled: "var(--applied)"
};

const MAX_DOTS = 4;

/** One day's dots: a follow-up dot per bucket present, an "applied" dot if
 *  any case was applied to that day, capped with a "+N" overflow count. */
function DayDots({ entries }) {
  if (entries.length === 0) return null;

  const buckets = new Set();
  let appliedCount = 0;
  entries.forEach(e => {
    if (e.kind === "followup") buckets.add(e.bucket);
    else appliedCount++;
  });

  const dots = [...buckets].map(b => ({ key: `f-${b}`, color: BUCKET_COLOR[b] }));
  if (appliedCount > 0) dots.push({ key: "applied", color: "var(--accent)" });

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
 * A plain month grid -- the point of this tab is to just show the dates, so
 * there's no drag-and-drop rescheduling or per-stage filtering here, only
 * "does this day have anything on it" and "click it to find out what".
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
