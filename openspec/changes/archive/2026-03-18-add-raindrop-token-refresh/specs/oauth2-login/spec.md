## ADDED Requirements
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
