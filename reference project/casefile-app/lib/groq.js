const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

function bulletsOf(module) {
  return Array.isArray(module.bullets)
    ? module.bullets.map(b => String(b).trim()).filter(Boolean)
    : [];
}

function moduleToEvidence(module, index) {
  const bullets = bulletsOf(module).map(b => `- ${b}`).join("\n");
  const tags = Array.isArray(module.tags) ? module.tags.join(", ") : "";

  return [
    `Module ${index + 1}: ${module.title || "Untitled"}`,
    module.type ? `Type: ${module.type}` : "",
    module.organization ? `Organization: ${module.organization}` : "",
    module.location ? `Location: ${module.location}` : "",
    module.startDate || module.endDate ? `Dates: ${module.startDate || ""} - ${module.endDate || ""}` : "",
    tags ? `Tags: ${tags}` : "",
    module.alwaysInclude ? "Always include: yes" : "",
    module.content ? `Content: ${module.content}` : "",
    bullets ? `Bullets:\n${bullets}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

function profileToPrompt(profile) {
  if (!profile) return "No profile heading provided.";
  const links = Array.isArray(profile.links)
    ? profile.links.map(link => `${link.label || "Link"}: ${link.url || ""}`).join("; ")
    : "";
  return [
    profile.name ? `Name: ${profile.name}` : "",
    profile.email ? `Email: ${profile.email}` : "",
    profile.phone ? `Phone: ${profile.phone}` : "",
    profile.location ? `Location: ${profile.location}` : "",
    links ? `Links: ${links}` : ""
  ]
    .filter(Boolean)
    .join("\n") || "No profile heading provided.";
}

function buildPrompt({ profile, modules, jobDescription, jobSource }) {
  return [
    "You tailor resumes for job applications.",
    "Use only the candidate evidence supplied in the resume profile and master modules.",
    "Do not invent employers, dates, degrees, certifications, metrics, tools, links, or accomplishments.",
    "Use the job description's keywords naturally where the evidence supports them.",
    "Preserve truthfulness over keyword stuffing.",
    "Return a polished plain-text tailored resume with sections: Profile, Skills, Experience, Projects, Education, and Tailoring Notes.",
    "If a section has no supporting evidence, omit it.",
    "",
    `Job source: ${jobSource || "pasted job description"}`,
    "",
    "JOB DESCRIPTION:",
    jobDescription,
    "",
    "RESUME PROFILE:",
    profileToPrompt(profile),
    "",
    "MASTER MODULES:",
    modules.map(moduleToEvidence).join("\n\n")
  ].join("\n");
}

export async function tailorResume({ profile, modules, jobDescription, jobSource }) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("Missing GROQ_API_KEY in .env.local.");
  }

  const prompt = buildPrompt({ profile, modules, jobDescription, jobSource });

  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.25,
      messages: [
        {
          role: "system",
          content: "You are a careful resume editor. Be truthful, specific, ATS-aware, and concise."
        },
        { role: "user", content: prompt }
      ]
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || `Groq request failed (${response.status}).`);
  }

  return data.choices?.[0]?.message?.content?.trim() || "";
}
