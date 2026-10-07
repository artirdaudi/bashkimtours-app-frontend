import { api, query, resource } from "./client";

export const authApi = {
  me: () => api("/auth/me"),
  changePassword: (b) =>
    api("/auth/change-password", { method: "POST", body: JSON.stringify(b) }),
};
export const rolesApi = {
  list: () => api("/auth/roles"),
  create: (body) => api("/auth/roles", { method: "POST", body: JSON.stringify(body) }),
  update: (id, body) => api(`/auth/roles/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deactivate: (id) => api(`/auth/roles/${id}`, { method: "DELETE" }),
};
export const usersApi = {
  list: () => api("/auth/users"),
  get: (id) => api(`/auth/users/${id}`),
  create: (body) => api("/auth/users", { method: "POST", body: JSON.stringify(body) }),
  update: (id, body) => api(`/auth/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  cashRegisterAssignments: (id) => api(`/auth/users/${id}/cash-register-assignments`),
  createCashRegisterAssignment: (id, body) => api(`/auth/users/${id}/cash-register-assignments`, { method: "POST", body: JSON.stringify(body) }),
  deleteCashRegisterAssignment: (id, assignmentId) => api(`/auth/users/${id}/cash-register-assignments/${assignmentId}`, { method: "DELETE" }),
  assignRole: (id, roleId) => api(`/auth/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role_id: roleId }) }),
};
export const documentTypesApi = {
  list: () => api("/documents/document-types?include_inactive=true"),
  create: (body) => api("/documents/document-types", { method: "POST", body: JSON.stringify(body) }),
  update: (id, body) => api(`/documents/document-types/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
};
export const documentsApi = {
  list: (params) => api(`/documents${query(params)}`),
  upload: (formData) => api("/documents", { method: "POST", body: formData }),
  remove: (id) => api(`/documents/${id}`, { method: "DELETE" }),
  view: (id) => api(`/documents/${id}/view`, { responseType: "blob" }),
  download: (id) => api(`/documents/${id}/download`, { responseType: "blob" }),
};
export const vehiclesApi = resource("/vehicles");
export const autobusiApi = {
  list: (params) => api(`/autobusi${query(params)}`),
  create: (body) => api("/autobusi", { method: "POST", body: JSON.stringify(body) }),
  update: (id, body) => api(`/autobusi/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (id) => api(`/autobusi/${id}`, { method: "DELETE" }),
};
export const busExtApi = {
  list: (params) => api(`/busext${query(params)}`),
  create: (body) => api("/busext", { method: "POST", body: JSON.stringify(body) }),
  update: (id, body) => api(`/busext/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (id) => api(`/busext/${id}`, { method: "DELETE" }),
};
export const chartersApi = {
  list: (params) => api(`/charters${query(params)}`),
  get: (id) => api(`/charters/${id}`),
  create: (body) => api("/charters", { method: "POST", body: JSON.stringify(body) }),
  update: (id, body) => api(`/charters/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (id) => api(`/charters/${id}`, { method: "DELETE" }),
};
export const charterAssignmentsApi = {
  buses: (charterId, params) => api(`/charters/${charterId}/bus-assignments${query(params)}`),
  assignBus: (charterId, busId) => api(`/charters/${charterId}/bus-assignments`, { method: "POST", body: JSON.stringify({ bus_id: busId }) }),
  bus: (assignmentId) => api(`/charter-bus-assignments/${assignmentId}`),
  removeBus: (assignmentId) => api(`/charter-bus-assignments/${assignmentId}`, { method: "DELETE" }),
  drivers: (busAssignmentId, params) => api(`/charter-bus-assignments/${busAssignmentId}/drivers${query(params)}`),
  assignDriver: (busAssignmentId, driverId) => api(`/charter-bus-assignments/${busAssignmentId}/drivers`, { method: "POST", body: JSON.stringify({ driver_id: driverId }) }),
  driver: (assignmentId) => api(`/charter-driver-bus-assignments/${assignmentId}`),
  removeDriver: (assignmentId) => api(`/charter-driver-bus-assignments/${assignmentId}`, { method: "DELETE" }),
};
export const charterPaymentsApi = {
  list: (charterId) => api(`/charters/${charterId}/payments`),
  summary: (charterId) => api(`/charters/${charterId}/payments/summary`),
  create: (charterId, body) => api(`/charters/${charterId}/payments`, { method: "POST", body: JSON.stringify(body) }),
};
export const patenNalogsApi = {
  list: (params) => api(`/paten-nalogs${query(params)}`),
  create: (busAssignmentId, body) => api(`/charter-bus-assignments/${busAssignmentId}/paten-nalog`, { method: "POST", body: JSON.stringify(body) }),
  pdf: (id) => api(`/paten-nalogs/${id}/pdf`, { responseType: "blob" }),
};
export const driversApi = resource("/drivers");
export const shoferiApi = {
  ...resource("/shoferi"),
  select: (params) => api(`/shoferi/select${query(params)}`),
};

export const transportCardsApi = {
  getForStudent: (studentId) => api(`/transport-cards/students/${studentId}`),
  issue: (studentId, body) => api(`/transport-cards/students/${studentId}`, {
    method: "POST", body: JSON.stringify(body),
  }),
  update: (studentId, body) => api(`/transport-cards/students/${studentId}`, {
    method: "PATCH", body: JSON.stringify(body),
  }),
  remove: (studentId) => api(`/transport-cards/students/${studentId}`, { method: "DELETE" }),
};

export const cardPaymentsApi = {
  forStudent: (studentId) => api(`/card-payments/students/${studentId}`),
  create: (studentId, body) => api(`/card-payments/students/${studentId}`, {
    method: "POST", body: JSON.stringify(body),
  }),
  update: (paymentId, body) => api(`/card-payments/${paymentId}`, {
    method: "PATCH", body: JSON.stringify(body),
  }),
  remove: (paymentId) => api(`/card-payments/${paymentId}`, { method: "DELETE" }),
};
