import { API_BASE_URL, clearToken, getToken, refreshAccessToken } from "../auth";
import { runMutation } from "./mutationState";
const message = (data, fallback) =>
  Array.isArray(data?.detail)
    ? data.detail.map((x) => x.msg).join(". ")
    : data?.detail || fallback;
export const query = (params = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== "" && v !== null && v !== undefined) q.set(k, v);
  });
  return q.size ? `?${q}` : "";
};
export async function api(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    return runMutation(`${method}:${path}:${options.body instanceof FormData ? crypto.randomUUID() : options.body || ""}`, () => request(path, options));
  }
  return request(path, options);
}

async function request(path, options) {
  const send = async (token) => {
    try {
      return await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        cache: "no-store",
        headers: {
          ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
      });
    } catch { throw new Error("Nuk mund të lidhemi me serverin."); }
  };
  const usedToken = getToken();
  let response = await send(usedToken);
  if (response.status === 401 && !path.startsWith("/auth/login") && !path.startsWith("/auth/refresh") && !path.startsWith("/auth/logout")) {
    try {
      const token = getToken() && getToken() !== usedToken ? getToken() : await refreshAccessToken();
      response = await send(token);
    } catch (error) {
      if (error.status >= 400 && error.status < 500) clearToken();
      throw error;
    }
    if (response.status === 401) clearToken();
  }
  const data = response.status === 204 ? null : options.responseType === "blob" && response.ok
    ? await response.blob() : await response.json().catch(() => ({}));
  if (!response.ok) {
    const fallback = response.status === 409
      ? "Veprimi bie ndesh me të dhënat ekzistuese."
      : `Kërkesa dështoi (HTTP ${response.status}).`;
    const error = new Error(message(data, fallback));
    error.status = response.status;
    throw error;
  }
  return data;
}
export async function publicApi(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, cache: "no-store" });
  } catch {
    throw new Error("Nuk mund të lidhemi me serverin.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      message(data, "Kartela nuk u gjet ose nuk është më e vlefshme."),
    );
  return data;
}
export const resource = (path) => ({
  list: (p) => api(`${path}${query(p)}`),
  get: (id) => api(`${path}/${id}`),
  create: (b) => api(path, { method: "POST", body: JSON.stringify(b) }),
  update: (id, b) =>
    api(`${path}/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  remove: (id) => api(`${path}/${id}`, { method: "DELETE" }),
});
