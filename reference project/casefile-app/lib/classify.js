// Turns a raw email ({ from, subject, snippet, bodyText }) into structured
// application fields: company, position, status. Rule-based (keyword +
// regex) for now — swap extractApplicationFields() for an LLM call later
// without changing what it returns.

import { STAGES } from "./constants";

const JOB_KEYWORDS = ["application", "applied", "interview", "offer", "position", "recruiter", "hiring"];

const ATS_DOMAINS = ["greenhouse.io", "lever.co", "myworkday.com", "icims.com", "smartrecruiters.com", "ashbyhq.com"];

export function isLikelyJobEmail({ from, subject, snippet }) {
  const haystack = `${from} ${subject} ${snippet}`.toLowerCase();
  if (ATS_DOMAINS.some(domain => haystack.includes(domain))) return true;
  return JOB_KEYWORDS.some(keyword => haystack.includes(keyword));
}

const STATUS_RULES = [
  { status: "rejected", patterns: [/regret to inform/i, /not moving forward/i, /decided not to proceed/i, /pursue other candidates/i] },
  { status: "offer", patterns: [/pleased to offer/i, /extend (you |)an offer/i, /offer letter/i] },
  { status: "interview", patterns: [/schedule (a |an )?interview/i, /interview availability/i, /next steps? in (the |our )?(interview|hiring) process/i] },
  { status: "applied", patterns: [/thank you for applying/i, /received your application/i, /application (has been |was )?received/i] }
];

function guessStatus(text) {
  for (const rule of STATUS_RULES) {
    if (rule.patterns.some(p => p.test(text))) return rule.status;
  }
  return null;
}

function guessCompany(from) {
  const match = from.match(/^"?([^"<]+)"?\s*<(.+)>$/);
  if (match) {
    const displayName = match[1].trim();
    if (displayName && !displayName.includes("@")) return displayName;
    const domain = match[2].split("@")[1];
    return domain ? domain.split(".")[0] : "";
  }
  return from.split("@")[0] || "";
}

function guessPosition(subject, bodyText) {
  const text = `${subject} ${bodyText}`;
  const match =
    text.match(/for the (?:position|role) of ([A-Za-z0-9 /&-]{3,60})/i) ||
    text.match(/application for ([A-Za-z0-9 /&-]{3,60})/i);
  return match ? match[1].trim() : "";
}

export async function extractApplicationFields({ from, subject, snippet, bodyText }) {
  const status = guessStatus(`${subject} ${bodyText}`) || "applied";
  if (!STAGES.includes(status)) return null;

  const company = guessCompany(from);
  const position = guessPosition(subject, bodyText);

  return {
    company: company || "Unknown company",
    position: position || "Unknown position",
    status,
    confidence: position && company ? 0.6 : 0.3
  };
}
