(() => {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (!standalone) return;
  const root = document.documentElement;
  root.classList.add('bt-pwa-standalone', 'bt-pwa-launch');
  const started = performance.now();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let finishing = false;
  const finish = () => {
    if (finishing) return;
    finishing = true;
    root.classList.add('bt-pwa-launch-leaving');
    window.setTimeout(() => {
      root.classList.remove('bt-pwa-launch', 'bt-pwa-launch-leaving');
      document.getElementById('bt-pwa-splash')?.remove();
      const app = document.getElementById('bt-app-content');
      if (app) app.inert = !navigator.onLine;
    }, reducedMotion ? 0 : 260);
  };
  // The splash never waits for authentication or network requests.
  const failsafe = window.setTimeout(finish, 8000);
  document.addEventListener('bt-app-ready', () => {
    window.clearTimeout(failsafe);
    window.setTimeout(finish, Math.max(0, (reducedMotion ? 0 : 950) - (performance.now() - started)));
  }, { once: true });
})();
