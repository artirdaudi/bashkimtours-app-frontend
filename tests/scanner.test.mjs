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

test('scanner audio requests playback, resumes on interaction, and restores the session', async () => {
  const { readFileSync } = await import('node:fs');
  const { runInNewContext } = await import('node:vm');
  const source = readFileSync(new URL('../src/scanAudio.js', import.meta.url), 'utf8').replaceAll('export function', 'function');
  let resumed = 0;
  let closed = 0;
  const navigator = { audioSession: { type: 'ambient' } };
  class AudioContext {
    state = 'suspended';
    resume() { resumed++; this.state = 'running'; return Promise.resolve(); }
    close() { closed++; this.state = 'closed'; return Promise.resolve(); }
  }
  const audio = runInNewContext(source + '\n({prepareScanAudio, releaseScanAudio})', { navigator, window: { AudioContext } });
  audio.prepareScanAudio();
  assert.equal(navigator.audioSession.type, 'playback');
  assert.equal(resumed, 1);
  audio.releaseScanAudio();
  assert.equal(navigator.audioSession.type, 'ambient');
  assert.equal(closed, 1);
});

test('unsupported audio APIs and autoplay suspension do not break scanning or queue tones', async () => {
  const { readFileSync } = await import('node:fs');
  const { runInNewContext } = await import('node:vm');
  const source = readFileSync(new URL('../src/scanAudio.js', import.meta.url), 'utf8').replaceAll('export function', 'function');
  const unsupported = runInNewContext(source + '\n({prepareScanAudio, playScanTone})', { navigator: {}, window: {} });
  assert.equal(unsupported.prepareScanAudio(), null);
  assert.doesNotThrow(() => unsupported.playScanTone('good'));
  class AudioContext {
    state = 'suspended';
    resume() { return Promise.resolve(); }
    createOscillator() { throw new Error('Must not queue a tone while suspended'); }
  }
  const blocked = runInNewContext(source + '\n({playScanTone})', { navigator: {}, window: { AudioContext } });
  assert.doesNotThrow(() => blocked.playScanTone('good'));
});
