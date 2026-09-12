// File-backed storage used only by the Gmail integration for local OAuth
// tokens and the human review queue. Applications themselves live in
// Firestore now, via lib/api.js.

import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(
      DB_FILE,
      JSON.stringify({
        emailIntegration: null,
        pendingEmailApplications: [],
        processedEmailMessageIds: [],
        processedEmailThreadIds: []
      }, null, 2)
    );
  }
}

function read() {
  ensureDb();
  const state = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
  return {
    emailIntegration: state.emailIntegration || null,
    pendingEmailApplications: Array.isArray(state.pendingEmailApplications)
      ? state.pendingEmailApplications
      : [],
    processedEmailMessageIds: Array.isArray(state.processedEmailMessageIds)
      ? state.processedEmailMessageIds
      : [],
    processedEmailThreadIds: Array.isArray(state.processedEmailThreadIds)
      ? state.processedEmailThreadIds
      : []
  };
}

function write(data) {
  ensureDb();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

export const db = {
  getGoogleTokens() {
    return read().emailIntegration || null;
  },

  saveGoogleTokens(tokens, connectedEmail) {
    const state = read();
    state.emailIntegration = {
      ...(state.emailIntegration || {}),
      ...tokens,
      ...(connectedEmail ? { connectedEmail } : {})
    };
    write(state);
    return state.emailIntegration;
  },

  clearGoogleTokens() {
    const state = read();
    state.emailIntegration = null;
    write(state);
  },

  listPendingEmailApplications() {
    return read().pendingEmailApplications || [];
  },

  getPendingEmailApplication(id) {
    return (read().pendingEmailApplications || []).find(p => p.id === id) || null;
  },

  addPendingEmailApplication(entry) {
    const state = read();
    state.pendingEmailApplications = state.pendingEmailApplications || [];
    const record = { id: uid(), ...entry };
    state.pendingEmailApplications.unshift(record);
    write(state);
    return record;
  },

  removePendingEmailApplication(id) {
    const state = read();
    const list = state.pendingEmailApplications || [];
    const next = list.filter(p => p.id !== id);
    const removed = next.length !== list.length;
    state.pendingEmailApplications = next;
    write(state);
    return removed;
  },

  markEmailProcessed({ messageId, threadId }) {
    const state = read();

    if (messageId && !state.processedEmailMessageIds.includes(messageId)) {
      state.processedEmailMessageIds.push(messageId);
    }

    if (threadId && !state.processedEmailThreadIds.includes(threadId)) {
      state.processedEmailThreadIds.push(threadId);
    }

    write(state);
  },

  getProcessedEmailState() {
    const state = read();
    return {
      messageIds: state.processedEmailMessageIds,
      threadIds: state.processedEmailThreadIds
    };
  }
};
