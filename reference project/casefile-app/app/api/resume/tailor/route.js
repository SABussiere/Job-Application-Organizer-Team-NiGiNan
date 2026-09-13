const GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";

function jsonResponse(body, status = 200) {
  return Response.json(body, { status });
}

function cleanString(value) {
  return String(value || "")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00a0/g, " ")
    .trim();
}

function cleanBullet(value) {
  return cleanString(value).replace(/^[-*•\u2022]\s*/, "");
}

function moduleForPrompt(module) {
  return {
    id: cleanString(module.id),
    type: cleanString(module.type),
    title: cleanString(module.title),
    organization: cleanString(module.organization),
    location: cleanString(module.location),
    startDate: cleanString(module.startDate),
    endDate: cleanString(module.endDate),
    content: cleanString(module.content),
    bullets: Array.isArray(module.bullets)
      ? module.bullets.map(cleanBullet).filter(Boolean)
      : [],
    tags: Array.isArray(module.tags)
      ? module.tags.map(cleanString).filter(Boolean)
      : []
  };
}

function extractJsonObject(text) {
  const raw = cleanString(text);
  if (!raw) throw new Error("Groq returned an empty response.");

  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Groq did not return valid JSON.");
    }
    return JSON.parse(raw.slice(start, end + 1));
  }
}

function normalizeTailoredModules(value, selectedModules) {
  const originalById = new Map(selectedModules.map(module => [module.id, module]));
  const rows = Array.isArray(value) ? value : [];

  return rows
    .map(row => {
      const id = cleanString(row?.id);
      const original = originalById.get(id);
      if (!original) return null;

      return {
        id,
        content: cleanString(row.content || original.content),
        bullets: Array.isArray(row.bullets)
          ? row.bullets.map(cleanBullet).filter(Boolean)
          : original.bullets || []
      };
    })
    .filter(Boolean);
}

export async function POST(request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return jsonResponse(
      { error: "GROQ_API_KEY is not configured in .env.local." },
      503
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Request body must be JSON." }, 400);
  }

  const jobDescription = cleanString(body.jobDescription);
  const selectedModules = Array.isArray(body.modules)
    ? body.modules.map(moduleForPrompt).filter(module => module.id)
    : [];

  if (!jobDescription) {
    return jsonResponse({ error: "Job description is required." }, 400);
  }
  if (selectedModules.length === 0) {
    return jsonResponse({ error: "At least one resume module is required." }, 400);
  }

  const model = process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
  const systemPrompt = [
    "You tailor resumes for specific job descriptions.",
    "Rewrite only the provided resume module content and bullets.",
    "The content field is body text only; never repeat the module title, organization, location, dates, or section heading.",
    "Bullets must be plain sentence fragments without leading bullet symbols, dashes, numbering, or markdown.",
    "Every returned content field or bullet should be materially reworded from the original while preserving the same facts.",
    "Keep every fact truthful and grounded in the supplied resume modules.",
    "Do not invent employers, titles, dates, tools, metrics, degrees, or outcomes.",
    "Preserve each module id and keep the same module order.",
    "Use strong ATS-friendly wording that mirrors the job description where truthful.",
    "Use ASCII punctuation.",
    "Return JSON only with this shape:",
    '{"modules":[{"id":"module-id","content":"optional body text only","bullets":["bullet 1","bullet 2"]}]}'
  ].join(" ");

  const userPrompt = JSON.stringify({
    jobDescription,
    selectedResumeModules: selectedModules
  });

  let groqResponse;
  try {
    groqResponse = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.25,
        max_tokens: 4096,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    });
  } catch (error) {
    return jsonResponse({ error: `Could not reach Groq: ${error.message}` }, 502);
  }

  const responseText = await groqResponse.text();
  if (!groqResponse.ok) {
    let message = responseText;
    try {
      message = JSON.parse(responseText)?.error?.message || responseText;
    } catch {
      message = responseText;
    }
    return jsonResponse({ error: `Groq request failed: ${message}` }, groqResponse.status);
  }

  try {
    const data = JSON.parse(responseText);
    const content = data?.choices?.[0]?.message?.content;
    const tailored = extractJsonObject(content);
    const modules = normalizeTailoredModules(tailored.modules, selectedModules);

    if (modules.length === 0) {
      return jsonResponse({ error: "Groq did not return any usable tailored modules." }, 502);
    }

    return jsonResponse({
      model,
      modules,
      resumeText: cleanString(tailored.resumeText)
    });
  } catch (error) {
    return jsonResponse({ error: error.message }, 502);
  }
}
