## ADDED Requirements
### Requirement: Show Backup-Backed Pinned Raindrop Results

The system SHALL show authenticated users the pinned Raindrop search results stored in the extension backup payload in Raindrop.

#### Scenario: Load pinned results from the Raindrop backup payload

- **GIVEN** the user is authenticated on `/raindrop`
- **WHEN** the page loads the `nenya / backup` collection and parses `options_backup.txt`
- **THEN** it restores valid `pinnedSearchResults` entries from the backup payload
- **AND** shows them in the pinned section near the search input when no search query is active

#### Scenario: Missing backup data yields an empty pinned state

- **GIVEN** the backup collection, backup file, or `pinnedSearchResults` payload is missing or malformed
- **WHEN** `/raindrop` loads
- **THEN** the page shows an empty pinned state
- **AND** it does not fall back to page-local browser storage

#### Scenario: Search results remain read-only

- **GIVEN** search results are visible for the current query on `/raindrop`
- **WHEN** the user views those results
- **THEN** the page does not offer pin or unpin controls for them
- **AND** pinned result changes must come from the Raindrop backup payload
