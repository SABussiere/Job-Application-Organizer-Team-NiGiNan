"use client";

import { useMemo, useRef, useState } from "react";
import {
  geoDistance,
  geoEqualEarth,
  geoGraticule10,
  geoOrthographic,
  geoPath
} from "d3-geo";
import { feature } from "topojson-client";
import world from "world-atlas/countries-110m.json";
import { STAGES, stageMeta } from "@/lib/constants";

// Country outlines are a bundled TopoJSON file (108KB at 110m resolution),
// not map tiles: no tile server, no API key, and the map works offline.
const COUNTRIES = feature(world, world.objects.countries).features;

const FLAT = { width: 960, height: 480 };
const GLOBE = { width: 620, height: 620 };

// Which stage wins when several cases share one city. Furthest along
// reads as the most useful headline for a pin.
const STAGE_RANK = { offer: 4, interview: 3, applied: 2, rejected: 1 };

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

export default function WorldMap({ apps, mode, onSelectPlace, selectedKey }) {
  const isGlobe = mode === "globe";
  const size = isGlobe ? GLOBE : FLAT;

  // rotate([lambda, phi]) centres the point [-lambda, -phi], so [90, -20]
  // looks at longitude -90, latitude 20: North America.
  const [rotation, setRotation] = useState(INITIAL_ROTATION);
  const [offset, setOffset] = useState([0, 0]);
  const [zoom, setZoom] = useState(1);
  const dragRef = useRef(null);
  const svgRef = useRef(null);

  const places = useMemo(() => groupByPlace(apps), [apps]);

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
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      rotation: [...rotation],
      offset: [...offset]
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (isGlobe) {
      // Slower than 1:1 so a small drag doesn't spin the world away, and
      // latitude is clamped so it can't tumble past the poles.
      const lambda = drag.rotation[0] + dx * 0.35;
      const phi = Math.max(-90, Math.min(90, drag.rotation[1] - dy * 0.35));
      setRotation([lambda, phi]);
    } else {
      setOffset([drag.offset[0] + dx, drag.offset[1] + dy]);
    }
  }

  function onPointerUp(e) {
    dragRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }

  function reset() {
    setRotation(INITIAL_ROTATION);
    setOffset([0, 0]);
    setZoom(1);
  }

  return (
    <div className="map-stage">
      <div className="map-controls">
        <button onClick={() => setZoom(z => Math.min(6, z * 1.3))} aria-label="Zoom in">+</button>
        <button onClick={() => setZoom(z => Math.max(0.6, z / 1.3))} aria-label="Zoom out">−</button>
        <button onClick={reset} className="map-reset">Reset</button>
      </div>

      <svg
        ref={svgRef}
        className={`world-map ${isGlobe ? "globe" : "flat"}`}
        viewBox={`0 0 ${size.width} ${size.height}`}
        role="img"
        aria-label={`${places.length} locations with applications`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {isGlobe && <path className="map-ocean" d={sphere} />}
        <path className="map-graticule" d={graticule} />
        {COUNTRIES.map(f => (
          <path key={f.id} className="map-country" d={path(f)} />
        ))}
        {isGlobe && <path className="map-outline" d={sphere} />}

        {places.map(place => {
          if (!isVisible(place.geo)) return null;
          const point = projection([place.geo.lon, place.geo.lat]);
          if (!point) return null;
          const [x, y] = point;
          const count = place.apps.length;
          const radius = 5 + Math.min(7, (count - 1) * 2.2);
          const isSelected = selectedKey === place.key;
          return (
            <g
              key={place.key}
              className={`map-pin ${isSelected ? "selected" : ""}`}
              transform={`translate(${x},${y})`}
              onClick={e => { e.stopPropagation(); onSelectPlace(place); }}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === "Enter") onSelectPlace(place); }}
            >
              <title>
                {`${place.geo.city}${place.geo.country ? `, ${place.geo.country}` : ""} — ` +
                  `${count} ${count === 1 ? "case" : "cases"}`}
              </title>
              <circle className="map-pin-halo" r={radius + 5} />
              <circle
                className="map-pin-dot"
                r={radius}
                style={{ fill: stageMeta(place.status).color }}
              />
              {count > 1 && (
                <text className="map-pin-count" dy="0.35em">{count}</text>
              )}
            </g>
          );
        })}
      </svg>

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
    </div>
  );
}
