## ADDED Requirements
### Requirement: Pin Raindrop Search Results

The system SHALL let authenticated users pin and unpin `/raindrop` search result items and collections for quick access in the workspace.

#### Scenario: Pin a result from search

- **GIVEN** the user is authenticated on `/raindrop`
- **AND** search results are visible for the current query
- **WHEN** the user pins a Raindrop item or collection result
- **THEN** the page stores that result in browser storage for the workspace
- **AND** the result appears in the pinned section near the search input

#### Scenario: Unpin a previously pinned result

- **GIVEN** a result is already pinned in the `/raindrop` workspace
- **WHEN** the user unpins that result from the search list or pinned section
- **THEN** the page removes it from browser storage
- **AND** the result no longer appears in the pinned section

#### Scenario: Reload restores pinned results

- **GIVEN** the user previously pinned one or more `/raindrop` results
- **WHEN** the user reloads `/raindrop` with a valid login
- **THEN** the page restores the pinned results from browser storage
- **AND** shows them without requiring a new search
