"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { STAGES, stageMeta } from "@/lib/constants";
import { locationStatus } from "@/lib/geocode";
import { todayStr } from "@/lib/followups";
import ApplicationModal from "@/components/ApplicationModal";
import { geoContains } from "d3-geo";
import WorldMap, { COUNTRIES, dominantStatus, groupByPlace } from "@/components/WorldMap";
import PlaceCaseList from "@/components/PlaceCaseList";

export default function MapPage() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("flat");
  const [view, setView] = useState("pins");
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

  // Cases that can't be drawn. A location is either a matched place or
  // Unknown, so the only other case is text saved before checking existed.
  const unplottable = useMemo(() => {
    const groups = { unknown: [], legacy: [] };
    shown.forEach(a => {
      if (a.geo) return;
      if (locationStatus(a.location, a.geo) === "legacy") groups.legacy.push(a);
      else groups.unknown.push(a);
    });
    return groups;
  }, [shown]);

  function toggleStage(stage) {
    setStages(prev =>
      prev.includes(stage) ? prev.filter(s => s !== stage) : [...prev, stage]
    );
  }

  // A pin that drops out of the current filter shouldn't leave a stale panel.
  const selectedPlace = useMemo(() => {
    if (!selected) return null;
    const pinMatch = plotted.find(p => p.key === selected);
    if (pinMatch) return pinMatch;
    if (selected.startsWith("country:")) {
      const countryId = selected.slice(8);
      const countryFeature = COUNTRIES.find(c => String(c.id) === String(countryId));
      if (!countryFeature) return null;
      const countryPlaces = plotted.filter(p => geoContains(countryFeature, [p.geo.lon, p.geo.lat]));
      if (countryPlaces.length === 0) return null;
      const allApps = countryPlaces.flatMap(p => p.apps);
      return {
        key: selected,
        geo: {
          city: countryFeature.properties.name,
          country: ""
        },
        apps: allApps,
        status: dominantStatus(allApps)
      };
    }
    return null;
  }, [selected, plotted]);

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
        <div className="map-switches">
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
          <div className="map-mode" role="group" aria-label="Map encoding">
            <button
              className={`output-tab ${view === "pins" ? "active" : ""}`}
              onClick={() => setView("pins")}
            >Pins</button>
            <button
              className={`output-tab ${view === "heat" ? "active" : ""}`}
              onClick={() => setView("heat")}
            >Heat</button>
          </div>
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
            view={view}
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
                    <span className="map-side-count">
                      {selectedPlace.apps.length}{" "}
                      {selectedPlace.apps.length === 1 ? "case" : "cases"}
                    </span>
                  </h3>
                  <button className="btn-link" onClick={() => setSelected(null)}>Clear</button>
                </div>
                <PlaceCaseList
                  place={selectedPlace}
                  today={today}
                  onOpen={setOpenId}
                />
              </>
            ) : (
              <p className="hint">
                {plotted.length === 0
                  ? "No cases have a verified location yet. Open a case and pick a city in its Location field to put it on the map."
                  : "Select a pin to read the cases there. Drag to move, and use + and − to zoom."}
              </p>
            )}

            {(unplottable.unknown.length > 0 || unplottable.legacy.length > 0) && (
              <div className="map-missing">
                <h4>Not on the map</h4>
                {unplottable.unknown.length > 0 && (
                  <p>
                    <strong>{unplottable.unknown.length}</strong> with an unknown
                    location. There is no point to plot, which is the whole
                    purpose of Unknown.
                  </p>
                )}
                {unplottable.legacy.length > 0 && (
                  <p>
                    <strong>{unplottable.legacy.length}</strong> saved before
                    locations were checked. Open the case and pick a match to plot
                    it, or set it to Unknown.
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
