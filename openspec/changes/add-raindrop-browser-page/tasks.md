## 1. Specification
- [x] 1.1 Add a spec delta for OAuth callback support for the web Raindrop page.
- [x] 1.2 Add a spec delta for the `/raindrop` workspace page.

## 2. Implementation
- [x] 2.1 Add shared helpers for web token persistence, redirect validation, and token refresh.
- [x] 2.2 Extend the OAuth callback route to support redirecting back to `/raindrop` after persisting tokens.
- [x] 2.3 Add authenticated Raindrop API routes for search, sessions, and session details.
- [x] 2.4 Implement the `/raindrop` page UI with auth guard, search results, and sessions list.

## 3. Verification
- [x] 3.1 Add focused tests for the new web token helpers.
- [x] 3.2 Run lint and targeted tests.
