## MODIFIED Requirements
### Requirement: Handle OAuth2 Callback

The system SHALL process `/auth/{provider}/callback` by exchanging the authorization code for access and refresh tokens, confirming receipt, and, when `state` includes an `extensionId`, sending those tokens to that Chrome extension via `chrome.runtime.sendMessage` with the provider and token payload. When `state` includes a supported same-origin web redirect target, the system SHALL persist the provider tokens in browser storage and redirect the browser back to that target.

#### Scenario: Successful code exchange with extension notification

- **GIVEN** `{provider}` is supported and credentials are configured
- **AND** the callback includes a valid `code`
- **AND** the `state` contains `extensionId`
- **WHEN** `/auth/{provider}/callback` receives the request
- **THEN** the system exchanges the code for access and refresh tokens with the provider
- **AND** sends `chrome.runtime.sendMessage` to the provided `extensionId` with `{ type: 'oauth_success', provider, tokens: { access_token, refresh_token, expires_in } }`
- **AND** responds with a success message indicating tokens were received

#### Scenario: Successful code exchange for web redirect

- **GIVEN** `{provider}` is supported and credentials are configured
- **AND** the callback includes a valid `code`
- **AND** the `state` contains a supported same-origin redirect target such as `/raindrop`
- **WHEN** `/auth/{provider}/callback` receives the request
- **THEN** the system exchanges the code for access and refresh tokens with the provider
- **AND** persists the provider tokens in browser storage
- **AND** redirects the browser to the requested page

#### Scenario: Successful code exchange without extension id

- **GIVEN** `{provider}` is supported and credentials are configured
- **AND** the callback includes a valid `code`
- **AND** the `state` does not contain `extensionId`
- **WHEN** `/auth/{provider}/callback` receives the request
- **THEN** the system exchanges the code for access and refresh tokens with the provider
- **AND** logs the received tokens to the server console
- **AND** responds with a success message indicating tokens were received

#### Scenario: Missing or invalid code

- **WHEN** the callback is invoked without `code` or the provider returns an error
- **THEN** the system logs the error details
- **AND** responds with an error message without attempting token exchange
