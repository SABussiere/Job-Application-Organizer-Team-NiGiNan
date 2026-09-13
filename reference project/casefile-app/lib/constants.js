export const STAGES = ["applied", "interview", "offer", "rejected"];

export const STAGE_META = {
  applied: { label: "Applied", color: "#3B82F6" },
  interview: { label: "Interview", color: "#10B981" },
  offer: { label: "Offer", color: "#F59E0B" },
  rejected: { label: "Rejected", color: "#DC2626" }
};

// Fallback so an unrecognised status can never crash a card render.
export const UNKNOWN_STAGE = { label: "Unknown", color: "#9CA3AF" };

export function stageMeta(status) {
  return STAGE_META[status] || { ...UNKNOWN_STAGE, label: status || "Unknown" };
}

/**
 * Suggested job types. A posting's title varies wildly for the same work
 * ("SWE Intern", "Software Developer Co-op", "Backend Engineer I"), so this
 * is the field you actually filter and group by. It's a free-text field with
 * these as suggestions, not a fixed enum — type anything, and whatever you
 * type becomes a suggestion for next time. Swap this list wholesale if your
 * team thinks in employment types (Internship / Co-op / New Grad) instead of
 * role families.
 */
export const JOB_TYPE_SUGGESTIONS = [
  "Software Engineering",
  "Frontend",
  "Backend",
  "Full Stack",
  "Mobile",
  "Data / Analytics",
  "Machine Learning",
  "DevOps / SRE",
  "QA / Testing",
  "Security",
  "Embedded / Hardware",
  "Product Management",
  "Design / UX",
  "IT Support",
  "Research"
];

/**
 * Employment arrangement. A short fixed list, unlike jobType, which is free
 * text for the kind of work. Values are stored as the label you see, so
 * filters, chips and cards need no lookup table; Unknown is the default
 * because a posting does not always say.
 */
export const EMPLOYMENT_TYPES = ["Unknown", "Full-time", "Part-time", "Contract", "Internship"];

/** Where the work happens. Also stored as the visible label. */
export const LOCATION_TYPES = ["Unknown", "On-site", "Hybrid", "Remote"];

export const UNKNOWN_TYPE = "Unknown";

export const MODULE_TYPES = [
  { value: "summary", label: "Summary" },
  { value: "experience", label: "Experience" },
  { value: "education", label: "Education" },
  { value: "project", label: "Project" },
  { value: "skill", label: "Skills" },
  { value: "other", label: "Other" }
];

// The order sections appear in when nothing has been reordered by hand.
// Matches the conventional Jake's Resume layout.
export const TYPE_ORDER = ["summary", "education", "experience", "project", "skill", "other"];

// LaTeX \section{} heading for each module type.
export const SECTION_TITLES = {
  summary: "Summary",
  education: "Education",
  experience: "Experience",
  project: "Projects",
  skill: "Technical Skills",
  other: "Additional"
};

/**
 * Which structured fields each module type shows, and what to call them.
 * Jake's Resume renders education and experience subheadings with the four
 * slots in a different order, so the labels differ by type even though the
 * underlying fields are the same.
 */
export const TYPE_FIELDS = {
  summary: {
    title: { label: "Heading", placeholder: "e.g. Professional summary" },
    content: { label: "Summary text", placeholder: "Two or three lines about what you do and what you're after..." },
    bullets: null,
    organization: null,
    dates: false,
    location: false
  },
  experience: {
    title: { label: "Role", placeholder: "e.g. Software Engineering Intern" },
    organization: { label: "Company", placeholder: "e.g. Northwind Analytics" },
    content: { label: "Lead-in (optional)", placeholder: "Optional sentence before the bullet points..." },
    bullets: { label: "Bullet points", placeholder: "One bullet per line —\nBuilt an ingestion pipeline handling 2M events/day\nCut p95 latency 40% by adding a read-through cache" },
    dates: true,
    location: true
  },
  education: {
    title: { label: "Degree", placeholder: "e.g. BSc in Computing Science, Minor in Business" },
    organization: { label: "Institution", placeholder: "e.g. University of Alberta" },
    content: { label: "Lead-in (optional)", placeholder: "Optional note — GPA, honours, thesis..." },
    bullets: { label: "Bullet points (optional)", placeholder: "One bullet per line —\nDean's List 2024, 2025\nRelevant coursework: Distributed Systems, Compilers" },
    dates: true,
    location: true
  },
  project: {
    title: { label: "Project name", placeholder: "e.g. Casefile" },
    organization: { label: "Tech stack", placeholder: "e.g. Next.js, Postgres, Docker" },
    content: { label: "Lead-in (optional)", placeholder: "Optional one-liner about the project..." },
    bullets: { label: "Bullet points", placeholder: "One bullet per line —\nBuilt a keyword matcher that tailors resumes per posting" },
    dates: true,
    location: false
  },
  skill: {
    title: { label: "Heading", placeholder: "e.g. Technical Skills" },
    organization: null,
    content: { label: "Lead-in (optional)", placeholder: "Usually left empty for a skills block." },
    bullets: { label: "Skill groups", placeholder: "One group per line, \"Label: items\" —\nLanguages: Python, Java, TypeScript\nFrameworks: React, Next.js, Flask" },
    dates: false,
    location: false
  },
  other: {
    title: { label: "Title", placeholder: "e.g. Volunteer — Lead Organiser" },
    organization: { label: "Organisation", placeholder: "e.g. Hack the North" },
    content: { label: "Description", placeholder: "Free-form description..." },
    bullets: { label: "Bullet points (optional)", placeholder: "One bullet per line" },
    dates: true,
    location: true
  }
};

export function typeFields(type) {
  return TYPE_FIELDS[type] || TYPE_FIELDS.other;
}

export const COMM_TYPES = [
  { value: "note", label: "Note" },
  { value: "email", label: "Email" },
  { value: "call", label: "Call" },
  { value: "interview", label: "Interview" }
];
