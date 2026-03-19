# Change: Add pinned results in the Raindrop workspace

## Why
Users want to keep a small set of frequently opened Raindrop results visible on `/raindrop` without re-running the same searches each time.

## What Changes
- Add pin and unpin controls to `/raindrop` search result items and collections.
- Persist pinned results in browser storage on the `/raindrop` page.
- Show pinned results in the search card when the user is not actively viewing search results.

## Impact
- Affected specs: `raindrop-browser-workspace`
- Affected code: `src/app/raindrop/page.tsx`, `src/app/raindrop/page.module.css`, any new Raindrop page client storage helpers
