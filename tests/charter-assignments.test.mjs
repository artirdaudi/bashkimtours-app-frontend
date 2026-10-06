import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('saving charter selections reconciles buses and drivers without duplicating existing assignments', async () => {
  globalThis.BroadcastChannel = undefined;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ path: new URL(String(url), 'http://localhost').pathname, method: options.method || 'GET', body: options.body && JSON.parse(options.body) });
    return Response.json({ id: 55 });
  };
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { selectedCharterAssignments, syncCharterAssignments } = await server.ssrLoadModule('/src/charterAssignmentSync.js');
    assert.deepEqual(selectedCharterAssignments([{ busId: "", driverIds: ["10"] }, { busId: "12", driverIds: ["", "11"] }], 2, 2), [{ busId: "12", driverIds: ["11"] }]);
    await syncCharterAssignments(7, [
      { busId: '12', driverIds: ['10', '11'] },
      { busId: '13', driverIds: ['20'] },
    ], [{ id: 3, bus_id: 12, drivers: [{ id: 8, driver_id: '10' }, { id: 9, driver_id: '99' }] }]);
    assert.deepEqual(calls.map(({ path, method }) => `${method} ${path}`), [
      'DELETE /api/charter-driver-bus-assignments/9',
      'POST /api/charter-bus-assignments/3/drivers',
      'POST /api/charters/7/bus-assignments',
      'POST /api/charter-bus-assignments/55/drivers',
    ]);
    assert.deepEqual(calls.slice(1).map(({ body }) => body), [{ driver_id: '11' }, { bus_id: 13 }, { driver_id: '20' }]);
  } finally { await server.close(); }
});
