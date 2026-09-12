// All direct Gmail API calls: searching for job-related messages and
// fetching/decoding a single message into plain fields (from, subject,
// body text). Nothing outside this file should import "googleapis".

import { google } from "googleapis";

const QUERY =
  'subject:(application OR applying OR interview OR offer OR position OR "thank you for applying") newer_than:180d';

export async function searchApplicationEmails(auth, pageToken) {
  const gmail = google.gmail({ version: "v1", auth });
  const res = await gmail.users.messages.list({ userId: "me", q: QUERY, pageToken });
  return {
    messageIds: (res.data.messages || []).map(m => m.id),
    nextPageToken: res.data.nextPageToken || null
  };
}

function findHeader(headers, name) {
  const h = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : "";
}

function decodeBody(data) {
  if (!data) return "";
  return Buffer.from(data, "base64url").toString("utf-8");
}

function extractBodyText(payload) {
  if (payload.body?.data) return decodeBody(payload.body.data);
  if (payload.parts) {
    const plain = payload.parts.find(p => p.mimeType === "text/plain");
    if (plain) return decodeBody(plain.body?.data);
    const html = payload.parts.find(p => p.mimeType === "text/html");
    if (html) return decodeBody(html.body?.data).replace(/<[^>]+>/g, " ");
    for (const part of payload.parts) {
      if (part.parts) {
        const nested = extractBodyText(part);
        if (nested) return nested;
      }
    }
  }
  return "";
}

export async function getMessage(auth, messageId) {
  const gmail = google.gmail({ version: "v1", auth });
  const res = await gmail.users.messages.get({ userId: "me", id: messageId, format: "full" });
  const { payload, snippet, threadId, id } = res.data;
  const headers = payload.headers || [];

  return {
    id,
    threadId,
    from: findHeader(headers, "From"),
    subject: findHeader(headers, "Subject"),
    date: findHeader(headers, "Date"),
    snippet,
    bodyText: extractBodyText(payload)
  };
}
