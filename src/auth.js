const TOKEN_KEY = "bashkimtours_access_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export const saveToken = (token) => localStorage.setItem(TOKEN_KEY, token);

export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export const API_BASE_URL = (import.meta.env.VITE_BASHKIMTOURS_API_URL || "").replace(/\/$/, "");

export async function login(username, password) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    cache: "no-store",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const validationMessage = Array.isArray(data.detail)
      ? data.detail.map((item) => item.msg).join(". ")
      : data.detail;
    throw new Error(validationMessage || "Hyrja dështoi. Kontrolloni të dhënat tuaja.");
  }

  if (typeof data.access_token !== "string" || !data.access_token.trim()) {
    throw new Error("Përgjigjja e serverit nuk përmban një sesion të vlefshëm.");
  }

  saveToken(data.access_token);
  return data;
}
