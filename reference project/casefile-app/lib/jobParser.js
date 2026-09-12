function decodeHtml(text) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function htmlToText(html) {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<\/(p|div|li|h[1-6]|section|article|br)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\r/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

export async function parseJobPosting(url) {
  if (!url) return { source: "none", text: "", title: "" };

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Enter a valid job posting URL.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Job posting URL must start with http:// or https://.");
  }

  const response = await fetch(parsed.toString(), {
    headers: {
      "User-Agent": "CasefileResumeTailor/1.0",
      Accept: "text/html,text/plain;q=0.9,*/*;q=0.8"
    }
  });

  if (!response.ok) {
    throw new Error(`Could not fetch job posting (${response.status}). Paste the JD instead.`);
  }

  const contentType = response.headers.get("content-type") || "";
  const raw = await response.text();
  const title = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || parsed.hostname;
  const text = contentType.includes("html") ? htmlToText(raw) : raw.trim();

  return {
    source: parsed.toString(),
    title: decodeHtml(title),
    text: text.slice(0, 16000)
  };
}

