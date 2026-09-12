// lib/geocode.js — turns typed text into a verified place with coordinates.
//
// Provider is Open-Meteo's geocoding API: no API key, no billing account, no
// per-teammate setup, and it sends `access-control-allow-origin: *` so the
// browser calls it directly — which keeps this app free of a server layer,
// the same way Firestore does. It returns the city, the province or state
// (admin1), the country and a latitude/longitude, which is exactly the set
// the Map tab needs.
//
// Everything funnels through searchPlaces(), so swapping in a keyed provider
// later (Google Places, Mapbox) means rewriting one function.

const ENDPOINT = "https://geocoding-api.open-meteo.com/v1/search";

// Province and state abbreviations, so a verified place reads the way job
// postings write it ("Toronto, ON, Canada") instead of spelling out the
// region. Anywhere else keeps its full region name.
const REGION_CODES = {
  CA: {
    "Alberta": "AB",
    "British Columbia": "BC",
    "Manitoba": "MB",
    "New Brunswick": "NB",
    "Newfoundland and Labrador": "NL",
    "Northwest Territories": "NT",
    "Nova Scotia": "NS",
    "Nunavut": "NU",
    "Ontario": "ON",
    "Prince Edward Island": "PE",
    "Quebec": "QC",
    "Saskatchewan": "SK",
    "Yukon": "YT"
  },
  US: {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR",
    "California": "CA", "Colorado": "CO", "Connecticut": "CT",
    "Delaware": "DE", "District of Columbia": "DC", "Florida": "FL",
    "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID", "Illinois": "IL",
    "Indiana": "IN", "Iowa": "IA", "Kansas": "KS", "Kentucky": "KY",
    "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
    "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN",
    "Mississippi": "MS", "Missouri": "MO", "Montana": "MT",
    "Nebraska": "NE", "Nevada": "NV", "New Hampshire": "NH",
    "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
    "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH",
    "Oklahoma": "OK", "Oregon": "OR", "Pennsylvania": "PA",
    "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD",
    "Tennessee": "TN", "Texas": "TX", "Utah": "UT", "Vermont": "VT",
    "Virginia": "VA", "Washington": "WA", "West Virginia": "WV",
    "Wisconsin": "WI", "Wyoming": "WY"
  }
};

/**
 * Locations with no point on a map, which are still perfectly valid answers
 * to "where is this job". Matched case-insensitively; these skip the
 * geocoder entirely rather than being reported as unverifiable.
 */
export const PLACELESS = ["remote", "fully remote", "hybrid", "anywhere", "various"];

export function isPlaceless(text) {
  return PLACELESS.includes(String(text || "").trim().toLowerCase());
}

export function regionCode(region, countryCode) {
  const table = REGION_CODES[countryCode];
  return (table && table[region]) || region || "";
}

/** "Toronto, ON, Canada" — the canonical string stored on an application. */
export function formatPlace(place) {
  if (!place) return "";
  return [place.city, regionCode(place.region, place.countryCode), place.country]
    .filter(Boolean)
    .join(", ");
}

function normalize(result) {
  return {
    // Open-Meteo's numeric id, stable enough to key a list on.
    id: String(result.id),
    city: result.name || "",
    region: result.admin1 || "",
    country: result.country || "",
    countryCode: result.country_code || "",
    lat: typeof result.latitude === "number" ? result.latitude : null,
    lon: typeof result.longitude === "number" ? result.longitude : null,
    population: result.population ?? null
  };
}

/**
 * Candidate places for typed text, best match first. Returns [] for a blank
 * query, for a placeless value like "Remote", and for text the provider
 * doesn't recognise — the caller decides whether that means "keep typing" or
 * "this isn't a real place".
 */
export async function searchPlaces(text, { count = 6, signal } = {}) {
  const query = String(text || "").trim();
  if (query.length < 2 || isPlaceless(query)) return [];

  // Only the first segment is a place name the provider knows: someone
  // typing "Toronto, ON" should still match Toronto.
  const name = query.split(",")[0].trim();

  const url =
    `${ENDPOINT}?name=${encodeURIComponent(name)}` +
    `&count=${count}&language=en&format=json`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Location lookup failed (${res.status})`);
  const body = await res.json();
  // A query that matches nothing comes back with no `results` key at all.
  const results = Array.isArray(body.results) ? body.results : [];
  return results.map(normalize).filter(p => p.city);
}

/**
 * The geo object stored alongside an application's location string. Null
 * whenever there's nothing to put on a map, which the Map tab treats as
 * "not plottable" rather than as an error.
 */
export function toGeo(place) {
  if (!place || place.lat === null || place.lon === null) return null;
  return {
    city: place.city,
    region: place.region,
    country: place.country,
    countryCode: place.countryCode,
    lat: place.lat,
    lon: place.lon
  };
}

/** How a stored location should be described in the UI. */
export function locationStatus(location, geo) {
  const text = String(location || "").trim();
  if (!text) return "empty";
  if (isPlaceless(text)) return "placeless";
  return geo ? "verified" : "unverified";
}
