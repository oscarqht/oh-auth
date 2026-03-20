# Change: Add Raindrop albums page

## Why
Users want a gallery-oriented way to browse image collections in Raindrop without leaving this app or relying on the native Raindrop UI.

## What Changes
- Add an authenticated `/raindrop/albums` route with collection tree, album grid, and fullscreen photo viewer modes.
- Add authenticated Raindrop API routes for collection tree data and direct-child image albums.
- Add shared helper logic for Raindrop collection ordering, album image normalization, and URL-backed gallery state.

## Impact
- Affected specs: `raindrop-browser-workspace`
- Affected code: `src/app/raindrop/**`, `src/app/api/raindrop/**`, `src/lib/raindrop-albums.ts`, `tests/**`
