# Change: Show backup-backed pinned results in the Raindrop workspace

## Why
Users want `/raindrop` to reflect the same pinned search results they already maintain in the extension backup, instead of managing a separate page-local pinned list.

## What Changes
- Remove page-local pin and unpin controls from `/raindrop` search results.
- Load pinned results from the extension backup stored in Raindrop (`nenya / backup` → `options_backup.txt`).
- Show the backup-backed pinned results in the search card when the user is not actively viewing search results.

## Impact
- Affected specs: `raindrop-browser-workspace`
- Affected code: `src/app/raindrop/page.tsx`, `src/lib/raindrop-api.ts`, `src/app/api/raindrop/pinned-results/route.ts`
