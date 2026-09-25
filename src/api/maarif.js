import { api, publicApi, query, resource } from "./client";

export const maarifSettingsApi = {
  get: () => api("/settings"),
  update: (body) => api("/settings", { method: "PATCH", body: JSON.stringify(body) }),
};

export const areasApi = resource("/maarif/areas");
export const studentsApi = {
  ...resource("/maarif/students"),
  overview: (p) => api(`/maarif/students/overview${query(p)}`),
  summary: () => api("/maarif/students/summary"),
  regenerateQr: (id) =>
    api(`/maarif/students/${id}/qr/regenerate`, { method: "POST" }),
};
export const qrApi = {
  profile: (token, options) => publicApi(`/maarif/qr/${encodeURIComponent(token)}`, options),
};
export const calendarApi = {
  years: (p) => api(`/maarif/academic-calendar/years${query(p)}`),
  active: () => api("/maarif/academic-calendar/years/active"),
  create: (b) =>
    api("/maarif/academic-calendar/years", {
      method: "POST",
      body: JSON.stringify(b),
    }),
  update: (id, b) =>
    api(`/maarif/academic-calendar/years/${id}`, {
      method: "PATCH",
      body: JSON.stringify(b),
    }),
  calendar: (id) => api(`/maarif/academic-calendar/years/${id}/calendar`),
  toggleMonth: (id, active) =>
    api(
      `/maarif/academic-calendar/months/${id}/active${query({ is_active: active })}`,
      { method: "PATCH" },
    ),
};
export const duesApi = {
  list: (p) => api(`/maarif/monthly-dues${query(p)}`),
  student: (id) => api(`/maarif/monthly-dues/students/${id}`),
  summary: (p) => api(`/maarif/monthly-dues/summary${query(p)}`),
  generate: (id) =>
    api(`/maarif/monthly-dues/students/${id}/generate`, { method: "POST" }),
  updateAmount: (id, b) =>
    api(`/maarif/monthly-dues/${id}/amount`, {
      method: "PATCH",
      body: JSON.stringify(b),
    }),
  officeCall: (id, b) =>
    api(`/maarif/monthly-dues/${id}/office-call`, {
      method: "POST",
      body: JSON.stringify(b),
    }),
};
export const monthlyPaymentsApi = {
  list: (p) => api(`/maarif/monthly-payments${query(p)}`),
  create: (id, b) =>
    api(`/maarif/monthly-payments/monthly-dues/${id}`, {
      method: "POST",
      body: JSON.stringify(b),
    }),
  update: (id, b) =>
    api(`/maarif/monthly-payments/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  remove: (id) => api(`/maarif/monthly-payments/${id}`, { method: "DELETE" }),
};
export const studentAssignmentsApi = {
  list: (p) => api(`/maarif/student-vehicle-assignments${query(p)}`),
  summary: () => api("/maarif/student-vehicle-assignments/summary"),
  capacities: () => api("/maarif/student-vehicle-assignments/vehicle-capacities"),
  current: (id) => api(`/maarif/student-vehicle-assignments/students/${id}/current`),
  create: (b) =>
    api("/maarif/student-vehicle-assignments", {
      method: "POST",
      body: JSON.stringify(b),
    }),
  move: (id, b) =>
    api(`/maarif/student-vehicle-assignments/students/${id}/move`, {
      method: "POST",
      body: JSON.stringify(b),
    }),
  end: (id, b) =>
    api(`/maarif/student-vehicle-assignments/${id}/end`, {
      method: "POST",
      body: JSON.stringify(b),
    }),
  updateRouteOrder: (vehicleId, assignmentIds) =>
    api(`/maarif/student-vehicle-assignments/vehicles/${vehicleId}/route-order`, {
      method: "PUT",
      body: JSON.stringify({ assignment_ids: assignmentIds }),
    }),
};
export const driverAssignmentsApi = {
  list: (p) => api(`/maarif/driver-vehicle-assignments${query(p)}`),
  summary: () => api("/maarif/driver-vehicle-assignments/summary"),
  create: (b) =>
    api("/maarif/driver-vehicle-assignments", {
      method: "POST",
      body: JSON.stringify(b),
    }),
  end: (id, b) =>
    api(`/maarif/driver-vehicle-assignments/${id}/end`, {
      method: "POST",
      body: JSON.stringify(b),
    }),
};
export const followupApi = {
  summary: () => api("/maarif/payment-followup/summary"),
  firstWarning: (p) => api(`/maarif/payment-followup/first-warning${query(p)}`),
  officeCall: (p) => api(`/maarif/payment-followup/office-call${query(p)}`),
  finalWarning: (p) => api(`/maarif/payment-followup/final-warning${query(p)}`),
  blocked: (p) => api(`/maarif/payment-followup/blocked${query(p)}`),
  process: (date) =>
    api(`/maarif/payment-followup/process${query({ process_date: date })}`, {
      method: "POST",
    }),
  markFirstWarning: (id, b) =>
    api(`/maarif/payment-followup/${id}/first-warning-sent`, {
      method: "POST",
      body: JSON.stringify(b),
    }),
  markFinalWarning: (id, b) =>
    api(`/maarif/payment-followup/${id}/final-warning-sent`, {
      method: "POST",
      body: JSON.stringify(b),
    }),
};
export const followupRulesApi = {
  get: () => api("/maarif/payment-followup-rules"),
  create: (body) =>
    api("/maarif/payment-followup-rules", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id, body) =>
    api(`/maarif/payment-followup-rules/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
};
export const maarifReportingApi = {
  summary: (p) => api(`/maarif/reporting/income/summary${query(p)}`),
  byUser: (p) => api(`/maarif/reporting/income/by-user${query(p)}`),
  byArea: (p) => api(`/maarif/reporting/income/by-area${query(p)}`),
  byMonth: (p) => api(`/maarif/reporting/income/by-month${query(p)}`),
  byDate: (p) => api(`/maarif/reporting/income/by-date${query(p)}`),
};
