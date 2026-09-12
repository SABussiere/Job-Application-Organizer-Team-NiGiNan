// lib/api.js — client-side fetch helpers. Same-origin, so no base URL needed
// (unlike the mobile app, which must point at this server's network address).

async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  listApplications: () => request("/applications").then(d => d.applications),
  createApplication: data =>
    request("/applications", { method: "POST", body: JSON.stringify(data) }).then(d => d.application),
  getApplication: id => request(`/applications/${id}`).then(d => d.application),
  updateApplication: (id, patch) =>
    request(`/applications/${id}`, { method: "PATCH", body: JSON.stringify(patch) }).then(d => d.application),
  deleteApplication: id => request(`/applications/${id}`, { method: "DELETE" }),
  addCommunication: (id, comm) =>
    request(`/applications/${id}/communications`, { method: "POST", body: JSON.stringify(comm) }).then(d => d.application),
  tailorApplication: (id, jobDescription) =>
    request(`/applications/${id}/tailor`, { method: "POST", body: JSON.stringify({ jobDescription }) }),
  getApplicationLatex: id => request(`/applications/${id}/latex`).then(d => d.latex),

  listResumeModules: () => request("/resume-modules").then(d => d.modules),
  createResumeModule: data => request("/resume-modules", { method: "POST", body: JSON.stringify(data) }).then(d => d.module),
  updateResumeModule: (id, patch) => request(`/resume-modules/${id}`, { method: "PATCH", body: JSON.stringify(patch) }).then(d => d.module),
  deleteResumeModule: id => request(`/resume-modules/${id}`, { method: "DELETE" }),
  reorderResumeModule: (id, direction) => request(`/resume-modules/${id}/reorder`, { method: "POST", body: JSON.stringify({ direction }) }).then(d => d.modules),
  getFullMasterResumeText: () => request("/resume-modules/full").then(d => d.text),

  // LaTeX rendering. The GET is the whole master resume; the POST renders an
  // explicit, ordered subset so a preview can match unsaved UI state.
  getMasterLatex: () => request("/resume-modules/latex").then(d => d.latex),
  renderLatex: moduleIds =>
    request("/resume-modules/latex", { method: "POST", body: JSON.stringify({ moduleIds }) }).then(d => d.latex),

  getResumeProfile: () => request("/resume-profile").then(d => d.profile),
  updateResumeProfile: patch =>
    request("/resume-profile", { method: "PATCH", body: JSON.stringify(patch) }).then(d => d.profile),

  getStats: () => request("/stats")
};
