// lib/interviewPrep.js — asks an LLM for a handful of interview questions
// this employer/role is likely to ask, given whatever's already on the case
// (company, position, job type, and the pasted job description if there is
// one). This is the only file that talks to the model API directly;
// app/api/interview-questions/route.js just parses the request and reports
// whatever error comes back.
//
// Uses Groq (console.groq.com) — free for demo-level volume, no credit card,
// fast inference. Groq's API is OpenAI-compatible, so swapping in OpenAI,
// Together, or another OpenAI-compatible provider later just means changing
// API_URL/DEFAULT_MODEL and the env var name below, not the request/response
// shape this file builds.
//
// Same LLM hook classify.js and matching.js leave open for later — this is
// the first feature that actually takes it.

const API_URL = "https://api.groq.com/openai/v1/chat/completions";
// The Llama production models (llama-3.3-70b-versatile, llama-3.1-8b-instant)
// moved behind Groq's enterprise/contact-sales tier and 404 on a normal
// free-tier key — gpt-oss-20b is the fast, self-serve-priced model that's
// actually reachable on a free key. openai/gpt-oss-120b is the swap for
// noticeably better answers at a small latency cost, still self-serve.
const DEFAULT_MODEL = "openai/gpt-oss-20b";

// Job descriptions can run long; this is plenty of context for question
// generation without spending the whole budget on one field.
const MAX_JD_LENGTH = 6000;

const SYSTEM_PROMPT = `You help job seekers prepare for interviews. Given a company, a role, and (when available) the job posting text, return 3 to 4 interview questions that employer is plausibly likely to ask for that specific role — a mix of behavioral and role-specific/technical questions grounded in whatever details you're given, not generic filler.

Respond with ONLY a JSON array of strings, one question per string. No markdown fences, no object wrapper, no commentary before or after — just the array, e.g.:
["Question one?", "Question two?", "Question three?"]`;

function fail(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function buildUserMessage({ company, position, jobType, jobDescription }) {
  return [
    company ? `Company: ${company}` : null,
    position ? `Role: ${position}` : null,
    jobType ? `Job type: ${jobType}` : null,
    jobDescription
      ? `Job posting:\n${jobDescription}`
      : "No job posting text is available — work from the company and role alone."
  ].filter(Boolean).join("\n");
}

// Models sometimes wrap JSON in a fence despite being told not to — strip
// it before parsing rather than failing on it.
function parseQuestions(raw) {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) throw new Error("response was not a JSON array");
  return parsed.map(q => String(q).trim()).filter(Boolean).slice(0, 4);
}

export async function generateInterviewQuestions({ company, position, jobType, jobDescription }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw fail(
      "GROQ_API_KEY isn't set on the server — grab a free key at console.groq.com, add it to .env.local, and restart the dev server.",
      500
    );
  }

  company = (company || "").trim();
  position = (position || "").trim();
  jobType = (jobType || "").trim();
  jobDescription = (jobDescription || "").trim().slice(0, MAX_JD_LENGTH);

  if (!company && !position) {
    throw fail("Need at least a company or position to work with.", 400);
  }

  let response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || DEFAULT_MODEL,
        max_tokens: 512,
        // gpt-oss is a reasoning model — left at its defaults it wraps
        // chain-of-thought in <think> tags inside `content`, which would
        // break the JSON parse below. "hidden" strips that so `content` is
        // just the answer; "low" effort keeps this simple task fast.
        reasoning_effort: "low",
        reasoning_format: "hidden",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserMessage({ company, position, jobType, jobDescription }) }
        ]
      })
    });
  } catch {
    throw fail("Couldn't reach the Groq API.", 502);
  }

  if (!response.ok) {
    const text = await response.text();
    throw fail(`Groq API error (${response.status}): ${text.slice(0, 300)}`, 502);
  }

  const data = await response.json();
  const raw = (data.choices?.[0]?.message?.content || "").trim();

  let questions;
  try {
    questions = parseQuestions(raw);
  } catch {
    throw fail("Couldn't parse the generated questions — try again.", 502);
  }

  if (questions.length === 0) {
    throw fail("The model didn't return any questions — try again.", 502);
  }

  return questions;
}
