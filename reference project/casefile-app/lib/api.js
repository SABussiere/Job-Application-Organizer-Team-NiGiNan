// lib/api.js — talks to Firestore directly from the browser. There's no
// server API layer: each signed-in user's data lives under
// users/{uid}/applications, users/{uid}/masterModules and a single
// users/{uid}/meta/resumeProfile document, and firestore.rules enforce that a
// user can only read or write their own subtree.
//
// Every function keeps the name and return shape it had when this went
// through /api routes, so components didn't change when storage swapped out.
// LaTeX and plain-text rendering are pure functions (lib/latex.js,
// lib/matching.js), so they run here in the browser instead of needing a
// server round trip.

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, orderBy, writeBatch
} from "firebase/firestore";
import { auth, firestore } from "./firebaseClient";
import { scoreModules, selectModules, assembleResumeText } from "./matching";
import { renderLatexResume } from "./latex";

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function requireUser() {
  const user = auth.currentUser;
  if (!user) throw new Error("You're signed out — please sign in again.");
  return user.uid;
}

function applicationsCol() {
  return collection(firestore, "users", requireUser(), "applications");
}

function modulesCol() {
  return collection(firestore, "users", requireUser(), "masterModules");
}

// A document rather than a collection: the resume heading is one record
// (name, contact details, links).
function profileDoc() {
  return doc(firestore, "users", requireUser(), "meta", "resumeProfile");
}

const EMPTY_PROFILE = { name: "", email: "", phone: "", location: "", links: [] };

/**
 * Fills in fields a document may predate. Firestore has no migration step, so
 * documents written before the structured-module and job-type work keep
 * whatever they had; normalising on read means the UI and the LaTeX renderer
 * always see a complete shape.
 */
function withModuleDefaults(module) {
  return {
    type: "other",
    title: "",
    organization: "",
    location: "",
    startDate: "",
    endDate: "",
    content: "",
    ...module,
    bullets: Array.isArray(module.bullets) ? module.bullets.map(String) : [],
    tags: Array.isArray(module.tags) ? module.tags : [],
    alwaysInclude: !!module.alwaysInclude
  };
}

function withApplicationDefaults(app) {
  return {
    requisitionId: "",
    jobType: "",
    employmentType: "Unknown",
    locationType: "Unknown",
    location: "Unknown",
    // Coordinates for the Map tab, set when a location is matched against
    // the gazetteer. Null for free text and for places with no pin
    // ("Remote"), which the map reports separately rather than dropping.
    geo: null,
    notes: "",
    jobUrl: "",
    followUpDate: "",
    jobDescription: "",
    tailoredFrom: null,
    interviewQuestionsGeneratedAt: null,
    ...app,
    communications: Array.isArray(app.communications) ? app.communications : [],
    interviewQuestions: Array.isArray(app.interviewQuestions) ? app.interviewQuestions : []
  };
}

/** Modules named by `ids`, in the order the ids were given. */
function orderByIds(modules, ids) {
  const byId = new Map(modules.map(m => [m.id, m]));
  return (ids || []).map(id => byId.get(id)).filter(Boolean);
}

export const api = {
  async listApplications() {
    const snap = await getDocs(query(applicationsCol(), orderBy("createdAt", "desc")));
    return snap.docs.map(d => withApplicationDefaults({ id: d.id, ...d.data() }));
  },

  async createApplication(data) {
    const modules = await api.listResumeModules();
    const ref = doc(applicationsCol());
    const app = {
      company: data.company || "",
      position: data.position || "",
      requisitionId: data.requisitionId || "",
      jobType: data.jobType || "",
      employmentType: data.employmentType || "Unknown",
      locationType: data.locationType || "Unknown",
      dateApplied: data.dateApplied || new Date().toISOString().slice(0, 10),
      status: data.status || "applied",
      jobUrl: data.jobUrl || "",
      // A location is always either a matched place or explicitly Unknown,
      // so the map never has to guess what a string meant.
      location: data.location || "Unknown",
      geo: data.geo ?? null,
      notes: data.notes || "",
      followUpDate: data.followUpDate || "",
      resumeVersion: data.resumeVersion ?? assembleResumeText(modules),
      // Ordered master-module ids making up this case's tailored resume.
      // Starts as the full master, in master order.
      resumeModuleIds: Array.isArray(data.resumeModuleIds)
        ? data.resumeModuleIds
        : modules.map(m => m.id),
      jobDescription: data.jobDescription || "",
      tailoredFrom: null,
      interviewQuestions: [],
      interviewQuestionsGeneratedAt: null,
      communications: [],
      createdAt: new Date().toISOString()
    };
    await setDoc(ref, app);
    return { id: ref.id, ...app };
  },

  async getApplication(id) {
    const snap = await getDoc(doc(applicationsCol(), id));
    return snap.exists() ? withApplicationDefaults({ id: snap.id, ...snap.data() }) : null;
  },

  async updateApplication(id, patch) {
    await updateDoc(doc(applicationsCol(), id), patch);
    return api.getApplication(id);
  },

  async deleteApplication(id) {
    await deleteDoc(doc(applicationsCol(), id));
    return true;
  },

  async addCommunication(appId, comm) {
    const ref = doc(applicationsCol(), appId);
    const existing = await getDoc(ref);
    if (!existing.exists()) throw new Error("Application not found");
    const entry = {
      id: uid(),
      date: comm.date || new Date().toISOString().slice(0, 10),
      type: comm.type || "note",
      text: comm.text || ""
    };
    const communications = [entry, ...(existing.data().communications || [])];
    await updateDoc(ref, { communications });
    return withApplicationDefaults({ id: appId, ...existing.data(), communications });
  },

  async tailorApplication(appId, jobDescription) {
    const modules = await api.listResumeModules();
    if (modules.length === 0) {
      throw new Error("No master resume modules yet — add some on the Master Resume page first.");
    }

    const { selected } = selectModules(jobDescription, modules);
    const resumeVersion = assembleResumeText(selected);
    const selectedIds = selected.map(m => m.id);
    const chosen = new Set(selectedIds);

    const application = await api.updateApplication(appId, {
      resumeVersion,
      resumeModuleIds: selectedIds,
      jobDescription,
      tailoredFrom: {
        generatedAt: new Date().toISOString(),
        moduleCount: selected.length,
        totalModules: modules.length
      }
    });

    // Score every master module, not just the ones that made the cut, so the
    // UI can show the full picture and let the user check, uncheck and
    // reorder any of them. The whole module rides along so the client can
    // reassemble the resume without another read.
    const byId = new Map(
      scoreModules(jobDescription, modules).map(d => [
        d.module.id,
        {
          moduleId: d.module.id,
          module: d.module,
          score: d.score,
          alwaysIncluded: !!d.module.alwaysInclude,
          included: chosen.has(d.module.id),
          matchedTags: d.matchedTags,
          matchedWords: d.matchedWords
        }
      ])
    );

    // Selected first, in resume order, then everything left out — so the list
    // reads top to bottom like the document it produces.
    const matchSummary = [
      ...selectedIds.map(id => byId.get(id)),
      ...modules.filter(m => !chosen.has(m.id)).map(m => byId.get(m.id))
    ].filter(Boolean);

    return { application, matchSummary };
  },

  /**
   * Calls the server-side /api/interview-questions route (the one place
   * that holds GROQ_API_KEY) and saves whatever it returns onto the case,
   * the same way tailorApplication() saves a generated resume.
   */
  async generateInterviewQuestions(appId, { company, position, jobType, jobDescription }) {
    const res = await fetch("/api/interview-questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company, position, jobType, jobDescription })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Couldn't generate interview questions.");
    }
    return api.updateApplication(appId, {
      interviewQuestions: data.questions,
      interviewQuestionsGeneratedAt: new Date().toISOString()
    });
  },

  // ---------- Resume heading ----------

  async getResumeProfile() {
    const snap = await getDoc(profileDoc());
    const stored = snap.exists() ? snap.data() : {};
    return {
      ...EMPTY_PROFILE,
      ...stored,
      links: Array.isArray(stored.links) ? stored.links : []
    };
  },

  async updateResumeProfile(patch) {
    const current = await api.getResumeProfile();
    const links = Array.isArray(patch.links)
      ? patch.links
          .filter(l => l && (l.url || l.label))
          .map(l => ({ label: l.label || "", url: l.url || "" }))
      : current.links;
    const profile = { ...current, ...patch, links };
    // Merged set rather than update: the document may not exist yet.
    await setDoc(profileDoc(), profile, { merge: true });
    return profile;
  },

  // ---------- Master resume modules ----------

  async listResumeModules() {
    const snap = await getDocs(query(modulesCol(), orderBy("order")));
    return snap.docs.map(d => withModuleDefaults({ id: d.id, ...d.data() }));
  },

  async createResumeModule(data) {
    const modules = await api.listResumeModules();
    const maxOrder = modules.reduce((max, m) => Math.max(max, m.order ?? 0), -1);
    const ref = doc(modulesCol());
    const module = withModuleDefaults({
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
    await setDoc(ref, module);
    return { id: ref.id, ...module };
  },

  async updateResumeModule(id, patch) {
    const ref = doc(modulesCol(), id);
    await updateDoc(ref, patch);
    const snap = await getDoc(ref);
    return snap.exists() ? withModuleDefaults({ id: snap.id, ...snap.data() }) : null;
  },

  async deleteResumeModule(id) {
    // A deleted module must also drop out of every tailored selection that
    // referenced it, or a resume would render from a module that's gone.
    const apps = await api.listApplications();
    const affected = apps.filter(a => (a.resumeModuleIds || []).includes(id));

    const batch = writeBatch(firestore);
    batch.delete(doc(modulesCol(), id));
    affected.forEach(a => {
      batch.update(doc(applicationsCol(), a.id), {
        resumeModuleIds: a.resumeModuleIds.filter(mid => mid !== id)
      });
    });
    await batch.commit();
    return true;
  },

  async reorderResumeModule(id, direction) {
    const modules = await api.listResumeModules();
    const idx = modules.findIndex(m => m.id === id);
    if (idx === -1) return modules;
    const swapWith = direction === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= modules.length) return modules;

    const a = modules[idx].order ?? idx;
    const b = modules[swapWith].order ?? swapWith;

    const batch = writeBatch(firestore);
    batch.update(doc(modulesCol(), modules[idx].id), { order: b });
    batch.update(doc(modulesCol(), modules[swapWith].id), { order: a });
    await batch.commit();

    modules[idx].order = b;
    modules[swapWith].order = a;
    return modules.sort((x, y) => (x.order ?? 0) - (y.order ?? 0));
  },

  async getFullMasterResumeText() {
    return assembleResumeText(await api.listResumeModules());
  },

  // ---------- LaTeX, rendered in the browser (lib/latex.js is pure) --------

  async getMasterLatex() {
    const [profile, modules] = await Promise.all([
      api.getResumeProfile(),
      api.listResumeModules()
    ]);
    return renderLatexResume(profile, modules, { sortByTypeOrder: true });
  },

  /** LaTeX for an explicit, ordered subset — used by the tailored view. */
  async renderLatex(moduleIds) {
    const [profile, modules] = await Promise.all([
      api.getResumeProfile(),
      api.listResumeModules()
    ]);
    return renderLatexResume(profile, orderByIds(modules, moduleIds));
  },

  async getApplicationLatex(id) {
    const [app, profile, modules] = await Promise.all([
      api.getApplication(id),
      api.getResumeProfile(),
      api.listResumeModules()
    ]);
    if (!app) throw new Error("Application not found");
    const hasSelection = Array.isArray(app.resumeModuleIds);
    return renderLatexResume(
      profile,
      hasSelection ? orderByIds(modules, app.resumeModuleIds) : modules,
      { sortByTypeOrder: !hasSelection }
    );
  },

  async getStats() {
    const apps = await api.listApplications();
    const counts = { applied: 0, interview: 0, offer: 0, rejected: 0 };
    apps.forEach(a => { if (counts[a.status] !== undefined) counts[a.status]++; });
    return { total: apps.length, counts };
  }
};
