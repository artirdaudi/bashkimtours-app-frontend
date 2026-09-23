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
- Updates: a new version waits for the user to choose **Përditëso**. Save work in every open app window before accepting an update.
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
4. Keep the app open while deploying a new build; verify the update prompt appears after returning to the app and only refreshes after acceptance.
