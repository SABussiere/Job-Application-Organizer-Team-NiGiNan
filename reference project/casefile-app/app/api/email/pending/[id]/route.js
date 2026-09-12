// PATCH /api/email/pending/:id — confirm a queued guess, creating a new
// application or updating an existing one matched by emailThreadId.
// DELETE /api/email/pending/:id — dismiss it instead.

import { db } from "@/lib/db";
import { withCors, corsPreflight } from "@/lib/cors";

export async function OPTIONS() {
  return corsPreflight();
}

export async function PATCH(request, { params }) {
  const overrides = await request.json().catch(() => ({}));
  const entry = db.getPendingEmailApplication(params.id);
  if (!entry) return withCors({ error: "not found" }, { status: 404 });

  const fields = { ...entry.extracted, ...overrides };
  const existing = db.listApplications().find(a => a.emailThreadId === entry.threadId);

  let application;
  if (existing) {
    application = db.updateApplication(existing.id, {
      status: fields.status,
      emailMessageIds: [...(existing.emailMessageIds || []), entry.messageId]
    });
  } else {
    application = db.createApplication({
      company: fields.company,
      position: fields.position,
      status: fields.status,
      dateApplied: new Date().toISOString().slice(0, 10)
    });
    application = db.updateApplication(application.id, {
      emailThreadId: entry.threadId,
      emailMessageIds: [entry.messageId]
    });
  }

  db.removePendingEmailApplication(params.id);
  return withCors({ application });
}

export async function DELETE(request, { params }) {
  const deleted = db.removePendingEmailApplication(params.id);
  return withCors({ deleted });
}
