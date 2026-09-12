// lib/followups.js — one place that decides what "past due" and "due soon"
// mean, so the board filter, the card indicator and the Follow-ups page can
// never disagree with each other.

export const SOON_WITHIN_DAYS = 7;

// Board filter options, in the order they appear in the filter bar.
export const FOLLOWUP_FILTERS = [
  { value: "all", label: "All" },
  { value: "overdue", label: "Past due" },
  { value: "soon", label: "Due soon" },
  { value: "scheduled", label: "Scheduled" },
  { value: "none", label: "No follow-up" }
];

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/** Whole days from `today` until `dateStr`; negative means it's in the past. */
export function daysUntil(dateStr, today = todayStr()) {
  if (!dateStr) return null;
  const a = Date.parse(`${dateStr}T00:00:00`);
  const b = Date.parse(`${today}T00:00:00`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((a - b) / 86400000);
}

/**
 * Which follow-up bucket an application falls into. A rejected case counts
 * as "none" regardless of its date — there's nothing left to chase.
 */
export function followUpBucket(app, today = todayStr()) {
  if (!app || !app.followUpDate || app.status === "rejected") return "none";
  const days = daysUntil(app.followUpDate, today);
  if (days === null) return "none";
  if (days < 0) return "overdue";
  if (days <= SOON_WITHIN_DAYS) return "soon";
  return "scheduled";
}

export function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** Short human label for a card badge: "3 days overdue", "Due in 4 days". */
export function followUpLabel(app, today = todayStr()) {
  const bucket = followUpBucket(app, today);
  if (bucket === "none") return "";
  const days = daysUntil(app.followUpDate, today);
  if (days < 0) {
    const n = Math.abs(days);
    return n === 1 ? "1 day overdue" : `${n} days overdue`;
  }
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (bucket === "soon") return `Due in ${days} days`;
  return `Follow up ${formatDate(app.followUpDate)}`;
}

export function matchesFollowUpFilter(app, filter, today = todayStr()) {
  if (!filter || filter === "all") return true;
  return followUpBucket(app, today) === filter;
}

/** { overdue: n, soon: n, scheduled: n, none: n } across a list of apps. */
export function countByBucket(apps, today = todayStr()) {
  const counts = { overdue: 0, soon: 0, scheduled: 0, none: 0 };
  (apps || []).forEach(a => { counts[followUpBucket(a, today)]++; });
  return counts;
}
