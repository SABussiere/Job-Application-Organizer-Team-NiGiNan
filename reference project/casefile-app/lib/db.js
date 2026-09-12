// lib/db.js — minimal file-backed persistence for the hackathon prototype.
// Swap this module out for Prisma/Postgres later without touching the API
// route handlers, since they only ever call the functions exported here.

import fs from "fs";
import path from "path";
import { assembleResumeText } from "./matching";

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
      JSON.stringify({ applications: [], masterModules: [] }, null, 2)
    );
  }
}

function read() {
  ensureDb();
  const state = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));

  // Migrate from the old single-string masterResume (pre-modules) so
  // existing local data isn't lost when this ships.
  if (!Array.isArray(state.masterModules)) {
    state.masterModules = [];
    if (state.masterResume && state.masterResume.trim()) {
      state.masterModules.push({
        id: uid(),
        type: "other",
        title: "Imported resume",
        content: state.masterResume,
        tags: [],
        alwaysInclude: true,
        order: 0
      });
    }
    delete state.masterResume;
    write(state);
  }
  return state;
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
      resumeVersion: data.resumeVersion ?? assembleResumeText(state.masterModules),
      jobDescription: data.jobDescription || "",
      tailoredFrom: null, // { matchedModuleIds, generatedAt } once tailored
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

  // ---------- Master resume modules ----------

  listMasterModules() {
    return read().masterModules.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  },

  getMasterModule(id) {
    return read().masterModules.find(m => m.id === id) || null;
  },

  createMasterModule(data) {
    const state = read();
    const maxOrder = state.masterModules.reduce((max, m) => Math.max(max, m.order ?? 0), -1);
    const module = {
      id: uid(),
      type: data.type || "other",
      title: data.title || "",
      content: data.content || "",
      tags: Array.isArray(data.tags) ? data.tags : [],
      alwaysInclude: !!data.alwaysInclude,
      order: maxOrder + 1
    };
    state.masterModules.push(module);
    write(state);
    return module;
  },

  updateMasterModule(id, patch) {
    const state = read();
    const idx = state.masterModules.findIndex(m => m.id === id);
    if (idx === -1) return null;
    state.masterModules[idx] = { ...state.masterModules[idx], ...patch };
    write(state);
    return state.masterModules[idx];
  },

  deleteMasterModule(id) {
    const state = read();
    const next = state.masterModules.filter(m => m.id !== id);
    const deleted = next.length !== state.masterModules.length;
    state.masterModules = next;
    write(state);
    return deleted;
  },

  reorderMasterModule(id, direction) {
    const state = read();
    const modules = state.masterModules.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const idx = modules.findIndex(m => m.id === id);
    if (idx === -1) return null;
    const swapWith = direction === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= modules.length) return modules;
    const a = modules[idx].order ?? idx;
    const b = modules[swapWith].order ?? swapWith;
    modules[idx].order = b;
    modules[swapWith].order = a;
    state.masterModules = modules;
    write(state);
    return modules.sort((x, y) => (x.order ?? 0) - (y.order ?? 0));
  },

  // Kept for the "reset from master" action — full assembled text of every
  // module, unfiltered.
  getFullMasterResumeText() {
    return assembleResumeText(read().masterModules);
  },

  getStats() {
    const apps = read().applications;
    const counts = { applied: 0, interview: 0, offer: 0, rejected: 0 };
    apps.forEach(a => { if (counts[a.status] !== undefined) counts[a.status]++; });
    return { total: apps.length, counts };
  }
};
