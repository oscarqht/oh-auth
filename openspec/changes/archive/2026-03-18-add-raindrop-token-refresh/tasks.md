## 1. Preparation
- [x] 1.1 Create change proposal and spec deltas

## 2. Implementation
- [x] 2.1 Update `ProviderConfig` and `providerConfigs` in `src/lib/oauth.ts` to support `tokenEndpointFormat`.
- [x] 2.2 Implement `refreshAccessToken` in `src/lib/oauth.ts`.
- [x] 2.3 Create `/auth/[provider]/refresh` route in `src/app/auth/[provider]/refresh/route.ts`.

## 3. Testing
- [x] 3.1 Create and run mock tests for token refresh logic.
