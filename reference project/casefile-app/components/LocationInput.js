"use client";

import { useEffect, useRef, useState } from "react";
import {
  formatPlace,
  isPlaceless,
  locationStatus,
  regionCode,
  searchPlaces,
  toGeo
} from "@/lib/geocode";

const DEBOUNCE_MS = 300;

/**
 * Location field that checks what you typed against a real gazetteer and
 * stores coordinates alongside the text, which is what puts the case on the
 * Map tab.
 *
 * It never blocks a save. Typing something the geocoder doesn't recognise is
 * allowed and marked unverified, because a location can be legitimately
 * unmappable ("Remote") or newer than the dataset. The badge tells you which
 * you have; it doesn't argue with you.
 */
export default function LocationInput({ id, value, geo, onChange, placeholder, recent = [] }) {
  const [text, setText] = useState(value || "");
  const [places, setPlaces] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef(null);
  const abortRef = useRef(null);

  // Keep in step when the parent swaps to a different application.
  useEffect(() => { setText(value || ""); }, [value]);

  useEffect(() => {
    if (!open) return;
    function onPointer(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  // Debounced lookup. Each keystroke cancels the request in flight, so a
  // slow earlier response can't overwrite results for newer text.
  useEffect(() => {
    const query = text.trim();
    if (!open || query.length < 2 || isPlaceless(query)) {
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
      searchPlaces(query, { signal: controller.signal })
        .then(results => {
          setPlaces(results);
          setBusy(false);
        })
        .catch(e => {
          if (e.name === "AbortError") return;
          setError("Could not reach the location service — you can still type it by hand.");
          setBusy(false);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [text, open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const status = locationStatus(text, text === value ? geo : null);

  // Locations already on the board, offered before any network call so a
  // repeat location is one tap and stays spelled identically.
  const needle = text.trim().toLowerCase();
  const recentMatches = recent
    .filter(r => r.location && r.location.toLowerCase().includes(needle))
    .filter(r => r.location.toLowerCase() !== needle)
    .slice(0, 4);

  function commitFree(nextText) {
    setText(nextText);
    // Typed text no longer matches the verified place, so the coordinates go.
    onChange({ location: nextText, geo: null });
  }

  function pickPlace(place) {
    const label = formatPlace(place);
    setText(label);
    setPlaces([]);
    setOpen(false);
    setHighlight(-1);
    onChange({ location: label, geo: toGeo(place) });
  }

  function pickRecent(entry) {
    setText(entry.location);
    setOpen(false);
    setHighlight(-1);
    onChange({ location: entry.location, geo: entry.geo || null });
  }

  const rows = [
    ...recentMatches.map(r => ({ kind: "recent", entry: r })),
    ...places.map(p => ({ kind: "place", place: p }))
  ];

  function onKeyDown(e) {
    if (e.key === "Escape") { setOpen(false); return; }
    if (e.key === "ArrowDown" && !open) { setOpen(true); return; }
    if (!open || rows.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight(h => (h + 1) % rows.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight(h => (h <= 0 ? rows.length - 1 : h - 1));
    } else if (e.key === "Enter" && highlight >= 0) {
      e.preventDefault();
      const row = rows[highlight];
      if (row.kind === "place") pickPlace(row.place);
      else pickRecent(row.entry);
    }
  }

  return (
    <div className="loc-wrap" ref={wrapRef}>
      <div className="loc-field">
        <input
          id={id}
          type="text"
          value={text}
          placeholder={placeholder || "Toronto, ON, Canada — or Remote"}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          onChange={e => { commitFree(e.target.value); setOpen(true); setHighlight(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {status !== "empty" && (
          <span className={`loc-badge ${status}`} title={
            status === "verified" ? "Matched a real place — this case appears on the map"
              : status === "placeless" ? "No fixed location, so nothing to plot"
              : "Not matched to a place — pick a suggestion to put it on the map"
          }>
            {status === "verified" ? "✓ verified" : status === "placeless" ? "no pin" : "unverified"}
          </span>
        )}
      </div>

      {open && (busy || error || rows.length > 0) && (
        <div className="loc-panel" role="listbox">
          {error && <p className="loc-error">{error}</p>}

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
              <span className="loc-option-note">already used{row.entry.geo ? "" : " · no pin"}</span>
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

          {busy && <p className="loc-busy">Checking...</p>}

          {!busy && !error && rows.length === 0 && text.trim().length >= 2 && (
            <p className="loc-busy">No matching place. You can still save it as typed.</p>
          )}
        </div>
      )}
    </div>
  );
}
