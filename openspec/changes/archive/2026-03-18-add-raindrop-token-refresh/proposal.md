# Change: Add Raindrop Token Refresh

## Why
Users need a way to refresh their Raindrop access tokens using a refresh token when the access token expires (after two weeks), as per Raindrop's OAuth2 documentation.

## What Changes
- Add `refreshAccessToken` utility to `src/lib/oauth.ts`.
- Update `ProviderConfig` to support different token endpoint formats (JSON vs Form).
- Add a new API route `/auth/[provider]/refresh` to handle token refresh requests.

## Impact
- Affected specs: `oauth2-login`
- Affected code: `src/lib/oauth.ts`, `src/app/auth/[provider]/refresh/route.ts`
