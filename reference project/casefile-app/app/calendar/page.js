"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { todayStr } from "@/lib/followups";
import {
  EVENT_KINDS,
  appsOnDate,
  buildMonthGrid,
  countDistinctByKind,
  filterByKind,
  groupAppsByDate,
  monthLabel,
  shiftMonth
} from "@/lib/calendar";
import CalendarGrid from "@/components/CalendarGrid";
import PlaceCaseList from "@/components/PlaceCaseList";
import ApplicationModal from "@/components/ApplicationModal";

export default function CalendarPage() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);

  const today = useMemo(() => todayStr(), []);
  const now = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(today);
  const [enabledKinds, setEnabledKinds] = useState(EVENT_KINDS.map(k => k.value));

  const load = useCallback(() => {
    setLoading(true);
    api.listApplications().then(data => {
      setApps(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const grid = useMemo(
    () => buildMonthGrid(viewYear, viewMonth, today),
    [viewYear, viewMonth, today]
  );
  // Unfiltered, so a chip's own count never changes depending on whether
  // that chip happens to be switched on -- and filtered, which is what the
  // grid and the selected day's list actually use.
  const fullByDate = useMemo(() => groupAppsByDate(apps, today), [apps, today]);
  const byDate = useMemo(() => filterByKind(fullByDate, enabledKinds), [fullByDate, enabledKinds]);
  const kindCounts = useMemo(() => countDistinctByKind(fullByDate), [fullByDate]);
  const selectedApps = useMemo(
    () => (selectedDate ? appsOnDate(byDate, selectedDate) : []),
    [byDate, selectedDate]
  );

  function toggleKind(kind) {
    setEnabledKinds(prev =>
      prev.includes(kind) ? prev.filter(k => k !== kind) : [...prev, kind]
    );
  }

  function goToMonth(delta) {
    const next = shiftMonth(viewYear, viewMonth, delta);
    setViewYear(next.year);
    setViewMonth(next.month);
  }

  function goToToday() {
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setSelectedDate(today);
  }

  function formatSelected(dateStr) {
    if (!dateStr) return "";
    const d = new Date(`${dateStr}T00:00:00`);
    return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  }

  return (
    <div>
      <div className="map-header">
        <div>
          <h2 className="map-title">Calendar</h2>
          <p className="hint" style={{ margin: 0 }}>
            Every date applied, interview logged, and follow-up due, laid out
            by day.
          </p>
        </div>
        <div className="cal-nav">
          <button type="button" className="btn-secondary-inline" onClick={() => goToMonth(-1)} aria-label="Previous month">‹</button>
          <span className="cal-month-label">{monthLabel(viewYear, viewMonth)}</span>
          <button type="button" className="btn-secondary-inline" onClick={() => goToMonth(1)} aria-label="Next month">›</button>
          <button type="button" className="btn-secondary-inline" onClick={goToToday}>Today</button>
        </div>
      </div>

      <div className="filter-row-chips" role="group" aria-label="Filter by event kind">
        {EVENT_KINDS.map(k => {
          const on = enabledKinds.includes(k.value);
          return (
            <button
              key={k.value}
              type="button"
              className={`stage-chip ${on ? "active" : ""}`}
              onClick={() => toggleKind(k.value)}
              aria-pressed={on}
            >
              {k.value === "followup" ? (
                // Follow-up dots vary by urgency (red/amber/blue), so the
                // chip shows all three rather than one colour that would
                // only ever match some of them.
                <span className="cal-kind-swatch-multi">
                  <span className="map-legend-dot" style={{ background: "var(--rejected)" }} />
                  <span className="map-legend-dot" style={{ background: "#9A6400" }} />
                  <span className="map-legend-dot" style={{ background: "var(--applied)" }} />
                </span>
              ) : (
                <span
                  className="map-legend-dot"
                  style={{ background: k.value === "applied" ? "var(--accent)" : "#10B981" }}
                />
              )}
              {k.label}
              <span className="filter-chip-count">{kindCounts[k.value]}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="hint">Loading your applications...</p>
      ) : (
        <div className="map-layout">
          <div className="folder-panel cal-panel">
            <CalendarGrid
              grid={grid}
              byDate={byDate}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
            <div className="cal-legend">
              <span className="cal-legend-item"><span className="cal-dot" style={{ background: "var(--rejected)" }} />Follow-up past due</span>
              <span className="cal-legend-item"><span className="cal-dot" style={{ background: "#9A6400" }} />Follow-up due soon</span>
              <span className="cal-legend-item"><span className="cal-dot" style={{ background: "var(--applied)" }} />Follow-up scheduled</span>
              <span className="cal-legend-item"><span className="cal-dot" style={{ background: "var(--accent)" }} />Applied that day</span>
              <span className="cal-legend-item"><span className="cal-dot" style={{ background: "#10B981" }} />Interview logged</span>
            </div>
          </div>

          <aside className="map-side">
            <div className="map-side-head">
              <h3>{formatSelected(selectedDate)}</h3>
              {selectedDate !== today && (
                <button className="btn-link" onClick={() => setSelectedDate(today)}>Jump to today</button>
              )}
            </div>
            {selectedApps.length === 0 ? (
              <p className="hint">
                {enabledKinds.length === 0
                  ? "No event kinds are switched on above."
                  : "Nothing matches the current filters on this day."}
              </p>
            ) : (
              <PlaceCaseList
                place={{ apps: selectedApps }}
                today={today}
                onOpen={setOpenId}
              />
            )}
          </aside>
        </div>
      )}

      {openId && (
        <ApplicationModal
          appId={openId}
          apps={apps}
          onClose={() => setOpenId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
