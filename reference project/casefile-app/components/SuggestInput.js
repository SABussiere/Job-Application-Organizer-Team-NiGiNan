"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * A text field that suggests values already in use, while still accepting
 * anything typed. Used for company, position and job type so the same
 * employer doesn't end up stored three different ways — which matters
 * because the board's filter options are built from these exact strings.
 *
 * The list only opens once there's something typed (or on ArrowDown), not
 * on bare focus — a freshly opened, empty field shouldn't immediately dump
 * every value ever entered in front of the cursor.
 *
 * Built rather than using `<datalist>` so the dropdown looks the same in
 * every browser and stays tappable on a phone.
 */
export default function SuggestInput({
  id,
  value,
  onChange,
  options,
  placeholder,
  inputRef,
  maxVisible = 8
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef(null);

  const matches = useMemo(() => {
    const needle = (value || "").trim().toLowerCase();
    const all = options || [];
    // An exact single match is no longer a suggestion worth showing.
    if (all.length === 1 && all[0].toLowerCase() === needle) return [];
    const hits = needle ? all.filter(o => o.toLowerCase().includes(needle)) : all;
    if (hits.length === 1 && hits[0].toLowerCase() === needle) return [];
    return hits.slice(0, maxVisible);
  }, [options, value, maxVisible]);

  useEffect(() => {
    if (!open) return;
    function onPointer(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  function pick(option) {
    onChange(option);
    setOpen(false);
    setHighlight(-1);
  }

  function onKeyDown(e) {
    if (e.key === "Escape") { setOpen(false); return; }
    if (!open || matches.length === 0) {
      if (e.key === "ArrowDown") setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight(h => (h + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight(h => (h <= 0 ? matches.length - 1 : h - 1));
    } else if (e.key === "Enter" && highlight >= 0) {
      e.preventDefault();
      pick(matches[highlight]);
    }
  }

  const showList = open && matches.length > 0;

  return (
    <div className="suggest-wrap" ref={wrapRef}>
      <input
        id={id}
        ref={inputRef}
        type="text"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-autocomplete="list"
        onChange={e => { onChange(e.target.value); setOpen(true); setHighlight(-1); }}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul className="suggest-list" role="listbox">
          {matches.map((option, i) => (
            <li key={option}>
              <button
                type="button"
                role="option"
                aria-selected={i === highlight}
                className={`suggest-option ${i === highlight ? "highlight" : ""}`}
                // mousedown fires before the input's blur, so the pick lands.
                onMouseDown={e => { e.preventDefault(); pick(option); }}
                onMouseEnter={() => setHighlight(i)}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
