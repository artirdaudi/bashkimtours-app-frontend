import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const manifest = JSON.parse(readFileSync(new URL('../dist/manifest.webmanifest', import.meta.url)));
const worker = readFileSync(new URL('../dist/sw.js', import.meta.url), 'utf8');
const routes = [];
const precache = [];
let skipped = false;
let claimed = false;
const workbox = {
  precacheAndRoute: (entries) => precache.push(...entries),
  cleanupOutdatedCaches() {},
  clientsClaim() { claimed = true; },
  createHandlerBoundToURL: (url) => url,
  NavigationRoute: class { constructor(handler, options) { this.handler = handler; this.options = options; } },
  NetworkFirst: class { constructor(options) { this.options = options; } },
  CacheableResponsePlugin: class {},
  ExpirationPlugin: class {},
  registerRoute: (match, handler) => routes.push({ match, handler }),
};
runInNewContext(worker, {
  self: { define() {}, addEventListener() {}, skipWaiting: () => { skipped = true; } },
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
  assert(routes[0].handler instanceof workbox.NetworkFirst);
  assert.equal(routes[0].handler.options.fetchOptions.cache, 'no-store');
  assert(!precache.some(({ url }) => url.endsWith('.html')));
  for (const { url } of precache) {
    assert(existsSync(new URL('../dist/' + url, import.meta.url)), url);
    assert(!url.startsWith('http') && !url.startsWith('api/'));
  }
  const allowed = (path, mode = 'navigate', sameOrigin = true) => routes[0].match({ request: { mode }, url: new URL(path, 'https://app.bashkimtours.com'), sameOrigin });
  assert(!allowed('/students', 'cors'));
  assert(!allowed('/students', 'navigate', false));
  for (const path of ['/', '/students', '/skano', '/payments', '/student/test-token']) assert(allowed(path), path);
  for (const path of ['/api/auth/me', '/api/maarif/monthly-payments', '/api/maarif/qr/test-token', '/auth/login', '/health']) assert(!allowed(path), path);
});

test('new service worker activates and claims clients without user acceptance', () => {
  assert.equal(skipped, true);
  assert.equal(claimed, true);
});

function launchHarness(standalone, reduced = false) {
  const classes = new Set();
  const timers = [];
  const events = new Map();
  const app = { inert: true };
  let removed = false;
  const splash = { remove() { removed = true; } };
  runInNewContext(readFileSync(new URL('../public/pwa-launch.js', import.meta.url), 'utf8'), {
    navigator: { standalone: false, onLine: true }, performance: { now: () => 0 },
    window: {
      matchMedia: (query) => ({ matches: query.includes('reduced-motion') ? reduced : standalone }),
      setTimeout: (callback, delay) => { const timer = { callback, delay }; timers.push(timer); return timer; },
      clearTimeout: (timer) => { timer.cancelled = true; },
    },
    document: {
      documentElement: { classList: { add: (...names) => names.forEach((name) => classes.add(name)), remove: (...names) => names.forEach((name) => classes.delete(name)) } },
      getElementById: (id) => id === 'bt-app-content' ? app : splash,
      addEventListener: (event, callback) => events.set(event, callback),
    },
  });
  return { classes, timers, events, app, removed: () => removed };
}

test('ordinary browser tabs never show or wait for the PWA splash', () => {
  const launch = launchHarness(false);
  assert.equal(launch.classes.size, 0);
  assert.equal(launch.timers.length, 0);
});

test('installed launch fades away after app readiness and releases interaction', () => {
  const launch = launchHarness(true);
  assert(launch.classes.has('bt-pwa-launch'));
  launch.events.get('bt-app-ready')();
  assert(launch.timers[0].cancelled);
  assert.equal(launch.timers[1].delay, 950);
  launch.timers[1].callback();
  launch.timers[2].callback();
  assert(launch.removed());
  assert(!launch.classes.has('bt-pwa-launch'));
  assert.equal(launch.app.inert, false);
});

test('launch has a failsafe and respects reduced motion', () => {
  const launch = launchHarness(true);
  assert.equal(launch.timers[0].delay, 8000);
  launch.timers[0].callback(); launch.timers[1].callback();
  assert(launch.removed());
  const reduced = launchHarness(true, true);
  reduced.events.get('bt-app-ready')();
  assert.equal(reduced.timers[1].delay, 0);
  reduced.timers[1].callback();
  assert.equal(reduced.timers[2].delay, 0);
});
