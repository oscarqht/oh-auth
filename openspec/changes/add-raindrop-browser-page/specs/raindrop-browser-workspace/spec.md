## ADDED Requirements
### Requirement: Guarded Raindrop Workspace

The system SHALL expose `/raindrop` as a web workspace that requires a valid Raindrop login before showing workspace data.

#### Scenario: Redirect unauthenticated visitor into Raindrop OAuth

- **WHEN** a visitor opens `/raindrop` without a valid stored Raindrop token
- **THEN** the client starts the Raindrop OAuth flow
- **AND** the callback returns the visitor to `/raindrop` after tokens are persisted

#### Scenario: Reuse refresh token when access token expires

- **GIVEN** a stored Raindrop refresh token is available
- **WHEN** the `/raindrop` page detects the access token is expired
- **THEN** it refreshes the access token through `/auth/raindrop/refresh`
- **AND** continues loading the workspace without requiring a full re-login

### Requirement: Search Raindrop Content

The system SHALL show a search input on `/raindrop` and search authenticated Raindrop items and collections.

#### Scenario: Search returns items and collections

- **GIVEN** the user is authenticated on `/raindrop`
- **WHEN** the user enters a search query
- **THEN** the page returns matching Raindrop items and collections
