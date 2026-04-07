# Passwordless Passkey Login Design

## Context
The login interface currently has a "Log in with Passkey" button. The backend currently only supports Passkey as a second-factor authentication (requiring a user ID via a `tempToken` from an initial email/password check). The goal is to make this button trigger a true passwordless login using WebAuthn Discoverable Credentials (Resident Keys).

## Architecture & Data Flow
1. **Frontend Trigger**: When the user clicks the "Log in with Passkey" button, the frontend calls the backend to generate authentication options without providing any user credentials.
2. **Backend Options Generation**: The backend endpoint (`GET /api/v1/auth/passkey/generate-authentication-options`) detects the absence of a `tempToken` and generates an anonymous challenge. It sets `allowCredentials` to an empty array (to prompt the browser for all available passkeys) and stores the challenge in the `AuthChallenge` table with a newly generated UUID (`challengeId`).
3. **WebAuthn Invocation**: The frontend receives the options and `challengeId`, and uses `@simplewebauthn/browser`'s `startAuthentication(options)` to prompt the user.
4. **Backend Verification**: The frontend sends the authentication response along with the `challengeId` to `POST /api/v1/auth/passkey/verify-authentication`. The backend retrieves the challenge by `challengeId`, finds the passkey by `response.id`, verifies the signature, looks up the associated user, and issues standard JWT tokens (`accessToken`, `refreshToken`) to complete the login.

## Error Handling
- **Missing or Expired Challenge**: Returns a 400 error.
- **Passkey Not Found**: Returns a 400 error if the `response.id` does not match any registered passkey.
- **User Not Found**: Fails the login if the passkey's `userId` no longer exists.
- **Frontend Errors**: Handles `NotAllowedError` (user cancelled) or unsupported platform errors gracefully by displaying an inline error message.
