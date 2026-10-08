import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('charter assignments use the documented nested endpoints and bodies', async () => {
  globalThis.BroadcastChannel = undefined;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET', body: options.body });
    if (String(url).endsWith('/paten-nalogs/9/pdf')) return new Response('%PDF-1.4', { headers: { 'Content-Type': 'application/pdf' } });
    return Response.json(options.method === 'POST' ? { id: 1 } : []);
  };
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { charterAssignmentsApi, patenNalogsApi } = await server.ssrLoadModule('/src/api/global.js');
    const { whatsappNotificationsApi } = await server.ssrLoadModule('/src/api/maarif.js');
    await charterAssignmentsApi.buses(7, { limit: 100, offset: 0 });
    await charterAssignmentsApi.assignBus(7, 12);
    await charterAssignmentsApi.drivers(5, { limit: 100, offset: 0 });
    await charterAssignmentsApi.assignDriver(5, 42);
    assert.match(calls[0].url, /\/charters\/7\/bus-assignments\?limit=100&offset=0$/);
    assert.equal(calls[1].body, JSON.stringify({ bus_id: 12 }));
    assert.match(calls[2].url, /\/charter-bus-assignments\/5\/drivers\?limit=100&offset=0$/);
    assert.equal(calls[3].body, JSON.stringify({ driver_id: 42 }));
    await patenNalogsApi.list({ charter_id: 7, limit: 1000, offset: 0 });
    await patenNalogsApi.create(5, { issue_date: '2026-10-07', issue_place: 'Tetovo' });
    const pdf = await patenNalogsApi.pdf(9);
    assert.match(calls[4].url, /\/paten-nalogs\?charter_id=7&limit=1000&offset=0$/);
    assert.match(calls[5].url, /\/charter-bus-assignments\/5\/paten-nalog$/);
    assert.equal(calls[5].body, JSON.stringify({ issue_date: '2026-10-07', issue_place: 'Tetovo' }));
    assert.match(calls[6].url, /\/paten-nalogs\/9\/pdf$/);
    assert.equal(await pdf.text(), '%PDF-1.4');
    await whatsappNotificationsApi.sendCharterDriverAssignment(23);
    assert.match(calls[7].url, /\/whatsapp\/charter-driver-assignment\/send$/);
    assert.equal(calls[7].method, 'POST');
    assert.equal(calls[7].body, JSON.stringify({ driver_bus_assignment_id: 23 }));
  } finally { await server.close(); }
});
