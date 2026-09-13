"use client";

import { useMemo, useRef, useState } from "react";
import {
  geoContains,
  geoDistance,
  geoEqualEarth,
  geoGraticule10,
  geoOrthographic,
  geoPath
} from "d3-geo";
import { feature } from "topojson-client";
import world from "world-atlas/countries-110m.json";
import usTopo from "us-atlas/states-10m.json";
import caTopo from "@/lib/geo-data/canada-provinces-10m.json";
import { STAGES, stageMeta } from "@/lib/constants";
import { HEAT_EMPTY, heatColor, usedBins } from "@/lib/mapScale";

// Country outlines are a bundled TopoJSON file (108KB at 110m resolution),
// not map tiles: no tile server, no API key, and the map works offline.
//
// Three disputed territories in this file (Northern Cyprus, Somaliland,
// Kosovo) ship with no id at all, which would make them collide with each
// other as a single Map key for heat counts and click selection. Falling
// back to the feature's own name keeps each one distinct; every other
// country already has a proper numeric id and is untouched.
const COUNTRIES = feature(world, world.objects.countries).features.map(f =>
  f.id == null ? { ...f, id: `unnamed-${f.properties.name}` } : f
);

// world-atlas has no data below the country level anywhere, so state or
// province detail only exists where a second, per-country dataset has been
// added. The US is the one covered so far (us-atlas, 114KB, official Census
// Bureau shapes) -- everywhere else still resolves to its whole country.
// Extending this to another country means finding an equally small,
// unprojected (lon/lat) TopoJSON source for it and appending here the same
// way.
const US_COUNTRY_ID = "840";
const US_STATES = feature(usTopo, usTopo.objects.states).features.map(f => ({
  ...f,
  // Prefixed so a state's two-digit FIPS code can never collide with a
  // world-atlas country id.
  id: `us-${f.id}`,
  properties: { name: f.properties.name, country: "United States" }
}));

// Canada has no equally official sibling package, so this one is a
// hand-built asset in lib/geo-data (see that folder's README for source,
// licence and how to rebuild it) rather than an npm dependency.
const CANADA_COUNTRY_ID = "124";
const CANADA_PROVINCES = feature(caTopo, caTopo.objects.provinces).features.map((f, i) => ({
  ...f,
  id: `ca-${i}`,
  properties: { name: f.properties.name, country: "Canada" }
}));

// The regions actually drawn and hit-tested: every country except the ones
// replaced by their subdivisions, so heat shading and clicks resolve at
// that finer grain there.
const REGIONS = [
  ...COUNTRIES.filter(f => f.id !== US_COUNTRY_ID && f.id !== CANADA_COUNTRY_ID),
  ...US_STATES,
  ...CANADA_PROVINCES
];

const FLAT = { width: 960, height: 480 };
const GLOBE = { width: 620, height: 620 };

// Which stage wins when several cases share one city. Furthest along
// reads as the most useful headline for a pin.
const STAGE_RANK = { offer: 4, interview: 3, applied: 2, rejected: 1 };

// rotate([lambda, phi]) centres the point [-lambda, -phi], so [90, -20]
// looks at longitude -90, latitude 20: North America.
const INITIAL_ROTATION = [90, -20];

function dominantStatus(apps) {
  return apps.reduce(
    (best, a) => ((STAGE_RANK[a.status] || 0) > (STAGE_RANK[best] || 0) ? a.status : best),
    apps[0].status
  );
}

/** Groups cases by rounded coordinate, so one city is one pin. */
export function groupByPlace(apps) {
  const groups = new Map();
  (apps || []).forEach(app => {
    if (!app.geo || typeof app.geo.lat !== "number" || typeof app.geo.lon !== "number") return;
    const key = `${app.geo.lat.toFixed(2)},${app.geo.lon.toFixed(2)}`;
    if (!groups.has(key)) {
      groups.set(key, { key, geo: app.geo, apps: [] });
    }
    groups.get(key).apps.push(app);
  });
  return [...groups.values()].map(g => ({ ...g, status: dominantStatus(g.apps) }));
}

/**
 * Applications per region, by testing each pin against the region polygons
 * (countries, plus US states in place of the whole US). Point-in-polygon
 * rather than matching names, because the gazetteer and the basemap name
 * places differently ("United States" against "United States of America"),
 * and a name mismatch would silently lose a region from the heat map.
 */
function countByRegion(places) {
  const counts = new Map();
  places.forEach(place => {
    const point = [place.geo.lon, place.geo.lat];
    const region = REGIONS.find(f => geoContains(f, point));
    if (!region) return;
    counts.set(region.id, (counts.get(region.id) || 0) + place.apps.length);
  });
  return counts;
}

export { REGIONS, dominantStatus };

export default function WorldMap({ apps, mode, view, onSelectPlace, selectedKey }) {
  const isGlobe = mode === "globe";
  const isHeat = view === "heat";
  const size = isGlobe ? GLOBE : FLAT;

  const [rotation, setRotation] = useState(INITIAL_ROTATION);
  const [offset, setOffset] = useState([0, 0]);
  const [zoom, setZoom] = useState(1);
  const dragRef = useRef(null);
  const wasDraggedRef = useRef(false);

  const places = useMemo(() => groupByPlace(apps), [apps]);
  const counts = useMemo(() => (isHeat ? countByRegion(places) : new Map()), [isHeat, places]);
  const bins = useMemo(() => usedBins(counts), [counts]);

  const projection = useMemo(() => {
    if (isGlobe) {
      return geoOrthographic()
        .rotate(rotation)
        .scale(((size.height - 40) / 2) * zoom)
        .translate([size.width / 2, size.height / 2]);
    }
    const p = geoEqualEarth().fitExtent(
      [[6, 6], [size.width - 6, size.height - 6]],
      { type: "Sphere" }
    );
    p.scale(p.scale() * zoom);
    const [tx, ty] = p.translate();
    p.translate([tx + offset[0], ty + offset[1]]);
    return p;
  }, [isGlobe, rotation, zoom, offset, size.width, size.height]);

  const path = useMemo(() => geoPath(projection), [projection]);
  const graticule = useMemo(() => path(geoGraticule10()), [path]);
  const sphere = useMemo(() => path({ type: "Sphere" }), [path]);

  // On a globe, half the pins are round the back and must not be drawn.
  const center = isGlobe ? [-rotation[0], -rotation[1]] : null;
  function isVisible(geo) {
    if (!isGlobe) return true;
    return geoDistance([geo.lon, geo.lat], center) < Math.PI / 2;
  }

  function onPointerDown(e) {
    if (e.button !== 0) return;
    wasDraggedRef.current = false;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      isDragging: false,
      rotation: [...rotation],
      offset: [...offset]
    };
  }

  function onPointerMove(e) {
    const drag = dragRef.current;
    if (!drag) return;
    const totalDx = e.clientX - drag.startX;
    const totalDy = e.clientY - drag.startY;

    if (!drag.isDragging) {
      if (Math.hypot(totalDx, totalDy) > 4) {
        drag.isDragging = true;
        wasDraggedRef.current = true;
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } else {
        return;
      }
    }

    if (isGlobe) {
      // Slower than 1:1 so a small drag doesn't spin the world away, and
      // latitude is clamped so it can't tumble past the poles.
      const lambda = drag.rotation[0] + totalDx * 0.35;
      const phi = Math.max(-90, Math.min(90, drag.rotation[1] - totalDy * 0.35));
      setRotation([lambda, phi]);
    } else {
      setOffset([drag.offset[0] + totalDx, drag.offset[1] + totalDy]);
    }
  }

  function onPointerUp(e) {
    if (dragRef.current?.isDragging) {
      wasDraggedRef.current = true;
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    }
    dragRef.current = null;
  }

  function reset() {
    setRotation(INITIAL_ROTATION);
    setOffset([0, 0]);
    setZoom(1);
  }

  // Pins stay clickable in heat view, just smaller, since selecting one is
  // how you read the cases behind a shaded country.
  const pinScale = isHeat ? 0.7 : 1;

  return (
    <div className={`map-stage ${isGlobe ? "globe" : "flat"}`}>
      <div className="map-controls">
        <button onClick={() => setZoom(z => Math.min(6, z * 1.3))} aria-label="Zoom in">+</button>
        <button onClick={() => setZoom(z => Math.max(0.6, z / 1.3))} aria-label="Zoom out">−</button>
        <button onClick={reset} className="map-reset">Reset</button>
      </div>

      <svg
        className={`world-map ${isGlobe ? "globe" : "flat"}`}
        viewBox={`0 0 ${size.width} ${size.height}`}
        role="img"
        aria-label={
          isHeat
            ? `Applications across ${counts.size} ${counts.size === 1 ? "region" : "regions"} -- countries, and states or provinces within the US and Canada`
            : `${places.length} locations with applications`
        }
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {isGlobe && <path className="map-ocean" d={sphere} />}
        <path className="map-graticule" d={graticule} />

        {REGIONS.map(f => {
          const isSubdivision = f.id.startsWith("us-") || f.id.startsWith("ca-");
          const regionLabel = isSubdivision
            ? `${f.properties.name}, ${f.properties.country}`
            : f.properties.name;
          const count = counts.get(f.id) || 0;
          const isSelected = selectedKey === `region:${f.id}`;
          const regionPlaces = places.filter(place => geoContains(f, [place.geo.lon, place.geo.lat]));
          const hasPlaces = regionPlaces.length > 0;
          return (
            <path
              key={f.id}
              className={
                `map-country ${isSubdivision ? "is-subdivision" : ""} ` +
                `${isHeat && count ? "has-data" : ""} ${hasPlaces ? "has-places" : ""} ${isSelected ? "selected" : ""}`
              }
              d={path(f)}
              style={isHeat ? { fill: heatColor(count) } : undefined}
              onClick={e => {
                if (wasDraggedRef.current) return;
                if (regionPlaces.length > 0) {
                  e.stopPropagation();
                  if (regionPlaces.length === 1) {
                    onSelectPlace(regionPlaces[0]);
                  } else {
                    const allApps = regionPlaces.flatMap(p => p.apps);
                    onSelectPlace({
                      key: `region:${f.id}`,
                      geo: {
                        city: f.properties.name,
                        country: isSubdivision ? f.properties.country : ""
                      },
                      apps: allApps,
                      status: dominantStatus(allApps)
                    });
                  }
                }
              }}
            >
              <title>
                {count > 0
                  ? `${regionLabel}: ${count} ${count === 1 ? "application" : "applications"}`
                  : regionLabel}
              </title>
            </path>
          );
        })}

        {isGlobe && <path className="map-outline" d={sphere} />}

        {places.map(place => {
          if (!isVisible(place.geo)) return null;
          const point = projection([place.geo.lon, place.geo.lat]);
          if (!point) return null;
          const [x, y] = point;
          const count = place.apps.length;
          const radius = (5 + Math.min(7, (count - 1) * 2.2)) * pinScale;
          const isSelected = selectedKey === place.key;
          return (
            <g
              key={place.key}
              className={`map-pin ${isSelected ? "selected" : ""}`}
              transform={`translate(${x},${y})`}
              onClick={e => {
                if (wasDraggedRef.current) return;
                e.stopPropagation();
                onSelectPlace(place);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={e => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectPlace(place);
                }
              }}
            >
              <title>
                {`${place.geo.city}${place.geo.country ? `, ${place.geo.country}` : ""} — ` +
                  `${count} ${count === 1 ? "case" : "cases"}`}
              </title>
              <circle className="map-pin-hit" r={Math.max(13, radius + 6)} />
              <circle
                className="map-pin-dot"
                r={radius}
                style={{ fill: stageMeta(place.status).color }}
              />
              {count > 1 && !isHeat && (
                <text className="map-pin-count" dy="0.35em">{count}</text>
              )}
            </g>
          );
        })}
      </svg>

      {isHeat ? (
        <div className="map-legend">
          <span className="map-legend-title">Applications per country</span>
          <span className="heat-scale">
            {bins.length === 0 ? (
              <span className="map-legend-note">Nothing plotted yet.</span>
            ) : (
              bins.map(b => (
                <span className="heat-step" key={b.label}>
                  <span className="heat-swatch" style={{ background: b.color }} />
                  {b.label}
                </span>
              ))
            )}
            <span className="heat-step">
              <span className="heat-swatch" style={{ background: HEAT_EMPTY }} />
              none
            </span>
          </span>
          <span className="map-legend-note">
            Shading counts applications per country, and per state or
            province within the US and Canada. Pins keep their stage
            colour, so you can still select a city.
          </span>
        </div>
      ) : (
        <div className="map-legend">
          {STAGES.map(s => (
            <span className="map-legend-item" key={s}>
              <span className="map-legend-dot" style={{ background: stageMeta(s).color }} />
              {stageMeta(s).label}
            </span>
          ))}
          <span className="map-legend-note">
            A pin takes the colour of its furthest-along case, and its number
            when a city holds more than one.
          </span>
        </div>
      )}
    </div>
  );
}
