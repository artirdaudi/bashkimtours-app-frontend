import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('charter assignments are sent in one create or update request', async () => {
  globalThis.BroadcastChannel = undefined;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ path: new URL(String(url), 'http://localhost').pathname, method: options.method || 'GET', body: JSON.parse(options.body) });
    return Response.json({ id: 55, assignments: [] });
  };
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { charterAssignmentsPayload } = await server.ssrLoadModule('/src/charterAssignmentSync.js');
    const { chartersApi } = await server.ssrLoadModule('/src/api/global.js');
    const assignments = charterAssignmentsPayload([
      { busId: '12', driverIds: ['10', '11'] },
      { busId: '13', driverIds: ['20', ''] },
    ], 2, 2);
    assert.deepEqual(assignments, [
      { bus_id: 12, driver_ids: ['10', '11'] },
      { bus_id: 13, driver_ids: ['20'] },
    ]);
    await chartersApi.create({ contractor: 'Example', assignments });
    await chartersApi.update(55, { contractor: 'Changed', assignments: [] });
    assert.deepEqual(calls, [
      { path: '/api/charters', method: 'POST', body: { contractor: 'Example', assignments } },
      { path: '/api/charters/55', method: 'PUT', body: { contractor: 'Changed', assignments: [] } },
    ]);
  } finally { await server.close(); }
});
