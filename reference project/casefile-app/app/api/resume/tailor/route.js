import { withCors, corsPreflight } from "@/lib/cors";
import { parseJobPosting } from "@/lib/jobParser";
import { tailorResume } from "@/lib/groq";

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(request) {
  try {
    const { jobUrl = "", jobDescription = "", modules = [], profile = null } = await request.json();
    const pastedDescription = jobDescription.trim();
    let parsedJob = { source: "pasted job description", title: "", text: "" };
    let parserWarning = "";

    if (jobUrl.trim()) {
      try {
        parsedJob = await parseJobPosting(jobUrl.trim());
      } catch (error) {
        if (!pastedDescription) throw error;
        parserWarning = error.message;
      }
    }

    const description = pastedDescription || parsedJob.text;
    if (!description || description.length < 80) {
      return withCors(
        { error: "Paste a longer job description or use a job posting URL with readable text." },
        { status: 400 }
      );
    }

    if (!Array.isArray(modules) || modules.length === 0) {
      return withCors(
        { error: "Add at least one master resume module before tailoring." },
        { status: 400 }
      );
    }

    const tailoredResume = await tailorResume({
      profile,
      modules,
      jobDescription: description.slice(0, 16000),
      jobSource: parsedJob.source
    });

    return withCors({
      tailoredResume,
      job: {
        source: parsedJob.source,
        title: parsedJob.title,
        description: description.slice(0, 16000)
      },
      warning: parserWarning
    });
  } catch (error) {
    return withCors({ error: error.message || "Could not tailor resume." }, { status: 500 });
  }
}
