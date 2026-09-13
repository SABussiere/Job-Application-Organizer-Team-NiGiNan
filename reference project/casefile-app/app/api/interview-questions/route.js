// POST /api/interview-questions — generates 3-4 likely interview questions
// for a case's company/role (and job posting, if one's been pasted in).
// This runs server-side, unlike the rest of the app's data path, because it
// needs GROQ_API_KEY, which must never reach the browser.

import { generateInterviewQuestions } from "@/lib/interviewPrep";
import { withCors, corsPreflight } from "@/lib/cors";

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return withCors({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const questions = await generateInterviewQuestions(body);
    return withCors({ questions });
  } catch (e) {
    return withCors({ error: e.message }, { status: e.status || 500 });
  }
}
