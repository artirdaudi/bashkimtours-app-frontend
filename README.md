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
