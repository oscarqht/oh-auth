# Change: Add Raindrop browser page

## Why
Users need a first-party web page in this app that can sign into Raindrop, search saved content, and inspect session collections without relying on the Chrome extension popup.

## What Changes
- Add a guarded `/raindrop` page for authenticated Raindrop access.
- Extend the OAuth callback flow so web clients can persist Raindrop tokens locally and return to `/raindrop`.
- Add authenticated Raindrop API routes for search and session browsing.

## Impact
- Affected specs: `oauth2-login`, `raindrop-browser-workspace`
- Affected code: `src/app/auth/[provider]/callback/route.ts`, `src/app/raindrop/page.tsx`, `src/app/api/raindrop/**`, `src/lib/raindrop-*.ts`
