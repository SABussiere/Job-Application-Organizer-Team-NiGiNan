// Turns a raw email ({ from, subject, snippet, bodyText }) into structured
// application fields: company, position, status. Rule-based (keyword +
// regex) for now — swap extractApplicationFields() for an LLM call later
// without changing what it returns.

import { STAGES } from "./constants";

const JOB_KEYWORDS = ["application", "applied", "interview", "offer", "position", "recruiter", "hiring"];

const ATS_DOMAINS = ["greenhouse.io", "lever.co", "myworkday.com", "icims.com", "smartrecruiters.com", "ashbyhq.com"];

// Domains that host job postings/notifications on behalf of many different
// employers — the "From" domain here is never the actual company you applied
// to, so guessCompany() falls back to looking for a named employer in the
// email body instead of reporting the platform itself as the company.
const JOB_PLATFORM_ROOTS = new Set([
  "greenhouse", "lever", "myworkday", "icims", "smartrecruiters", "ashbyhq",
  "workable", "indeed", "linkedin", "glassdoor", "ziprecruiter"
]);

// A real recruiting email essentially never comes from a personal inbox with
// a human's own name as the display name — when it does, that display name
// is not the company, so guessCompany() falls back to the body text instead
// of trusting it the way it would for "Acme Recruiting <hr@acme.com>".
const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "aol.com", "protonmail.com"
]);

export function isLikelyJobEmail({ from, subject, snippet }) {
  const haystack = `${from} ${subject} ${snippet}`.toLowerCase();
  if (ATS_DOMAINS.some(domain => haystack.includes(domain))) return true;
  return JOB_KEYWORDS.some(keyword => haystack.includes(keyword));
}

const STATUS_RULES = [
  { status: "rejected", patterns: [/regret to inform/i, /not moving forward/i, /decided not to proceed/i, /pursue other candidates/i, /moving forward with (?:other|another) candidate/i, /decided to (?:go|move forward) with (?:other|another) candidate/i] },
  { status: "offer", patterns: [/pleased to offer/i, /extend (?:you |)an offer/i, /offer letter/i, /excited to offer/i] },
  { status: "interview", patterns: [/schedule (?:a |an )?interview/i, /interview availability/i, /next steps? in (?:the |our )?(?:interview|hiring) process/i, /would like to (?:speak|chat|meet) with you/i] },
  { status: "applied", patterns: [/thank you for applying/i, /received your application/i, /application (?:has been |was )?received/i] }
];

function guessStatus(text) {
  for (const rule of STATUS_RULES) {
    if (rule.patterns.some(p => p.test(text))) return rule.status;
  }
  return null;
}

function domainRoot(domain) {
  // "boards.greenhouse.io" -> "greenhouse", "acme.com" -> "acme": the second-
  // to-last label is the actual registrable name in the common case, while
  // domain.split(".")[0] would grab a subdomain like "boards" or "mail".
  const parts = domain.toLowerCase().split(".");
  return parts.length >= 2 ? parts[parts.length - 2] : parts[0];
}

// Looks for a named employer mentioned in running text — "...at Acme Corp",
// "...with Acme Corp" — used when the sender is a job platform rather than
// the employer itself, so the domain can't be trusted as the company name.
function guessEmployerFromText(subject, bodyText) {
  const text = `${subject}\n${bodyText}`;
  // A run of capitalized words only — each word's own lowercase letters are
  // fine ("Vertex", "Dynamics"), but a lowercase word breaks the chain, so
  // this can't wander into "at Acme Corp next week" or across a sentence
  // boundary the way a plain [^.,!?]* class would.
  const match = text.match(/\b(?:at|with|(?:applying|application) to) ([A-Z][A-Za-z0-9&'-]*(?:[ \t]+[A-Z][A-Za-z0-9&'-]*){0,3})/);
  return match ? match[1].trim() : "";
}

function guessCompany(from, subject, bodyText) {
  const match = from.match(/^"?([^"<]+)"?\s*<(.+)>$/);
  const displayName = match ? match[1].trim() : "";
  const emailAddr = match ? match[2] : from;
  const domain = (emailAddr.split("@")[1] || "").toLowerCase();
  const root = domain ? domainRoot(domain) : "";
  const isPersonalDomain = PERSONAL_EMAIL_DOMAINS.has(domain);
  const isPlatformDomain = root && JOB_PLATFORM_ROOTS.has(root);

  // Domain check comes first: a job platform's own display name (e.g.
  // "Workable") would otherwise pass the "looks like a real name" check
  // below and win before ever considering it's a platform, not an employer.
  if (isPersonalDomain || isPlatformDomain) {
    return guessEmployerFromText(subject, bodyText);
  }

  if (displayName && !displayName.includes("@") && !/no.?reply|notifications?$/i.test(displayName)) {
    return displayName;
  }

  return root || "";
}

// Cuts a regex capture back down to just the role name: a raw match often
// drags in a trailing clause ("...Co-op job was submitted successfully") or
// a redundant "position"/"role" the pattern below already accounts for.
function cleanPosition(raw) {
  if (!raw) return "";
  let text = raw.split(/\b(?:was|has been|have been|is now|successfully|submitted|received)\b/i)[0];
  text = text.replace(/\s+(?:position|role|job)$/i, "");
  text = text.replace(/^the\s+/i, "");
  text = text.replace(/\s+/g, " ").trim().slice(0, 60);
  text = text.replace(/[.,;:!?]+$/, "").trim();
  return text;
}

// Tried in order against "subject\nbodyText" combined; stops at the first
// pattern that matches. Each capture is non-greedy and bounded by a real
// word boundary (" at ", " with ", punctuation, or end of line) so it can't
// run on into the rest of the sentence the way a bare {3,60} used to.
const POSITION_PATTERNS = [
  /for the (?:position|role) of ([^.,\n]{3,60}?)(?=\s+(?:at|with)\b|[.,!\n]|$)/i,
  // "application for X" names the role; "application to Acme Corp" names the
  // company instead — only "for" reliably means what follows is a job title.
  /application for (?:the )?([^.,\n]{3,60}?)(?:\s+position|\s+role)?(?=\s+(?:at|with)\b|[.,!\n]|$)/i,
  /applying for (?:the )?([^.,\n]{3,60}?)(?:\s+position|\s+role)?(?=\s+(?:at|with)\b|[.,!\n]|$)/i,
  /your interest in (?:the )?([^.,\n]{3,60}?)(?:\s+position|\s+role)?(?=\s+(?:at|with)\b|[.,!\n]|$)/i,
  /interview for (?:the )?([^.,\n]{3,60}?)(?:\s+position|\s+role)?(?=\s+(?:at|with)\b|[.,!\n]|$)/i,
  /extend (?:you |)an offer for (?:the )?([^.,\n]{3,60}?)(?:\s+position|\s+role)?(?=\s+(?:at|with)\b|[.,!\n]|$)/i,
  /the ([^.,\n]{3,60}?) (?:position|role) at/i
];

// "your interest in joining our team" is a phrase, not a role name — reject
// captures that start with one of these so a generic template sentence
// falls through to "Unknown position" instead of a bogus non-title.
const POSITION_REJECT = /^(?:joining|being|becoming|hearing|working|moving)\b/i;

function guessPosition(subject, bodyText) {
  const text = `${subject}\n${bodyText}`;
  for (const pattern of POSITION_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const cleaned = cleanPosition(match[1]);
      if (cleaned && !POSITION_REJECT.test(cleaned)) return cleaned;
    }
  }
  return "";
}

export async function extractApplicationFields({ from, subject, snippet, bodyText }) {
  const status = guessStatus(`${subject} ${bodyText}`) || "applied";
  if (!STAGES.includes(status)) return null;

  const company = guessCompany(from, subject, bodyText);
  const position = guessPosition(subject, bodyText);

  return {
    company: company || "Unknown company",
    position: position || "Unknown position",
    status,
    confidence: position && company ? 0.6 : 0.3
  };
}
