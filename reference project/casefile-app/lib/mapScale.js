// lib/mapScale.js — the sequential scale for the heat map.
//
// One hue, light to dark, because the encoded thing is magnitude (how many
// applications). Teal rather than the more usual blue: the board already uses
// blue to mean the Applied stage, and reusing it here would make the same
// colour mean two different things on one screen.
//
// The steps are anchored on the app's own accent tokens (--accent-soft at the
// light end, --accent at the dark end) and verified for monotonically falling
// OKLab lightness with a 6 degree hue spread, which is the check that matters
// for a sequential ramp.

/**
 * Counts here are small integers, so explicit bins beat a continuous scale:
 * the reader can map a shade back to a number instead of guessing.
 */
export const HEAT_BINS = [
  { min: 1, max: 1, label: "1", color: "#C5E0D8" },
  { min: 2, max: 3, label: "2–3", color: "#9BCCBE" },
  { min: 4, max: 6, label: "4–6", color: "#6BB29F" },
  { min: 7, max: 10, label: "7–10", color: "#3F9480" },
  { min: 11, max: Infinity, label: "11+", color: "#1F6F5C" }
];

/** Countries with nothing keep the basemap grey, so zero never reads as low. */
export const HEAT_EMPTY = "#DDE3E6";

export function heatColor(count) {
  if (!count) return HEAT_EMPTY;
  const bin = HEAT_BINS.find(b => count >= b.min && count <= b.max);
  return bin ? bin.color : HEAT_EMPTY;
}

/** Bins actually present in the data, so the legend shows no empty steps. */
export function usedBins(counts) {
  const values = [...counts.values()].filter(Boolean);
  return HEAT_BINS.filter(b => values.some(v => v >= b.min && v <= b.max));
}
