const TOKEN_KEY = "bashkimtours_access_token";
const REFRESH_EPOCH_KEY = "bashkimtours_refresh_epoch";
export const API_BASE_URL = (import.meta.env.VITE_BASHKIMTOURS_API_URL || "").replace(/\/$/, "");

let accessToken = null;
let authStatus = "initializing";
let refreshPromise = null;
let startupPromise = null;
let generation = 0;
let tokenVersion = 0;
const tokenWaiters = new Set();
const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("bashkimtours-auth");
channel?.addEventListener("message", (event) => {
  if (event.data?.type === "token") { accessToken = event.data.token; tokenVersion += 1; tokenWaiters.forEach((resolve) => resolve(accessToken)); tokenWaiters.clear(); setStatus("authenticated"); }
  if (event.data?.type === "logout") clearToken(false);
  if (event.data?.type === "request-token" && accessToken) channel?.postMessage({ type: "token", token: accessToken });
});
const listeners = new Set();

export const getToken = () => accessToken;
export const getAuthStatus = () => authStatus;
export const subscribeAuth = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
function setStatus(status) { authStatus = status; listeners.forEach((listener) => listener()); }
export function saveToken(token) { accessToken = token; tokenVersion += 1; tokenWaiters.forEach((resolve) => resolve(token)); tokenWaiters.clear(); setStatus("authenticated"); channel?.postMessage({ type: "token", token }); }
export function clearToken(broadcast = true) { accessToken = null; generation += 1; setStatus("unauthenticated"); if (broadcast) channel?.postMessage({ type: "logout" }); }
export const clearLegacyToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
};

export async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;
  const currentGeneration = generation;
  const startingVersion = tokenVersion;
  const startingEpoch = localStorage.getItem(REFRESH_EPOCH_KEY);
  const perform = async () => {
    // The browser lock serializes refresh-cookie rotation across tabs and PWA windows.
    const refresh = async () => {
      if (generation !== currentGeneration) throw new Error("Sesioni u mbyll.");
      if (tokenVersion !== startingVersion && accessToken) return accessToken;
      if (channel && localStorage.getItem(REFRESH_EPOCH_KEY) !== startingEpoch) {
        const sharedToken = await new Promise((resolve) => {
          const timer = setTimeout(() => { tokenWaiters.delete(receive); resolve(null); }, 1000);
          const receive = (value) => { clearTimeout(timer); resolve(value); };
          tokenWaiters.add(receive);
          channel.postMessage({ type: "request-token" });
        });
        if (sharedToken) return sharedToken;
      }
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST", credentials: "include", cache: "no-store",
      });
      if (!response.ok) {
        const error = new Error("Sesioni ka skaduar.");
        error.status = response.status;
        throw error;
      }
      const data = await response.json();
      if (typeof data.access_token !== "string" || !data.access_token) throw new Error("Përgjigjja e serverit nuk përmban një sesion të vlefshëm.");
      if (generation !== currentGeneration) throw new Error("Sesioni u mbyll.");
      localStorage.setItem(REFRESH_EPOCH_KEY, crypto.randomUUID());
      saveToken(data.access_token);
      return data.access_token;
    };
    if (navigator.locks?.request) return navigator.locks.request("bashkimtours-auth-refresh", refresh);
    return refresh();
  };
  refreshPromise = perform().catch((error) => {
    if (generation === currentGeneration && error.status >= 400 && error.status < 500) clearToken();
    throw error;
  }).finally(() => { refreshPromise = null; });
  return refreshPromise;
}

export function initializeAuth() {
  if (startupPromise) return startupPromise;
  clearLegacyToken();
  startupPromise = refreshAccessToken().catch((error) => {
    if (authStatus === "initializing") {
      // A network outage is not evidence that the cookie was revoked.
      setStatus(error.status ? "unauthenticated" : "unavailable");
    }
  });
  return startupPromise;
}

export async function login(username, password) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    cache: "no-store", method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const validationMessage = Array.isArray(data.detail)
      ? data.detail.map((item) => item.msg).join(". ") : data.detail;
    throw new Error(validationMessage || "Hyrja dështoi. Kontrolloni të dhënat tuaja.");
  }
  if (typeof data.access_token !== "string" || !data.access_token.trim()) {
    throw new Error("Përgjigjja e serverit nuk përmban një sesion të vlefshëm.");
  }
  saveToken(data.access_token);
  return data;
}

export async function logout() {
  const token = accessToken;
  clearToken();
  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST", credentials: "include", cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch { /* Local logout is final even if the network is unavailable. */ }
}
