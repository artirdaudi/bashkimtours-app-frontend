import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const manifest = JSON.parse(readFileSync(new URL('../dist/manifest.webmanifest', import.meta.url)));
const worker = readFileSync(new URL('../dist/sw.js', import.meta.url), 'utf8');
const routes = [];
const precache = [];
const listeners = new Map();
let skipped = false;
const workbox = {
  precacheAndRoute: (entries) => precache.push(...entries),
  cleanupOutdatedCaches() {},
  createHandlerBoundToURL: (url) => url,
  NavigationRoute: class { constructor(handler, options) { this.handler = handler; this.options = options; } },
  registerRoute: (route) => routes.push(route),
};
runInNewContext(worker, {
  self: { define() {}, addEventListener: (event, callback) => listeners.set(event, callback), skipWaiting: () => { skipped = true; } },
  define: (_deps, factory) => factory(workbox),
});

test('manifest has installable identity and correctly sized icons', () => {
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.id, '/');
  for (const icon of manifest.icons) {
    const png = readFileSync(new URL('../dist' + icon.src, import.meta.url));
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
  }
  assert(manifest.icons.some((icon) => icon.purpose === 'maskable'));
});

test('only app assets are precached and live APIs have no runtime cache', () => {
  assert.equal(routes.length, 1);
  assert.equal(routes[0].handler, 'index.html');
  for (const { url } of precache) {
    assert(existsSync(new URL('../dist/' + url, import.meta.url)), url);
    assert(!url.startsWith('http') && !url.startsWith('api/'));
  }
  const allowed = (path) => routes[0].options.allowlist.some((pattern) => pattern.test(path));
  for (const path of ['/', '/students', '/payments', '/student/test-token']) assert(allowed(path), path);
  for (const path of ['/api/auth/me', '/api/payments', '/auth/login', '/qr/test-token', '/health']) assert(!allowed(path), path);
});

test('new service worker waits for explicit update acceptance', () => {
  assert.equal(skipped, false);
  listeners.get('message')({ data: { type: 'UNRELATED' } });
  assert.equal(skipped, false);
  listeners.get('message')({ data: { type: 'SKIP_WAITING' } });
  assert.equal(skipped, true);
});
