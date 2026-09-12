// lib/db.js — minimal file-backed persistence for the hackathon prototype.
// Swap this module out for Prisma/Postgres later without touching the API
// route handlers, since they only ever call the functions exported here.

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
      JSON.stringify({ applications: [], masterResume: "" }, null, 2)
    );
  }
}

function read() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
}

function write(data) {
  ensureDb();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

export const db = {
  listApplications() {
    return read().applications;
  },

  getApplication(id) {
    return read().applications.find(a => a.id === id) || null;
  },

  createApplication(data) {
    const state = read();
    const app = {
      id: uid(),
      company: data.company || "",
      position: data.position || "",
      dateApplied: data.dateApplied || new Date().toISOString().slice(0, 10),
      status: data.status || "applied",
      jobUrl: data.jobUrl || "",
      location: data.location || "",
      notes: data.notes || "",
      followUpDate: data.followUpDate || "",
      resumeVersion: data.resumeVersion ?? state.masterResume ?? "",
      communications: [],
      createdAt: new Date().toISOString()
    };
    state.applications.unshift(app);
    write(state);
    return app;
  },

  updateApplication(id, patch) {
    const state = read();
    const idx = state.applications.findIndex(a => a.id === id);
    if (idx === -1) return null;
    state.applications[idx] = { ...state.applications[idx], ...patch };
    write(state);
    return state.applications[idx];
  },

  deleteApplication(id) {
    const state = read();
    const next = state.applications.filter(a => a.id !== id);
    const deleted = next.length !== state.applications.length;
    state.applications = next;
    write(state);
    return deleted;
  },

  addCommunication(appId, comm) {
    const state = read();
    const idx = state.applications.findIndex(a => a.id === appId);
    if (idx === -1) return null;
    const entry = {
      id: uid(),
      date: comm.date || new Date().toISOString().slice(0, 10),
      type: comm.type || "note",
      text: comm.text || ""
    };
    state.applications[idx].communications = state.applications[idx].communications || [];
    state.applications[idx].communications.unshift(entry);
    write(state);
    return state.applications[idx];
  },

  getMasterResume() {
    return read().masterResume || "";
  },

  setMasterResume(text) {
    const state = read();
    state.masterResume = text;
    write(state);
    return state.masterResume;
  },

  getStats() {
    const apps = read().applications;
    const counts = { applied: 0, interview: 0, offer: 0, rejected: 0 };
    apps.forEach(a => { if (counts[a.status] !== undefined) counts[a.status]++; });
    return { total: apps.length, counts };
  }
};
