// lib/matching.js — deterministic, dependency-free keyword matching between
// a job description and the user's resume modules. No external API, no
// network call — this is the "keyword matching" tier described in the
// README; swap in an LLM-backed version later without touching callers,
// since everything funnels through scoreModules() and selectModules().

import { dateRange } from "./latex";

const STOPWORDS = new Set([
  "a","an","the","and","or","but","if","then","so","of","to","in","on","at",
  "for","with","by","from","as","is","are","was","were","be","been","being",
  "this","that","these","those","it","its","you","your","we","our","they",
  "their","will","would","can","could","should","must","shall","may","might",
  "have","has","had","do","does","did","not","no","nor","than","too","very",
  "about","into","over","under","between","through","per","etc","including",
  "who","what","when","where","why","how","all","any","each","other","some",
  "such","only","own","same","also","across","within","while","after",
  "before","above","below","more","most","up","down","out","off"
]);

// A small set of common resume/job-posting synonyms so "engineer" matches
// "engineering", "manage" matches "management", etc., without pulling in a
// real stemming library.
const SYNONYM_GROUPS = [
  ["engineer", "engineering", "engineers"],
  ["manage", "management", "manager", "managing", "managed"],
  ["lead", "leader", "leadership", "leading", "led"],
  ["design", "designer", "designing", "designed"],
  ["develop", "developer", "development", "developing", "developed"],
  ["build", "builder", "building", "built"],
  ["analyze", "analysis", "analyst", "analyzing", "analytics"],
  ["test", "testing", "tester", "tested"],
  ["communicate", "communication", "communicating"]
];
const SYNONYM_MAP = new Map();
for (const group of SYNONYM_GROUPS) {
  for (const word of group) SYNONYM_MAP.set(word, group[0]);
}

function normalize(word) {
  const lower = word.toLowerCase();
  return SYNONYM_MAP.get(lower) || lower;
}

export function tokenize(text) {
  if (!text) return [];
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9+.#\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  return words
    .filter(w => w.length > 2 && !STOPWORDS.has(w))
    .map(normalize);
}

function bulletsOf(module) {
  if (!Array.isArray(module.bullets)) return [];
  return module.bullets.map(b => String(b).trim()).filter(Boolean);
}

/**
 * Everything in a module that should count as matchable body text. Bullet
 * points carry most of the signal now that modules are structured, so they
 * matter at least as much as the free-form content field.
 */
export function moduleSearchText(module) {
  return [
    module.title,
    module.organization,
    module.location,
    module.content,
    ...bulletsOf(module)
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Scores every module against a job description.
 * Tag matches count for more than incidental word overlap in body content,
 * since tags are the user's own deliberate signal of what a module is about.
 */
export function scoreModules(jobDescription, modules) {
  const jdTokens = new Set(tokenize(jobDescription));
  if (jdTokens.size === 0) {
    return modules.map(m => ({ module: m, score: 0, matchedTags: [], matchedWords: [] }));
  }

  return modules.map(module => {
    const tagTokens = (module.tags || []).map(t => normalize(String(t).trim()));
    const matchedTags = (module.tags || []).filter((t, i) => jdTokens.has(tagTokens[i]));

    const contentTokens = new Set(tokenize(moduleSearchText(module)));
    const matchedWords = [...contentTokens].filter(w => jdTokens.has(w));

    // Tags are a deliberate signal from the user, so weight them heavily;
    // body-text overlap is a weaker, supporting signal.
    const score = matchedTags.length * 3 + matchedWords.length;

    return { module, score, matchedTags, matchedWords: matchedWords.slice(0, 8) };
  });
}

/**
 * Picks which modules to include in a tailored resume: everything marked
 * alwaysInclude, plus the highest-scoring remaining modules up to a cap so
 * the result stays a reasonable resume length rather than the whole master.
 */
export function selectModules(jobDescription, modules, { maxOptional = 6 } = {}) {
  const scored = scoreModules(jobDescription, modules);
  const always = scored.filter(s => s.module.alwaysInclude);
  const optional = scored
    .filter(s => !s.module.alwaysInclude && s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxOptional);

  const chosen = [...always, ...optional].sort((a, b) => {
    // Preserve the master's original ordering among chosen modules so the
    // assembled resume still reads in a sensible order (summary first, etc.)
    return (a.module.order ?? 0) - (b.module.order ?? 0);
  });

  return {
    selected: chosen.map(c => c.module),
    details: chosen
  };
}

/** Plain-text rendering of one structured module. */
export function moduleToText(module) {
  const lines = [];
  const heading = [module.title, module.organization].filter(Boolean).join(" — ");
  if (heading) lines.push(heading);

  const meta = [module.location, dateRange(module)].filter(Boolean).join(" · ");
  if (meta) lines.push(meta);

  const content = (module.content || "").trim();
  if (content) lines.push(content);

  bulletsOf(module).forEach(b => lines.push(`- ${b}`));

  return lines.join("\n").trim();
}

/**
 * Turns a list of modules into resume text. Sorted by each module's `order`
 * by default; pass `{ sort: false }` when the caller has already put them in
 * the order it wants (a hand-reordered tailored resume, for instance).
 */
export function assembleResumeText(modules, { sort = true } = {}) {
  const list = sort
    ? modules.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    : modules.slice();

  return list
    .map(moduleToText)
    .filter(Boolean)
    .join("\n\n")
    .trim();
}
