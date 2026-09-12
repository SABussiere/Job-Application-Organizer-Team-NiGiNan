// lib/filters.js — the Case Board's filter state and the single predicate
// every view uses to decide whether an application is visible. Keeping it
// pure means it can be unit-tested without a browser.

import { matchesFollowUpFilter, todayStr } from "./followups";

export const EMPTY_FILTERS = {
  // Multi-select: empty array means "any". A value must match exactly, since
  // the options are built from the data itself rather than typed by hand.
  companies: [],
  positions: [],
  jobTypes: [],
  employmentTypes: [],
  locationTypes: [],
  locations: [],
  // Single-value: a requisition ID identifies one posting, so there's no
  // sense in asking for several. Matched as a case-insensitive substring so
  // a partial ID still finds it.
  requisitionId: "",
  appliedFrom: "", // YYYY-MM-DD, inclusive
  appliedTo: "",   // YYYY-MM-DD, inclusive
  followUp: "all"
};

/** The multi-select filters, and which application field each reads. */
export const MULTI_FILTERS = [
  { key: "companies", field: "company", label: "Company" },
  { key: "positions", field: "position", label: "Position" },
  { key: "jobTypes", field: "jobType", label: "Job type" },
  { key: "employmentTypes", field: "employmentType", label: "Employment" },
  { key: "locationTypes", field: "locationType", label: "On-site / remote" },
  { key: "locations", field: "location", label: "Location" }
];

/** Presets for the date-applied filter, since "last 30 days" beats typing. */
export const DATE_PRESETS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" }
];

export function presetRange(days, today = todayStr()) {
  const from = new Date(`${today}T00:00:00`);
  from.setDate(from.getDate() - Number(days));
  return { appliedFrom: from.toISOString().slice(0, 10), appliedTo: today };
}

function asList(value) {
  return Array.isArray(value) ? value : [];
}

export function matchesFilters(app, filters, today = todayStr()) {
  const f = { ...EMPTY_FILTERS, ...(filters || {}) };

  for (const { key, field } of MULTI_FILTERS) {
    const selected = asList(f[key]);
    if (selected.length && !selected.includes(app[field] || "")) return false;
  }

  const req = f.requisitionId.trim().toLowerCase();
  if (req && !(app.requisitionId || "").toLowerCase().includes(req)) return false;

  // A case with no date applied can't satisfy a date range, so it drops out
  // rather than silently passing through.
  const applied = app.dateApplied || "";
  if (f.appliedFrom && (!applied || applied < f.appliedFrom)) return false;
  if (f.appliedTo && (!applied || applied > f.appliedTo)) return false;

  return matchesFollowUpFilter(app, f.followUp, today);
}

export function filterApplications(apps, filters, today = todayStr()) {
  return (apps || []).filter(a => matchesFilters(a, filters, today));
}

/** How many filters are narrowing the board right now. */
export function activeFilterCount(filters) {
  const f = { ...EMPTY_FILTERS, ...(filters || {}) };
  let n = 0;
  MULTI_FILTERS.forEach(({ key }) => { n += asList(f[key]).length; });
  if (f.requisitionId.trim()) n++;
  if (f.appliedFrom || f.appliedTo) n++;
  if (f.followUp !== "all") n++;
  return n;
}

/**
 * Options for one multi-select, with how many applications carry each value,
 * so the dropdown can show "Acme Robotics (3)".
 */
export function fieldOptions(apps, field) {
  const counts = new Map();
  (apps || []).forEach(a => {
    const value = a[field];
    if (!value) return;
    counts.set(value, (counts.get(value) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value));
}

/**
 * Values to offer as type-ahead suggestions for a field, most-used first so
 * the employer you keep applying to is the first thing offered. `extra` seeds
 * the list with defaults (the job-type vocabulary) that may not be in the
 * data yet.
 */
export function suggestionValues(apps, field, extra = []) {
  const counts = new Map();
  (apps || []).forEach(a => {
    const value = a[field];
    if (!value) return;
    counts.set(value, (counts.get(value) || 0) + 1);
  });
  const used = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value]) => value);
  const seen = new Set(used.map(v => v.toLowerCase()));
  return [...used, ...extra.filter(v => !seen.has(v.toLowerCase()))];
}

/** Adds or removes one value from a multi-select list. */
export function toggleValue(list, value) {
  const current = asList(list);
  return current.includes(value)
    ? current.filter(v => v !== value)
    : [...current, value];
}

/**
 * Every active filter as a removable chip: `{ id, label, clear }`, where
 * `clear` is the patch that removes just that one.
 */
export function activeChips(filters) {
  const f = { ...EMPTY_FILTERS, ...(filters || {}) };
  const chips = [];

  MULTI_FILTERS.forEach(({ key, label }) => {
    asList(f[key]).forEach(value => {
      chips.push({
        id: `${key}:${value}`,
        label: `${label}: ${value}`,
        clear: { [key]: asList(f[key]).filter(v => v !== value) }
      });
    });
  });

  if (f.requisitionId.trim()) {
    chips.push({
      id: "requisitionId",
      label: `Req ID: ${f.requisitionId.trim()}`,
      clear: { requisitionId: "" }
    });
  }

  if (f.appliedFrom || f.appliedTo) {
    const from = f.appliedFrom || "any";
    const to = f.appliedTo || "any";
    chips.push({
      id: "dates",
      label: `Applied: ${from} → ${to}`,
      clear: { appliedFrom: "", appliedTo: "" }
    });
  }

  return chips;
}
