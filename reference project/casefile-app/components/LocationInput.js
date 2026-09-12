"use client";

import { useEffect, useRef, useState } from "react";
import {
  UNKNOWN_LOCATION,
  formatPlace,
  isUnknownLocation,
  locationStatus,
  regionCode,
  searchPlaces,
  toGeo
} from "@/lib/geocode";

const DEBOUNCE_MS = 300;

/**
 * Strict location picker. What you type is a search query, not a value: the
 * case only takes a location when you pick a matched place or choose Unknown.
 * Abandoning a half-typed query restores whatever was already set.
 *
 * That rule is why the Map tab can be trusted — a location on the board is
 * either a real point or explicitly unknown, never a plausible-looking string
 * nobody checked.
 */
export default function LocationInput({ id, value, geo, onChange, recent = [] }) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(false);
  const [places, setPlaces] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef(null);
  const abortRef = useRef(null);

  const status = locationStatus(value, geo);

  // A legacy value needs replacing, so open straight into editing with it
  // pre-filled as the query rather than presenting it as settled.
  useEffect(() => {
    if (status === "legacy") setQuery(value || "");
  }, [status, value]);

  function stopEditing() {
    setEditing(false);
    setQuery("");
    setPlaces([]);
    setHighlight(-1);
    setError("");
  }

  useEffect(() => {
    if (!editing) return;
    function onPointer(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) stopEditing();
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [editing]);

  // Debounced lookup. Each keystroke aborts the request in flight, so a slow
  // earlier response can't overwrite results for newer text.
  useEffect(() => {
    const text = query.trim();
    if (!editing || text.length < 2) {
      setPlaces([]);
      setBusy(false);
      return;
    }

    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setBusy(true);
      setError("");
      searchPlaces(text, { signal: controller.signal })
        .then(results => { setPlaces(results); setBusy(false); })
        .catch(e => {
          if (e.name === "AbortError") return;
          setError("Could not reach the location service. Try again, or set it as Unknown.");
          setBusy(false);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, editing]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const needle = query.trim().toLowerCase();
  // Verified locations already on the board: one tap, no network call, and
  // the coordinates come along.
  const recentMatches = recent
    .filter(r => r.geo && r.location)
    .filter(r => !needle || r.location.toLowerCase().includes(needle))
    .filter(r => r.location !== value)
    .slice(0, 4);

  const rows = [
    ...recentMatches.map(r => ({ kind: "recent", entry: r })),
    ...places.map(p => ({ kind: "place", place: p }))
  ];

  function pickPlace(place) {
    onChange({ location: formatPlace(place), geo: toGeo(place) });
    stopEditing();
  }

  function pickRecent(entry) {
    onChange({ location: entry.location, geo: entry.geo });
    stopEditing();
  }

  function pickUnknown() {
    onChange({ location: UNKNOWN_LOCATION, geo: null });
    stopEditing();
  }

  function onKeyDown(e) {
    if (e.key === "Escape") { stopEditing(); return; }
    if (rows.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight(h => (h + 1) % rows.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight(h => (h <= 0 ? rows.length - 1 : h - 1));
    } else if (e.key === "Enter") {
      // Enter never commits raw text — only a highlighted match.
      e.preventDefault();
      if (highlight < 0) return;
      const row = rows[highlight];
      if (row.kind === "place") pickPlace(row.place);
      else pickRecent(row.entry);
    }
  }

  if (!editing) {
    return (
      <div className="loc-wrap" ref={wrapRef}>
        <button
          type="button"
          id={id}
          className={`loc-current ${status}`}
          onClick={() => { setEditing(true); setHighlight(-1); }}
        >
          <span className="loc-current-text">
            {status === "unknown" ? UNKNOWN_LOCATION : value}
          </span>
          <span className={`loc-badge ${status}`}>
            {status === "verified" ? "✓ verified"
              : status === "unknown" ? "no pin"
              : "needs checking"}
          </span>
        </button>
        {status === "legacy" && (
          <p className="loc-note warn">
            Saved before locations were checked. Pick a match or set it to
            Unknown before saving.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="loc-wrap" ref={wrapRef}>
      <input
        id={id}
        type="text"
        value={query}
        placeholder="Type a city, then pick a match"
        autoComplete="off"
        autoFocus
        role="combobox"
        aria-expanded
        aria-autocomplete="list"
        onChange={e => { setQuery(e.target.value); setHighlight(-1); }}
        onKeyDown={onKeyDown}
      />

      <div className="loc-panel" role="listbox">
        {error && <p className="loc-note error">{error}</p>}

        {rows.map((row, i) => row.kind === "recent" ? (
          <button
            type="button"
            key={`r-${row.entry.location}`}
            role="option"
            aria-selected={i === highlight}
            className={`loc-option ${i === highlight ? "highlight" : ""}`}
            onMouseDown={e => { e.preventDefault(); pickRecent(row.entry); }}
            onMouseEnter={() => setHighlight(i)}
          >
            <span className="loc-option-main">{row.entry.location}</span>
            <span className="loc-option-note">already on the board</span>
          </button>
        ) : (
          <button
            type="button"
            key={`p-${row.place.id}`}
            role="option"
            aria-selected={i === highlight}
            className={`loc-option ${i === highlight ? "highlight" : ""}`}
            onMouseDown={e => { e.preventDefault(); pickPlace(row.place); }}
            onMouseEnter={() => setHighlight(i)}
          >
            <span className="loc-option-main">{row.place.city}</span>
            <span className="loc-option-note">
              {[regionCode(row.place.region, row.place.countryCode), row.place.country]
                .filter(Boolean)
                .join(", ")}
            </span>
          </button>
        ))}

        {busy && <p className="loc-note">Checking...</p>}

        {!busy && !error && query.trim().length >= 2 && places.length === 0 && (
          <p className="loc-note">
            No place matches {`"${query.trim()}"`}. Check the spelling, try the
            nearest city, or set it to Unknown.
          </p>
        )}

        {!busy && query.trim().length < 2 && rows.length === 0 && (
          <p className="loc-note">Type at least two letters.</p>
        )}

        <div className="loc-panel-foot">
          <button type="button" className="loc-unknown" onMouseDown={e => { e.preventDefault(); pickUnknown(); }}>
            Set to Unknown
          </button>
          {!isUnknownLocation(value) && value && (
            <button type="button" className="btn-link" onMouseDown={e => { e.preventDefault(); stopEditing(); }}>
              Keep {value}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
