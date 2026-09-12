// lib/api.js — talks to Firestore directly from the browser. There's no
// server API layer: each signed-in user's data lives under
// users/{uid}/applications and users/{uid}/masterModules, and firestore.rules
// enforce that a user can only read/write their own subtree. Every function
// here keeps the exact name/shape it had when this went through /api routes,
// so no component had to change when the storage swapped out.

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, orderBy, writeBatch
} from "firebase/firestore";
import { auth, firestore } from "./firebaseClient";
import { scoreModules, selectModules, assembleResumeText } from "./matching";

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

function toObject(snap) {
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export const api = {
  async listApplications() {
    const snap = await getDocs(query(applicationsCol(), orderBy("createdAt", "desc")));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async createApplication(data) {
    const modules = await api.listResumeModules();
    const ref = doc(applicationsCol());
    const app = {
      company: data.company || "",
      position: data.position || "",
      dateApplied: data.dateApplied || new Date().toISOString().slice(0, 10),
      status: data.status || "applied",
      jobUrl: data.jobUrl || "",
      location: data.location || "",
      notes: data.notes || "",
      followUpDate: data.followUpDate || "",
      resumeVersion: data.resumeVersion ?? assembleResumeText(modules),
      jobDescription: data.jobDescription || "",
      tailoredFrom: null,
      communications: [],
      createdAt: new Date().toISOString()
    };
    await setDoc(ref, app);
    return { id: ref.id, ...app };
  },

  async getApplication(id) {
    return toObject(await getDoc(doc(applicationsCol(), id)));
  },

  async updateApplication(id, patch) {
    const ref = doc(applicationsCol(), id);
    await updateDoc(ref, patch);
    return toObject(await getDoc(ref));
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
    return { id: appId, ...existing.data(), communications };
  },

  async tailorApplication(appId, jobDescription) {
    const modules = await api.listResumeModules();
    if (modules.length === 0) {
      throw new Error("No master resume modules yet — add some on the Master Resume page first.");
    }

    const { selected } = selectModules(jobDescription, modules);
    const resumeVersion = assembleResumeText(selected);
    const selectedIds = new Set(selected.map(m => m.id));

    const application = await api.updateApplication(appId, {
      resumeVersion,
      jobDescription,
      tailoredFrom: {
        generatedAt: new Date().toISOString(),
        moduleCount: selected.length,
        totalModules: modules.length
      }
    });

    // Score every master module (not just the ones that made the cut) so the
    // UI can show the full picture and let the user manually check/uncheck
    // any of them.
    const matchSummary = scoreModules(jobDescription, modules).map(d => ({
      moduleId: d.module.id,
      title: d.module.title,
      content: d.module.content,
      order: d.module.order,
      score: d.score,
      alwaysIncluded: !!d.module.alwaysInclude,
      included: selectedIds.has(d.module.id),
      matchedTags: d.matchedTags,
      matchedWords: d.matchedWords
    }));

    return { application, matchSummary };
  },

  async listResumeModules() {
    const snap = await getDocs(query(modulesCol(), orderBy("order")));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async createResumeModule(data) {
    const modules = await api.listResumeModules();
    const maxOrder = modules.reduce((max, m) => Math.max(max, m.order ?? 0), -1);
    const ref = doc(modulesCol());
    const module = {
      type: data.type || "other",
      title: data.title || "",
      content: data.content || "",
      tags: Array.isArray(data.tags) ? data.tags : [],
      alwaysInclude: !!data.alwaysInclude,
      order: maxOrder + 1
    };
    await setDoc(ref, module);
    return { id: ref.id, ...module };
  },

  async updateResumeModule(id, patch) {
    const ref = doc(modulesCol(), id);
    await updateDoc(ref, patch);
    return toObject(await getDoc(ref));
  },

  async deleteResumeModule(id) {
    await deleteDoc(doc(modulesCol(), id));
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
    const modules = await api.listResumeModules();
    return assembleResumeText(modules);
  },

  async getStats() {
    const apps = await api.listApplications();
    const counts = { applied: 0, interview: 0, offer: 0, rejected: 0 };
    apps.forEach(a => { if (counts[a.status] !== undefined) counts[a.status]++; });
    return { total: apps.length, counts };
  }
};
