"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const TYPEAHEAD_THRESHOLD = 6;
const PANEL_WIDTH = 260;
const VIEWPORT_MARGIN = 8;

/**
 * A dropdown of checkboxes for picking several values at once. Built rather
 * than using `<select multiple>` because that control is close to unusable
 * on a touchscreen and gives no room for per-option counts.
 *
 * The panel is portaled to document.body and positioned with `fixed`
 * coordinates rather than living inside the button's own wrapper. This
 * button sits in a horizontally-scrolling filter carousel, and the CSS
 * overflow spec doesn't let one axis be `visible` while the other isn't --
 * `overflow-x: auto` on that carousel silently forces `overflow-y` to
 * compute as `auto` too, no matter what it's declared as, which was
 * clipping this panel to nothing. Rendering it outside that scroll
 * container's DOM subtree sidesteps the rule entirely instead of fighting it.
 */
export default function MultiSelectFilter({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const [needle, setNeedle] = useState("");
  const [coords, setCoords] = useState(null);
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const panelRef = useRef(null);
  const searchRef = useRef(null);

  function updatePosition() {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(rect.left, window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN)
    );
    setCoords({ top: rect.bottom + 4, left });
  }

  useLayoutEffect(() => {
    if (open) updatePosition();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointer(e) {
      const inButton = wrapRef.current && wrapRef.current.contains(e.target);
      const inPanel = panelRef.current && panelRef.current.contains(e.target);
      if (!inButton && !inPanel) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    // capture: true so this also fires for scrolling inside the filter
    // carousel itself, not just the window -- scroll events don't bubble.
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
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
        ref={btnRef}
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

      {open && coords && createPortal(
        <div
          className="ms-panel"
          role="group"
          aria-label={label}
          ref={panelRef}
          style={{ position: "fixed", top: coords.top, left: coords.left }}
        >
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
        </div>,
        document.body
      )}
    </div>
  );
}
