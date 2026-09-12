// lib/db.js — minimal file-backed persistence for the hackathon prototype.
// Swap this module out for Prisma/Postgres later without touching the API
// route handlers, since they only ever call the functions exported here.

import fs from "fs";
import path from "path";
import { assembleResumeText } from "./matching";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const EMPTY_PROFILE = {
  name: "",
  email: "",
  phone: "",
  location: "",
  links: []
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(
      DB_FILE,
      JSON.stringify(
        { applications: [], masterModules: [], resumeProfile: { ...EMPTY_PROFILE } },
        null,
        2
      )
    );
  }
}

/**
 * Fills in the structured fields (organization, dates, bullets) that modules
 * gained when the LaTeX renderer landed, so a module saved by an older
 * version of the app still has every field the UI and renderer expect.
 */
function withModuleDefaults(module) {
  const merged = {
    organization: "",
    location: "",
    startDate: "",
    endDate: "",
    alwaysInclude: false,
    ...module
  };
  merged.bullets = Array.isArray(merged.bullets)
    ? merged.bullets.map(b => String(b))
    : [];
  merged.tags = Array.isArray(merged.tags) ? merged.tags : [];
  merged.alwaysInclude = !!merged.alwaysInclude;
  return merged;
}

function read() {
  ensureDb();
  const state = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
  let dirty = false;

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
    dirty = true;
  }

  // Migrate flat (text-only) modules to the structured shape.
  const needsModuleMigration = state.masterModules.some(m => !Array.isArray(m.bullets));
  if (needsModuleMigration) {
    state.masterModules = state.masterModules.map(withModuleDefaults);
    dirty = true;
  }

  if (!state.resumeProfile || typeof state.resumeProfile !== "object") {
    state.resumeProfile = { ...EMPTY_PROFILE };
    dirty = true;
  }
  if (!Array.isArray(state.resumeProfile.links)) {
    state.resumeProfile.links = [];
    dirty = true;
  }

  if (dirty) write(state);
  return state;
}

function write(data) {
  ensureDb();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function sortedModules(modules) {
  return modules.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
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
    const master = sortedModules(state.masterModules);
    const app = {
      id: uid(),
      company: data.company || "",
      position: data.position || "",
      requisitionId: data.requisitionId || "",
      jobType: data.jobType || "",
      dateApplied: data.dateApplied || new Date().toISOString().slice(0, 10),
      status: data.status || "applied",
      jobUrl: data.jobUrl || "",
      location: data.location || "",
      notes: data.notes || "",
      followUpDate: data.followUpDate || "",
      resumeVersion: data.resumeVersion ?? assembleResumeText(master),
      // Ordered list of master-module ids that make up this application's
      // tailored resume. Starts as the full master, in master order.
      resumeModuleIds: Array.isArray(data.resumeModuleIds)
        ? data.resumeModuleIds
        : master.map(m => m.id),
      jobDescription: data.jobDescription || "",
      tailoredFrom: null, // { generatedAt, moduleCount, totalModules } once tailored
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

  // ---------- Resume heading (name, contact details, links) ----------

  getResumeProfile() {
    return read().resumeProfile;
  },

  updateResumeProfile(patch) {
    const state = read();
    const links = Array.isArray(patch.links)
      ? patch.links
          .filter(l => l && (l.url || l.label))
          .map(l => ({ label: l.label || "", url: l.url || "" }))
      : state.resumeProfile.links;
    state.resumeProfile = { ...state.resumeProfile, ...patch, links };
    write(state);
    return state.resumeProfile;
  },

  // ---------- Master resume modules ----------

  listMasterModules() {
    return sortedModules(read().masterModules);
  },

  getMasterModule(id) {
    return read().masterModules.find(m => m.id === id) || null;
  },

  /** Master modules named by `ids`, in the order the ids were given. */
  listMasterModulesByIds(ids) {
    const byId = new Map(read().masterModules.map(m => [m.id, m]));
    return (ids || []).map(id => byId.get(id)).filter(Boolean);
  },

  createMasterModule(data) {
    const state = read();
    const maxOrder = state.masterModules.reduce((max, m) => Math.max(max, m.order ?? 0), -1);
    const module = withModuleDefaults({
      id: uid(),
      type: data.type || "other",
      title: data.title || "",
      organization: data.organization || "",
      location: data.location || "",
      startDate: data.startDate || "",
      endDate: data.endDate || "",
      content: data.content || "",
      bullets: Array.isArray(data.bullets) ? data.bullets : [],
      tags: Array.isArray(data.tags) ? data.tags : [],
      alwaysInclude: !!data.alwaysInclude,
      order: maxOrder + 1
    });
    state.masterModules.push(module);
    write(state);
    return module;
  },

  updateMasterModule(id, patch) {
    const state = read();
    const idx = state.masterModules.findIndex(m => m.id === id);
    if (idx === -1) return null;
    state.masterModules[idx] = withModuleDefaults({ ...state.masterModules[idx], ...patch });
    write(state);
    return state.masterModules[idx];
  },

  deleteMasterModule(id) {
    const state = read();
    const next = state.masterModules.filter(m => m.id !== id);
    const deleted = next.length !== state.masterModules.length;
    state.masterModules = next;
    // A deleted module must also drop out of every tailored selection that
    // referenced it, or the resume would silently render a stale module.
    state.applications = state.applications.map(app =>
      Array.isArray(app.resumeModuleIds)
        ? { ...app, resumeModuleIds: app.resumeModuleIds.filter(mid => mid !== id) }
        : app
    );
    write(state);
    return deleted;
  },

  reorderMasterModule(id, direction) {
    const state = read();
    const modules = sortedModules(state.masterModules);
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
    return sortedModules(modules);
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
