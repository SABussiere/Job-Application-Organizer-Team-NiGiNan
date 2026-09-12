// DELETE /api/email/pending/:id — remove one entry from the sync queue.
// Used both for "Dismiss" and, from the browser, right after a Confirm has
// already written the application to Firestore (see app/review/page.js —
// that write has to happen client-side, since only the browser holds the
// signed-in Firebase session; this route only ever touches the queue).

import { db } from "@/lib/db";
import { withCors, corsPreflight } from "@/lib/cors";

export async function OPTIONS() {
  return corsPreflight();
}

export async function DELETE(request, { params }) {
  const entry = db.getPendingEmailApplication(params.id);
  if (entry) {
    db.markEmailProcessed({
      messageId: entry.messageId,
      threadId: entry.threadId
    });
  }
  const deleted = db.removePendingEmailApplication(params.id);
  return withCors({ deleted });
}
