// POST /api/interview-prep — generates AI interview prep for one
// company/position. Server-only: needs ANTHROPIC_API_KEY, which can't be
// exposed to the browser, so this is the one place lib/interviewPrep.js
// is ever imported from.

import { generateInterviewPrep } from "@/lib/interviewPrep";
import { withCors, corsPreflight } from "@/lib/cors";

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  const { company, position } = data;

  if (!company || !position) {
    return withCors({ error: "company and position are required" }, { status: 400 });
  }

  try {
    const prep = await generateInterviewPrep(data);
    return withCors({ prep });
  } catch (err) {
    console.error("Interview prep generation failed:", err);
    return withCors({ error: err.message || "Generation failed" }, { status: 502 });
  }
}
