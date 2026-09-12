"use client";

import { useMemo, useState } from "react";
import { FOLLOWUP_FILTERS, countByBucket } from "@/lib/followups";
import {
  DATE_PRESETS,
  EMPTY_FILTERS,
  MULTI_FILTERS,
  activeChips,
  activeFilterCount,
  fieldOptions,
  presetRange
} from "@/lib/filters";
import MultiSelectFilter from "@/components/MultiSelectFilter";

/**
 * Company, position and location are multi-select because you routinely ask
 * for several at once ("anything at Acme or Globex"). A requisition ID names
 * exactly one posting, so it stays a single text field.
 */
export default function BoardFilters({ apps, filters, onChange, today, resultCount }) {
  const [showDates, setShowDates] = useState(false);
  const counts = countByBucket(apps, today);
  const active = activeFilterCount(filters);
  const chips = activeChips(filters);

  const options = useMemo(() => {
    const map = {};
    MULTI_FILTERS.forEach(({ key, field }) => { map[key] = fieldOptions(apps, field); });
    return map;
  }, [apps]);

  function set(patch) {
    onChange({ ...filters, ...patch });
  }

  function chipCount(value) {
    return value === "all" ? apps.length : counts[value] ?? 0;
  }

  const datesActive = Boolean(filters.appliedFrom || filters.appliedTo);

  return (
    <div className="board-filters">
      <div className="filter-row-main">
        {MULTI_FILTERS.map(({ key, label }) => (
          <MultiSelectFilter
            key={key}
            label={label}
            options={options[key]}
            selected={filters[key] || []}
            onChange={values => set({ [key]: values })}
          />
        ))}

        <div className="req-field">
          <input
            type="text"
            value={filters.requisitionId}
            onChange={e => set({ requisitionId: e.target.value })}
            placeholder="Requisition ID"
            aria-label="Filter by requisition ID"
          />
          {filters.requisitionId && (
            <button
              className="search-clear"
              onClick={() => set({ requisitionId: "" })}
              aria-label="Clear requisition ID filter"
            >×</button>
          )}
        </div>

        <button
          className={`ms-button ${datesActive ? "has-selection" : ""} ${showDates ? "open" : ""}`}
          onClick={() => setShowDates(!showDates)}
          aria-expanded={showDates}
        >
          <span className="ms-button-label">
            {datesActive ? "Date applied · set" : "Date applied"}
          </span>
          <span className="ms-caret" aria-hidden="true">▾</span>
        </button>
      </div>

      {showDates && (
        <div className="filter-row-advanced">
          <div className="filter-field">
            <label htmlFor="filter-from">From</label>
            <input
              id="filter-from"
              type="date"
              value={filters.appliedFrom}
              onChange={e => set({ appliedFrom: e.target.value })}
            />
          </div>
          <div className="filter-field">
            <label htmlFor="filter-to">To</label>
            <input
              id="filter-to"
              type="date"
              value={filters.appliedTo}
              onChange={e => set({ appliedTo: e.target.value })}
            />
          </div>
          <div className="filter-field presets">
            <label>Quick range</label>
            <div className="preset-row">
              {DATE_PRESETS.map(p => (
                <button
                  key={p.value}
                  className="preset-chip"
                  onClick={() => set(presetRange(p.value, today))}
                >
                  {p.label}
                </button>
              ))}
              {datesActive && (
                <button
                  className="preset-chip"
                  onClick={() => set({ appliedFrom: "", appliedTo: "" })}
                >
                  Any date
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="filter-row-chips" role="group" aria-label="Filter by follow-up">
        {FOLLOWUP_FILTERS.map(f => (
          <button
            key={f.value}
            className={`filter-chip ${f.value} ${filters.followUp === f.value ? "active" : ""}`}
            onClick={() => set({ followUp: f.value })}
            aria-pressed={filters.followUp === f.value}
          >
            {f.label}
            <span className="filter-chip-count">{chipCount(f.value)}</span>
          </button>
        ))}
      </div>

      {active > 0 && (
        <div className="filter-summary">
          {chips.map(chip => (
            <button
              key={chip.id}
              className="active-chip"
              onClick={() => set(chip.clear)}
              title="Remove this filter"
            >
              {chip.label}
              <span className="active-chip-x" aria-hidden="true">×</span>
            </button>
          ))}
          <span className="filter-count">
            {resultCount} of {apps.length} {apps.length === 1 ? "case" : "cases"}
          </span>
          <button className="btn-link" onClick={() => onChange({ ...EMPTY_FILTERS })}>
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
