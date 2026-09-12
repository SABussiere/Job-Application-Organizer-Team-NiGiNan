const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

function storiesToPrompt(stories) {
  return stories
    .map((story, index) => {
      const skills = (story.skills || []).join(", ");
      const bullets = (story.bullets || []).map(bullet => `- ${bullet}`).join("\n");
      return [
        `Story ${index + 1}: ${story.title || "Untitled"}`,
        story.role ? `Role: ${story.role}` : "",
        skills ? `Skills: ${skills}` : "",
        story.situation ? `Situation: ${story.situation}` : "",
        story.action ? `Action: ${story.action}` : "",
        story.result ? `Result: ${story.result}` : "",
        bullets ? `Existing bullets:\n${bullets}` : ""
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

function buildPrompt({ masterResume, masterStories, jobDescription, jobSource }) {
  return [
    "You tailor resumes for job applications.",
    "Use only the candidate evidence supplied in the master resume and master stories.",
    "Do not invent employers, dates, degrees, certifications, metrics, tools, or accomplishments.",
    "Use the job description's keywords naturally where the evidence supports them.",
    "Prefer concrete achievement bullets with action, scope, tools, and outcome.",
    "Return a polished plain-text resume section set with Summary, Skills, Experience Bullets, and Tailoring Notes.",
    "",
    `Job source: ${jobSource || "pasted job description"}`,
    "",
    "JOB DESCRIPTION:",
    jobDescription,
    "",
    "MASTER STORIES:",
    storiesToPrompt(masterStories),
    "",
    "MASTER RESUME TEXT:",
    masterResume || "No master resume text provided."
  ].join("\n");
}

export async function tailorResume({ masterResume, masterStories, jobDescription, jobSource }) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("Missing GROQ_API_KEY in .env.local.");
  }

  const prompt = buildPrompt({ masterResume, masterStories, jobDescription, jobSource });

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
          content:
            "You are a careful resume editor. Be truthful, specific, ATS-aware, and concise."
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
