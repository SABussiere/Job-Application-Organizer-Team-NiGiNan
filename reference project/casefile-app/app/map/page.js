"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { STAGES, stageMeta } from "@/lib/constants";
import { isPlaceless } from "@/lib/geocode";
import { formatDate, todayStr } from "@/lib/followups";
import ApplicationModal from "@/components/ApplicationModal";
import WorldMap, { groupByPlace } from "@/components/WorldMap";

export default function MapPage() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("flat");
  const [stages, setStages] = useState(STAGES);
  const [selected, setSelected] = useState(null);
  const [openId, setOpenId] = useState(null);

  const today = useMemo(() => todayStr(), []);

  const load = useCallback(() => {
    setLoading(true);
    api.listApplications().then(data => {
      setApps(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const shown = useMemo(
    () => apps.filter(a => stages.includes(a.status)),
    [apps, stages]
  );

  const plotted = useMemo(() => groupByPlace(shown), [shown]);
  const pinnedCount = plotted.reduce((n, p) => n + p.apps.length, 0);

  // Cases that can't be drawn, split by why: no location at all, a location
  // with no fixed place ("Remote"), or text that was never matched against
  // the gazetteer.
  const unplottable = useMemo(() => {
    const groups = { empty: [], placeless: [], unverified: [] };
    shown.forEach(a => {
      if (a.geo) return;
      if (!a.location || !a.location.trim()) groups.empty.push(a);
      else if (isPlaceless(a.location)) groups.placeless.push(a);
      else groups.unverified.push(a);
    });
    return groups;
  }, [shown]);

  function toggleStage(stage) {
    setStages(prev =>
      prev.includes(stage) ? prev.filter(s => s !== stage) : [...prev, stage]
    );
  }

  // A pin that drops out of the current filter shouldn't leave a stale panel.
  const selectedPlace = selected
    ? plotted.find(p => p.key === selected) || null
    : null;

  return (
    <div>
      <div className="map-header">
        <div>
          <h2 className="map-title">Where you have applied</h2>
          <p className="hint" style={{ margin: 0 }}>
            {loading
              ? "Loading..."
              : `${pinnedCount} of ${shown.length} cases have a verified location and appear below.`}
          </p>
        </div>
        <div className="map-mode" role="group" aria-label="Map projection">
          <button
            className={`output-tab ${mode === "flat" ? "active" : ""}`}
            onClick={() => setMode("flat")}
          >Flat map</button>
          <button
            className={`output-tab ${mode === "globe" ? "active" : ""}`}
            onClick={() => setMode("globe")}
          >Globe</button>
        </div>
      </div>

      <div className="filter-row-chips" role="group" aria-label="Filter by stage">
        {STAGES.map(s => {
          const on = stages.includes(s);
          const count = apps.filter(a => a.status === s).length;
          return (
            <button
              key={s}
              className={`stage-chip ${on ? "active" : ""}`}
              onClick={() => toggleStage(s)}
              aria-pressed={on}
              style={on ? { borderColor: stageMeta(s).color, color: stageMeta(s).color } : undefined}
            >
              <span className="map-legend-dot" style={{ background: stageMeta(s).color }} />
              {stageMeta(s).label}
              <span className="filter-chip-count">{count}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="hint">Loading your applications...</p>
      ) : (
        <div className="map-layout">
          <WorldMap
            apps={shown}
            mode={mode}
            selectedKey={selected}
            onSelectPlace={place => setSelected(place.key)}
          />

          <aside className="map-side">
            {selectedPlace ? (
              <>
                <div className="map-side-head">
                  <h3>
                    {selectedPlace.geo.city}
                    {selectedPlace.geo.country ? `, ${selectedPlace.geo.country}` : ""}
                  </h3>
                  <button className="btn-link" onClick={() => setSelected(null)}>Clear</button>
                </div>
                <ul className="map-case-list">
                  {selectedPlace.apps.map(app => (
                    <li key={app.id}>
                      <button onClick={() => setOpenId(app.id)}>
                        <span className="map-case-pos">{app.position}</span>
                        <span className="map-case-co">{app.company}</span>
                        <span
                          className="map-case-stage"
                          style={{ color: stageMeta(app.status).color }}
                        >
                          {stageMeta(app.status).label} · applied {formatDate(app.dateApplied)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="hint">
                {plotted.length === 0
                  ? "No cases have a verified location yet. Open a case and pick a suggestion in its Location field to put it on the map."
                  : "Select a pin to list the cases there. Drag to move, and use + and − to zoom."}
              </p>
            )}

            {(unplottable.empty.length > 0 ||
              unplottable.placeless.length > 0 ||
              unplottable.unverified.length > 0) && (
              <div className="map-missing">
                <h4>Not on the map</h4>
                {unplottable.unverified.length > 0 && (
                  <p>
                    <strong>{unplottable.unverified.length}</strong> with a location
                    that was never matched to a place. Reopen the case and pick a
                    suggestion to plot it.
                  </p>
                )}
                {unplottable.placeless.length > 0 && (
                  <p>
                    <strong>{unplottable.placeless.length}</strong> remote or with no
                    fixed location, so there is nothing to pin.
                  </p>
                )}
                {unplottable.empty.length > 0 && (
                  <p>
                    <strong>{unplottable.empty.length}</strong> with no location set.
                  </p>
                )}
              </div>
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
