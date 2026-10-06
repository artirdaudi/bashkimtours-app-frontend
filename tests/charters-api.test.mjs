import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('charter assignments use the documented nested endpoints and bodies', async () => {
  globalThis.BroadcastChannel = undefined;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET', body: options.body });
    return Response.json(options.method === 'POST' ? { id: 1 } : []);
  };
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { charterAssignmentsApi } = await server.ssrLoadModule('/src/api/global.js');
    await charterAssignmentsApi.buses(7, { limit: 100, offset: 0 });
    await charterAssignmentsApi.assignBus(7, 12);
    await charterAssignmentsApi.drivers(5, { limit: 100, offset: 0 });
    await charterAssignmentsApi.assignDriver(5, 42);
    assert.match(calls[0].url, /\/charters\/7\/bus-assignments\?limit=100&offset=0$/);
    assert.equal(calls[1].body, JSON.stringify({ bus_id: 12 }));
    assert.match(calls[2].url, /\/charter-bus-assignments\/5\/drivers\?limit=100&offset=0$/);
    assert.equal(calls[3].body, JSON.stringify({ driver_id: 42 }));
  } finally { await server.close(); }
});
