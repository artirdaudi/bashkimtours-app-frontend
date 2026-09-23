# Bashkim Tours App Frontend

Standalone React frontend for the Bashkim Tours operational application.

## Local development

1. Create `.env.development.local` with:
   ```env
   VITE_BASHKIMTOURS_API_URL=/api
   DEV_API_TARGET=https://bashkimtours-api-echgccgjezaafvet.italynorth-01.azurewebsites.net
   ```
2. Optionally set `VITE_APP_URL` to the public app URL for shareable QR cards. Otherwise cards use the current browser origin. The development proxy lets local requests reach the API on whichever port Vite selects.
3. Run `npm install`.
4. Run `npm run dev`.

## Production environment

```env
VITE_BASHKIMTOURS_API_URL=https://bashkimtours-api-echgccgjezaafvet.italynorth-01.azurewebsites.net
VITE_APP_URL=https://app.bashkimtours.com
```

The Azure API must allow `https://app.bashkimtours.com` in its CORS configuration.

## Progressive web app

The production build generates `manifest.webmanifest`, `sw.js`, and app icons.
The service worker is disabled during `npm run dev` to avoid stale development assets.

- Installation: use the browser install action, or the in-app install button where supported. On iPhone/iPad, use Safari → Share → Add to Home Screen.
- Offline: only the interface and static assets are cached. The offline screen preserves unfinished forms in the current window. API requests use `no-store`; payment writes are never queued for later delivery.
- Updates: browser tabs and installed PWAs automatically reload when a new service worker activates. Updates are checked on load, focus, reconnection, returning to the app, and every 60 seconds while visible and online. There is no update prompt. Reloading can discard unsaved input or interrupt confirmation of an in-flight payment; verify payment history before retrying. Suspended/offline clients update after returning online. Strict rejection of older clients requires backend version enforcement.
- QR cards: set `VITE_APP_URL` to the public HTTPS origin before building, so exported cards are usable from other devices.

Set the production environment values above, then run `npm run test:pwa` and `npm run preview -- --host 127.0.0.1`. Preview serves the production build; it does not automatically use `.env.development.local`. The API must allow the preview origin if testing authenticated flows locally.

Deploy `dist` over HTTPS. The Vercel configuration preserves SPA navigation and prevents stale caching of the service worker. Other hosts should serve `/sw.js` with `Cache-Control: no-cache` and route app pages to `index.html`.

For a local PWA preview with the development API proxy, use:
```sh
npm run build -- --mode development
npm run preview -- --mode development --host 127.0.0.1 --port 4173
```
This creates a local test build using `.env.development.local`. Rebuild with production environment values before deployment.

Before release, check on an actual phone and desktop browser:
1. Install and launch from the home screen; confirm the app opens standalone.
2. After one online visit, reopen offline; verify the offline screen hides live data and blocks payments.
3. Reconnect and verify login, QR verification, card downloads, and receipt printing.
4. Keep a browser tab and installed app open while deploying a new build; verify they reload automatically after detection, without any update prompt. Also test returning from the background and reconnecting after being offline.

Existing clients running an older release must receive this release once before the new periodic update checks apply. Automatic updates require a working service worker and internet connection; they are not a substitute for backend minimum-version enforcement.
