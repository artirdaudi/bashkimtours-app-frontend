import { api, resource } from "./client";

export const authApi = {
  me: () => api("/auth/me"),
  changePassword: (b) =>
    api("/auth/change-password", { method: "POST", body: JSON.stringify(b) }),
};
export const vehiclesApi = resource("/vehicles");
export const driversApi = resource("/drivers");

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
