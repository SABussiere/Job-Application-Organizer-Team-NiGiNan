import { API_BASE_URL } from "./config";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}/api${path}`, {
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
  getMasterResume: () => request("/resume").then(d => d.masterResume),
  setMasterResume: text => request("/resume", { method: "PUT", body: JSON.stringify({ text }) }).then(d => d.masterResume),
  getStats: () => request("/stats")
};
