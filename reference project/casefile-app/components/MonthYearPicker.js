"use client";

import { useEffect, useRef, useState } from "react";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const YEARS_PER_PAGE = 12;

/**
 * The calendar tab's month/year trigger, expanded into a two-step picker:
 * pick the year first, then the month within it, rather than only being
 * able to step one month at a time via the prev/next arrows.
 */
export default function MonthYearPicker({ label, year, month, onSelect }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState("year");
  const [pickerYear, setPickerYear] = useState(year);
  const [yearPageStart, setYearPageStart] = useState(year - (year % YEARS_PER_PAGE));
  const wrapRef = useRef(null);

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

  function openPicker() {
    setStep("year");
    setYearPageStart(year - (year % YEARS_PER_PAGE));
    setOpen(true);
  }

  function pickYear(y) {
    setPickerYear(y);
    setStep("month");
  }

  function pickMonth(m) {
    onSelect(pickerYear, m);
    setOpen(false);
  }

  const years = Array.from({ length: YEARS_PER_PAGE }, (_, i) => yearPageStart + i);

  return (
    <div className="cal-picker-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`cal-month-label cal-month-trigger ${open ? "open" : ""}`}
        onClick={() => (open ? setOpen(false) : openPicker())}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {label}
      </button>

      {open && (
        <div className="cal-picker-panel" role="group" aria-label="Choose month and year">
          {step === "year" ? (
            <>
              <div className="cal-picker-head">
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => setYearPageStart(y => y - YEARS_PER_PAGE)}
                  aria-label="Earlier years"
                >
                  «
                </button>
                <span>{years[0]}–{years[years.length - 1]}</span>
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => setYearPageStart(y => y + YEARS_PER_PAGE)}
                  aria-label="Later years"
                >
                  »
                </button>
              </div>
              <div className="cal-picker-grid">
                {years.map(y => (
                  <button
                    key={y}
                    type="button"
                    className={`cal-picker-cell ${y === year ? "current" : ""}`}
                    onClick={() => pickYear(y)}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="cal-picker-head">
                <button type="button" className="btn-link" onClick={() => setStep("year")}>
                  ‹ {pickerYear}
                </button>
              </div>
              <div className="cal-picker-grid">
                {MONTH_ABBR.map((label, m) => (
                  <button
                    key={label}
                    type="button"
                    className={`cal-picker-cell ${pickerYear === year && m === month ? "current" : ""}`}
                    onClick={() => pickMonth(m)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
