// Server-only: generates interview prep content for one company/position via
// the Anthropic API. Never imported from a client component — the API key
// can't be exposed to the browser, so this only ever runs inside
// app/api/interview-prep/route.js.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const PrepSchema = z.object({
  commonQuestions: z.array(
    z.object({
      question: z.string(),
      tip: z.string()
    })
  ),
  strengthsToHighlight: z.array(z.string()),
  companyAngle: z.string(),
  questionsToAsk: z.array(z.string())
});

let client = null;
function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

/**
 * @param {{ company: string, position: string, jobDescription?: string, notes?: string }} input
 * @returns {Promise<{ commonQuestions: {question: string, tip: string}[], strengthsToHighlight: string[], companyAngle: string, questionsToAsk: string[] }>}
 */
export async function generateInterviewPrep({ company, position, jobDescription, notes }) {
  const context = [
    `Company: ${company || "Unknown"}`,
    `Position: ${position || "Unknown"}`,
    jobDescription ? `Job description:\n${jobDescription}` : null,
    notes ? `Candidate's own notes:\n${notes}` : null
  ].filter(Boolean).join("\n\n");

  const response = await getClient().messages.parse({
    model: "claude-opus-5",
    max_tokens: 4000,
    system:
      "You help a job candidate prepare for a specific interview. Be concrete and " +
      "specific to the company and role given — never generic filler ('be yourself', " +
      "'research the company'). If the job description is missing, reason from the " +
      "position title and what's publicly known about the company instead of saying so.",
    messages: [
      {
        role: "user",
        content:
          `Prepare interview prep for this application:\n\n${context}\n\n` +
          "Give: 5-6 likely interview questions (mix of behavioral and role-specific) " +
          "each with a short tip on how to answer well; 3-5 strengths this candidate " +
          "should emphasize given the role; one paragraph on what to research/emphasize " +
          "about this specific company; and 3-4 good questions to ask the interviewer."
      }
    ],
    output_config: {
      format: zodOutputFormat(PrepSchema)
    }
  });

  if (!response.parsed_output) {
    throw new Error("Claude's response didn't match the expected format — try again.");
  }
  return response.parsed_output;
}
