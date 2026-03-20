## ADDED Requirements
### Requirement: Browse Raindrop Collections As Albums

The system SHALL expose `/raindrop/albums` as an authenticated Raindrop gallery workspace that lets users browse the collection tree and open a collection as an image album.

#### Scenario: Load collection tree

- **GIVEN** the user has a valid Raindrop login
- **WHEN** the user opens `/raindrop/albums`
- **THEN** the page loads the Raindrop collection tree
- **AND** orders root collections to follow Raindrop's collection groups when that metadata is available

#### Scenario: Open collection in album mode

- **GIVEN** the collection tree is visible on `/raindrop/albums`
- **WHEN** the user selects a collection
- **THEN** the page enters album mode
- **AND** shows only direct-child Raindrop items with type `image`

### Requirement: Persist Album Navigation In URL

The system SHALL store the selected collection and selected photo in the `/raindrop/albums` URL so album state survives refresh and browser navigation.

#### Scenario: Select collection

- **WHEN** the user selects a collection in the albums workspace
- **THEN** the page updates the URL with the collection id
- **AND** a reload returns the user to that album

#### Scenario: Open photo

- **WHEN** the user opens a photo in album mode
- **THEN** the page updates the URL with the selected photo id
- **AND** browser Back exits photo mode instead of stepping through each next or previous photo action

### Requirement: View Photos Fullscreen

The system SHALL provide a fullscreen photo mode for `/raindrop/albums`.

#### Scenario: Desktop photo navigation

- **GIVEN** a photo is open in fullscreen mode on desktop
- **WHEN** the user presses left or right arrow
- **THEN** the page opens the previous or next image in the current album
- **AND** pressing Escape returns to album mode

#### Scenario: Mobile photo gestures

- **GIVEN** a photo is open in fullscreen mode on mobile
- **WHEN** the user swipes left or right
- **THEN** the page opens the previous or next image in the current album
- **AND** swiping down returns to album mode
- **AND** pinch and drag gestures allow zooming and panning the active image
