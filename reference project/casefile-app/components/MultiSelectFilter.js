"use client";

import { useEffect, useRef, useState } from "react";

const TYPEAHEAD_THRESHOLD = 6;

/**
 * A dropdown of checkboxes for picking several values at once. Built rather
 * than using `<select multiple>` because that control is close to unusable
 * on a touchscreen and gives no room for per-option counts.
 */
export default function MultiSelectFilter({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const [needle, setNeedle] = useState("");
  const wrapRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open && options.length > TYPEAHEAD_THRESHOLD) searchRef.current?.focus();
  }, [open, options.length]);

  const visible = needle.trim()
    ? options.filter(o => o.value.toLowerCase().includes(needle.trim().toLowerCase()))
    : options;

  const summary =
    selected.length === 0 ? label :
    selected.length === 1 ? selected[0] :
    `${label} · ${selected.length}`;

  function toggle(value) {
    onChange(
      selected.includes(value)
        ? selected.filter(v => v !== value)
        : [...selected, value]
    );
  }

  return (
    <div className="ms-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`ms-button ${selected.length ? "has-selection" : ""} ${open ? "open" : ""}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
        disabled={options.length === 0}
        title={options.length === 0 ? `No ${label.toLowerCase()} values yet` : undefined}
      >
        <span className="ms-button-label">{summary}</span>
        <span className="ms-caret" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="ms-panel" role="group" aria-label={label}>
          {options.length > TYPEAHEAD_THRESHOLD && (
            <input
              ref={searchRef}
              className="ms-search"
              type="text"
              value={needle}
              onChange={e => setNeedle(e.target.value)}
              placeholder={`Find a ${label.toLowerCase()}...`}
            />
          )}

          <div className="ms-options">
            {visible.length === 0 ? (
              <p className="ms-empty">No matches</p>
            ) : (
              visible.map(o => (
                <label className="ms-option" key={o.value}>
                  <input
                    type="checkbox"
                    checked={selected.includes(o.value)}
                    onChange={() => toggle(o.value)}
                  />
                  <span className="ms-option-label">{o.value}</span>
                  <span className="ms-option-count">{o.count}</span>
                </label>
              ))
            )}
          </div>

          {selected.length > 0 && (
            <button type="button" className="btn-link ms-clear" onClick={() => onChange([])}>
              Clear {label.toLowerCase()}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
