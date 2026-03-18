# oauth2-login Specification

## Purpose
TBD - created by archiving change add-oauth2-login. Update Purpose after archive.
## Requirements
### Requirement: OAuth2 Provider Listing

The system SHALL expose `/` that lists supported OAuth2 providers (Google and Raindrop) and links to start authentication for each.

#### Scenario: Home lists providers

- **WHEN** a client requests `/`
- **THEN** the response includes entries for Google and Raindrop
- **AND** each entry links to `/auth/google` or `/auth/raindrop` respectively

### Requirement: Start OAuth2 Authorization

The system SHALL redirect `/auth/{provider}` requests for supported providers to the provider's authorization URL using configured client credentials and redirect URI, and SHALL forward any caller-provided `state` query payload (including `extensionId`) unchanged so it is returned on callback.

#### Scenario: Supported provider redirect with state passthrough

- **GIVEN** `{provider}` is `google` or `raindrop` and required credentials are present
- **AND** the client supplies a `state` query parameter (e.g., JSON string containing `extensionId`)
- **WHEN** a client requests `/auth/{provider}`
- **THEN** the server builds the provider authorization URL with client id, redirect URI, required scopes, and the provided `state`
- **AND** responds with an HTTP 3xx redirect to that URL

#### Scenario: Unsupported provider

- **WHEN** a client requests `/auth/{provider}` with a provider outside the supported list
- **THEN** the server responds with a clear error (e.g., 404 or validation message) and does not redirect

### Requirement: Handle OAuth2 Callback

The system SHALL process `/auth/{provider}/callback` by exchanging the authorization code for access and refresh tokens, confirming receipt, and, when `state` includes an `extensionId`, sending those tokens to that Chrome extension via `chrome.runtime.sendMessage` with the provider and token payload.

#### Scenario: Successful code exchange with extension notification

- **GIVEN** `{provider}` is supported and credentials are configured
- **AND** the callback includes a valid `code`
- **AND** the `state` contains `extensionId`
- **WHEN** `/auth/{provider}/callback` receives the request
- **THEN** the system exchanges the code for access and refresh tokens with the provider
- **AND** sends `chrome.runtime.sendMessage` to the provided `extensionId` with `{ type: 'oauth_success', provider, tokens: { access_token, refresh_token, expires_in } }`
- **AND** responds with a success message indicating tokens were received

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

### Requirement: Provider Credentials From Environment

The system SHALL read OAuth2 credentials for each provider from `.env` and block flows when required values are absent.

#### Scenario: Missing credentials

- **WHEN** required environment variables for a provider are not set (client id, secret, redirect URI)
- **THEN** the system logs which variables are missing
- **AND** related auth routes return an error response instead of redirecting

### Requirement: Refresh OAuth2 Access Token

The system SHALL provide an endpoint `/auth/{provider}/refresh` that allows clients to exchange a valid refresh token for a new access token.

#### Scenario: Successful token refresh for Raindrop
- **GIVEN** `{provider}` is `raindrop` and credentials are configured
- **AND** a valid `refresh_token` is provided in the POST request body
- **WHEN** a client sends a POST request to `/auth/raindrop/refresh`
- **THEN** the system sends a POST request to Raindrop's token endpoint with `grant_type=refresh_token` and `application/json` content type
- **AND** returns the new token payload to the client

#### Scenario: Successful token refresh for Google
- **GIVEN** `{provider}` is `google` and credentials are configured
- **AND** a valid `refresh_token` is provided in the POST request body
- **WHEN** a client sends a POST request to `/auth/google/refresh`
- **THEN** the system sends a POST request to Google's token endpoint with `grant_type=refresh_token` and `application/x-www-form-urlencoded` content type
- **AND** returns the new token payload to the client

