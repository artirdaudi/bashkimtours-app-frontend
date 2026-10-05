import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

function storage() {
  const values = new Map();
  return { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
}

test('startup refresh, concurrent 401s, and logout use only memory and one refresh', async () => {
  globalThis.BroadcastChannel = undefined;
  globalThis.localStorage = storage();
  globalThis.sessionStorage = storage();
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { locks: { request: async (_name, callback) => callback() } } });
  localStorage.setItem('bashkimtours_access_token', 'old');
  let refreshes = 0;
  let logouts = 0;
  let token = 'first';
  let gate;
  globalThis.fetch = async (url, options = {}) => {
    if (url.endsWith('/auth/refresh')) {
      refreshes++;
      assert.equal(options.credentials, 'include');
      if (gate) await gate;
      token = refreshes === 1 ? 'first' : 'second';
      return Response.json({ access_token: token });
    }
    if (url.endsWith('/auth/logout')) {
      logouts++;
      assert.equal(options.credentials, 'include');
      return Response.json({});
    }
    return options.headers.Authorization === `Bearer ${token}` && token === 'second'
      ? Response.json({ ok: true }) : new Response('{}', { status: 401 });
  };
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  try {
    const auth = await server.ssrLoadModule('/src/auth.js');
    const { api } = await server.ssrLoadModule('/src/api/client.js');
    await auth.initializeAuth();
    assert.equal(auth.getAuthStatus(), 'authenticated');
    assert.equal(localStorage.getItem('bashkimtours_access_token'), undefined);
    assert.equal(auth.getToken(), 'first');
    gate = new Promise((resolve) => setTimeout(resolve, 10));
    const results = await Promise.all(['/maarif/students', '/maarif/cash-registers', '/maarif/payment-followup/summary', '/auth/me'].map((path) => api(path)));
    assert.deepEqual(results, Array(4).fill({ ok: true }));
    assert.equal(refreshes, 2);
    await auth.logout();
    assert.equal(logouts, 1);
    assert.equal(auth.getToken(), null);
    assert.equal(auth.getAuthStatus(), 'unauthenticated');
  } finally { await server.close(); }
});
