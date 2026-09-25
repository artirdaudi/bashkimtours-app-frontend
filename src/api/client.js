import { API_BASE_URL, clearToken, getToken } from "../auth";
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
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      cache: "no-store",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        Authorization: `Bearer ${getToken()}`,
        ...options.headers,
      },
    });
  } catch {
    throw new Error("Nuk mund të lidhemi me serverin.");
  }
  if (response.status === 401) {
    clearToken();
    window.location.replace("/");
    throw new Error("Sesioni ka skaduar.");
  }
  const data =
    response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      message(
        data,
        response.status === 409
          ? "Veprimi bie ndesh me të dhënat ekzistuese."
          : "Kërkesa dështoi.",
      ),
    );
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
