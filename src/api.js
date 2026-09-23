import { API_BASE_URL, clearToken, getToken } from "./auth";
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
const resource = (path) => ({
  list: (p) => api(`${path}${query(p)}`),
  get: (id) => api(`${path}/${id}`),
  create: (b) => api(path, { method: "POST", body: JSON.stringify(b) }),
  update: (id, b) =>
    api(`${path}/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  remove: (id) => api(`${path}/${id}`, { method: "DELETE" }),
});
export const authApi = {
  me: () => api("/auth/me"),
  changePassword: (b) =>
    api("/auth/change-password", { method: "POST", body: JSON.stringify(b) }),
};
export const areasApi = resource("/areas");
export const vehiclesApi = resource("/vehicles");
export const driversApi = resource("/drivers");
export const studentsApi = {
  ...resource("/students"),
  overview: (p) => api(`/students/overview${query(p)}`),
  summary: () => api("/students/summary"),
  regenerateQr: (id) =>
    api(`/students/${id}/qr/regenerate`, { method: "POST" }),
};
export const qrApi = {
  profile: (token, options) => publicApi(`/qr/${encodeURIComponent(token)}`, options),
};
export const calendarApi = {
  years: (p) => api(`/academic-calendar/years${query(p)}`),
  active: () => api("/academic-calendar/years/active"),
  create: (b) =>
    api("/academic-calendar/years", {
      method: "POST",
      body: JSON.stringify(b),
    }),
  update: (id, b) =>
    api(`/academic-calendar/years/${id}`, {
      method: "PATCH",
      body: JSON.stringify(b),
    }),
  calendar: (id) => api(`/academic-calendar/years/${id}/calendar`),
  toggleMonth: (id, active) =>
    api(
      `/academic-calendar/months/${id}/active${query({ is_active: active })}`,
      { method: "PATCH" },
    ),
};
export const duesApi = {
  list: (p) => api(`/monthly-dues${query(p)}`),
  student: (id) => api(`/monthly-dues/students/${id}`),
  summary: (p) => api(`/monthly-dues/summary${query(p)}`),
  generate: (id) =>
    api(`/monthly-dues/students/${id}/generate`, { method: "POST" }),
  updateAmount: (id, b) =>
    api(`/monthly-dues/${id}/amount`, {
      method: "PATCH",
      body: JSON.stringify(b),
    }),
  officeCall: (id, b) =>
    api(`/monthly-dues/${id}/office-call`, {
      method: "POST",
      body: JSON.stringify(b),
    }),
};
export const paymentsApi = {
  list: (p) => api(`/payments${query(p)}`),
  create: (id, b) =>
    api(`/payments/monthly-dues/${id}`, {
      method: "POST",
      body: JSON.stringify(b),
    }),
  update: (id, b) =>
    api(`/payments/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  remove: (id) => api(`/payments/${id}`, { method: "DELETE" }),
};
export const studentAssignmentsApi = {
  list: (p) => api(`/student-vehicle-assignments${query(p)}`),
  summary: () => api("/student-vehicle-assignments/summary"),
  capacities: () => api("/student-vehicle-assignments/vehicle-capacities"),
  current: (id) => api(`/student-vehicle-assignments/students/${id}/current`),
  create: (b) =>
    api("/student-vehicle-assignments", {
      method: "POST",
      body: JSON.stringify(b),
    }),
  move: (id, b) =>
    api(`/student-vehicle-assignments/students/${id}/move`, {
      method: "POST",
      body: JSON.stringify(b),
    }),
  end: (id, b) =>
    api(`/student-vehicle-assignments/${id}/end`, {
      method: "POST",
      body: JSON.stringify(b),
    }),
  updateRouteOrder: (vehicleId, assignmentIds) =>
    api(`/student-vehicle-assignments/vehicles/${vehicleId}/route-order`, {
      method: "PUT",
      body: JSON.stringify({ assignment_ids: assignmentIds }),
    }),
};
export const driverAssignmentsApi = {
  list: (p) => api(`/driver-vehicle-assignments${query(p)}`),
  summary: () => api("/driver-vehicle-assignments/summary"),
  create: (b) =>
    api("/driver-vehicle-assignments", {
      method: "POST",
      body: JSON.stringify(b),
    }),
  end: (id, b) =>
    api(`/driver-vehicle-assignments/${id}/end`, {
      method: "POST",
      body: JSON.stringify(b),
    }),
};
export const followupApi = {
  summary: () => api("/payment-followup/summary"),
  queue: (name, p) => api(`/payment-followup/${name}${query(p)}`),
  process: (date) =>
    api(`/payment-followup/process${query({ process_date: date })}`, {
      method: "POST",
    }),
  mark: (id, type, b) =>
    api(`/payment-followup/${id}/${type}-sent`, {
      method: "POST",
      body: JSON.stringify(b),
    }),
};
export const followupRulesApi = {
  get: () => api("/payment-followup-rules"),
  create: (body) =>
    api("/payment-followup-rules", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id, body) =>
    api(`/payment-followup-rules/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
};
export const reportingApi = {
  summary: (p) => api(`/reporting/income/summary${query(p)}`),
  breakdown: (type, p) => api(`/reporting/income/by-${type}${query(p)}`),
};
