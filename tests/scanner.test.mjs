import test from 'node:test';
import assert from 'node:assert/strict';
import { cardToken, scanStatus, createScanGate } from '../src/scanUtils.js';
const today = new Date(2026, 8, 24);
const due = (status, month = 9) => ({ status, month, calendar_year: 2026 });
const profile = (...dues) => ({ student: { id: 1 }, transport_allowed: true, monthly_dues: dues });
test('QR accepts card URLs without following arbitrary links', () => {
  assert.equal(cardToken('https://app.bashkimtours.com/student/abc12345-token'), 'abc12345-token');
  assert.equal(cardToken('http://localhost:5173/student/abc12345-token'), 'abc12345-token');
  for (const value of ['javascript:alert(1)', 'https://example.com/', 'https://example.com/student/a%2Fb', 'not a url']) assert.equal(cardToken(value), null);
});
test('paid current month succeeds, future pending dues do not fail it', () => {
  assert.equal(scanStatus(profile(due('PAID'), due('PENDING', 10)), today).kind, 'good');
});
test('unpaid current or previous month and blocked transport never sound success', () => {
  for (const status of ['PENDING', 'OVERDUE', 'BLOCKED']) assert.equal(scanStatus(profile(due(status)), today).kind, 'bad');
  assert.equal(scanStatus(profile(due('PAID'), due('OVERDUE', 8)), today).kind, 'bad');
  assert.equal(scanStatus({ ...profile(due('PAID')), transport_allowed: false }, today).kind, 'bad');
});
test('missing current month and malformed replies are not treated as paid', () => {
  assert.equal(scanStatus(profile(due('PAID', 8)), today).kind, 'unknown');
  assert.throws(() => scanStatus({}, today));
});
test('continuous frames do not beep repeatedly; different cards scan immediately', () => {
  const accept = createScanGate();
  assert(accept('A', 0)); assert(!accept('A', 100)); assert(!accept('A', 1500));
  assert(accept('B', 1600)); assert(accept('A', 1700)); assert(!accept('A', 1800));
  assert(accept('A', 4001));
});
