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
  getResumeWorkspace: () => request("/resume"),
  saveResumeWorkspace: data => request("/resume", { method: "PUT", body: JSON.stringify(data) }),
  getMasterResume: () => request("/resume").then(d => d.masterResume),
  setMasterResume: text => request("/resume", { method: "PUT", body: JSON.stringify({ text }) }).then(d => d.masterResume),
  tailorResume: data => request("/resume/tailor", { method: "POST", body: JSON.stringify(data) }),
  getStats: () => request("/stats")
};
