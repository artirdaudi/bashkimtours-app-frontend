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
