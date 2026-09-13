// lib/calendar.js — pure date math for the calendar tab, kept separate from
// the grid component the same way lib/followups.js is kept separate from
// the board: so the day-grouping rules can be unit-tested without a
// browser, and the component only has to worry about layout.

import { followUpBucket, todayStr } from "./followups";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export { WEEKDAY_LABELS };

/**
 * Formats y/m/d as YYYY-MM-DD using the calendar's own local fields, not
 * `toISOString()` (which converts to UTC first and can land on the wrong
 * date near midnight in timezones ahead of UTC).
 */
function toDateStr(y, m, d) {
  const dt = new Date(y, m, d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/**
 * A 6-week grid (42 days) for the given month, starting on the Sunday at or
 * before the 1st and running long enough to always cover the whole month in
 * one fixed-size grid — so the grid never reflows height between months.
 * `month` is 0-based (January = 0), matching `Date`.
 */
export function buildMonthGrid(year, month, today = todayStr()) {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay(); // 0 = Sunday
  const gridStart = new Date(year, month, 1 - startOffset);

  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const dateStr = toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
    days.push({
      date: dateStr,
      day: d.getDate(),
      inMonth: d.getMonth() === month,
      isToday: dateStr === today
    });
  }
  return days;
}

export function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric"
  });
}

/** { year, month } for the month before/after the given one (month is 0-based). */
export function shiftMonth(year, month, delta) {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

/**
 * The three kinds of day a case can land on, and what a filter chip for each
 * should say. Order here is the display/priority order used everywhere else
 * in this module (applied, then interview, then follow-up).
 */
export const EVENT_KINDS = [
  { value: "applied", label: "Applied" },
  { value: "interview", label: "Interview" },
  { value: "followup", label: "Follow-up" }
];

/**
 * Every application indexed by the calendar day it belongs to. A single case
 * can appear on several different days here: the day it was applied to,
 * the day of any interview logged in its communications, and the day its
 * follow-up is due — all real events worth seeing. Rejected cases are
 * skipped for the follow-up day (matching followUpBucket's own rule: there's
 * nothing left to chase) but still show on their applied and interview days,
 * since those already happened regardless of how the case ended.
 */
export function groupAppsByDate(apps, today = todayStr()) {
  const byDate = new Map();

  function add(dateStr, entry) {
    if (!dateStr) return;
    if (!byDate.has(dateStr)) byDate.set(dateStr, []);
    byDate.get(dateStr).push(entry);
  }

  (apps || []).forEach(app => {
    if (app.dateApplied) {
      add(app.dateApplied, { app, kind: "applied" });
    }
    (app.communications || []).forEach(comm => {
      if (comm.type === "interview" && comm.date) {
        add(comm.date, { app, kind: "interview" });
      }
    });
    if (app.followUpDate && app.status !== "rejected") {
      add(app.followUpDate, { app, kind: "followup", bucket: followUpBucket(app, today) });
    }
  });

  return byDate;
}

/**
 * A copy of `byDate` with only the given event kinds kept, and any day that
 * ends up with nothing left dropped entirely — so a filtered-out kind can
 * never leave a stray empty dot or an emptied-but-still-"has events" day.
 */
export function filterByKind(byDate, enabledKinds) {
  const enabled = new Set(enabledKinds);
  const filtered = new Map();
  for (const [date, entries] of byDate) {
    const kept = entries.filter(e => enabled.has(e.kind));
    if (kept.length > 0) filtered.set(date, kept);
  }
  return filtered;
}

/**
 * How many distinct cases carry each event kind at all, across every date in
 * `byDate` (typically the *unfiltered* map, so a filter chip's own count
 * doesn't change depending on whether that chip happens to be on).
 */
export function countDistinctByKind(byDate) {
  const seen = { applied: new Set(), interview: new Set(), followup: new Set() };
  for (const entries of byDate.values()) {
    entries.forEach(e => { seen[e.kind]?.add(e.app.id); });
  }
  return {
    applied: seen.applied.size,
    interview: seen.interview.size,
    followup: seen.followup.size
  };
}

/** All apps landing on one day, in EVENT_KINDS order, for a detail list. */
export function appsOnDate(byDate, dateStr) {
  const entries = byDate.get(dateStr) || [];
  const seen = new Set();
  const ordered = [];
  // One pass per kind in display order, so a case that landed here for
  // several reasons (applied and interviewed the same day, say) is listed
  // once, at the position of whichever reason ranks first.
  EVENT_KINDS.forEach(({ value }) => {
    entries
      .filter(e => e.kind === value)
      .forEach(e => { if (!seen.has(e.app.id)) { seen.add(e.app.id); ordered.push(e.app); } });
  });
  return ordered;
}
