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
- **AND** labels results that belong to session collections

### Requirement: Browse Session Collections

The system SHALL show a sessions list on `/raindrop` using the same Raindrop session collection model as the extension popup.

#### Scenario: Sessions list shows session collections

- **GIVEN** authenticated Raindrop access
- **WHEN** `/raindrop` loads
- **THEN** the page lists child collections under `nenya / sessions`
- **AND** sorts them by recent activity

#### Scenario: Expanding a session shows window and tab structure

- **GIVEN** a session exists in the list
- **WHEN** the user expands that session
- **THEN** the page fetches the session items from Raindrop
- **AND** renders windows, groups, and tabs in a nested list
