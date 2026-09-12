// POST /api/email/sync — pulls job-related Gmail messages, classifies each
// one, and queues the results in pendingEmailApplications for the user to
// review at /review. Doesn't touch the applications board directly.

import { getOAuthClient } from "@/lib/googleAuth";
import { searchApplicationEmails, getMessage } from "@/lib/gmail";
import { isLikelyJobEmail, extractApplicationFields } from "@/lib/classify";
import { db } from "@/lib/db";
import { withCors, corsPreflight } from "@/lib/cors";

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST() {
  const tokens = db.getGoogleTokens();
  if (!tokens) return withCors({ error: "Gmail not connected" }, { status: 401 });

  const auth = getOAuthClient();
  const { messageIds } = await searchApplicationEmails(auth);

  const pending = db.listPendingEmailApplications();
  const applications = db.listApplications();
  const known = new Set([
    ...pending.map(p => p.messageId),
    ...applications.flatMap(a => a.emailMessageIds || [])
  ]);

  let queued = 0;
  for (const id of messageIds) {
    if (known.has(id)) continue;

    const message = await getMessage(auth, id);
    if (!isLikelyJobEmail(message)) continue;

    const fields = await extractApplicationFields(message);
    if (!fields) continue;

    db.addPendingEmailApplication({
      messageId: message.id,
      threadId: message.threadId,
      extracted: fields,
      receivedAt: message.date
    });
    queued++;
  }

  return withCors({ scanned: messageIds.length, queued });
}
