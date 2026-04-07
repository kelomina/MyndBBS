# Active Session Management Design

## Context
Currently, the backend issues JWTs but does not tightly couple them with the `Session` records stored in the database. When a user revokes a session via the frontend, the `Session` record is deleted from the DB, but the existing JWTs (`accessToken` and `refreshToken`) remain valid until their expiration. The user requested that modifying (revoking) an active session immediately invalidates the associated tokens.

## Proposed Design

### 1. Link Tokens to Session DB Records
- **Token Payload**: Update the JWT generation logic to include a `sessionId` in the payload of both the `accessToken` and `refreshToken`.
- **Session Creation on Login**: Currently, `packages/backend/src/controllers/register.ts` (in `loginUser`) does not create a `Session` record when a user logs in without 2FA. We will export the `finalizeAuth` helper from `auth.ts` and reuse it in `loginUser` to ensure all logins (with or without 2FA) generate a `Session` record and return the correct JWTs.

### 2. Update `finalizeAuth` Helper
- In `packages/backend/src/controllers/auth.ts`:
  - Create the `Session` record first to get the `sessionId`.
  - Include `sessionId` in the payload when calling `jwt.sign` for both tokens.
  - Make sure to export this function so `register.ts` can use it.

### 3. Middleware Enforcement (`requireAuth`)
- In `packages/backend/src/middleware/auth.ts`:
  - After successfully verifying the JWT, extract the `sessionId`.
  - Check the database to see if a `Session` with that ID exists.
  - If the session does not exist, reject the request with `401 Unauthorized` and clear the cookies.

### 4. Refresh Token Enforcement
- In `packages/backend/src/controllers/register.ts` (`refreshToken` function):
  - Extract the `sessionId` from the verified refresh token.
  - Check the database for the session.
  - If the session does not exist, return `401 Unauthorized` and clear the cookies.
  - When generating a new `accessToken`, include the existing `sessionId` in its payload so the link is maintained.

### 5. Session Revocation
- In `packages/backend/src/controllers/user.ts` (`revokeSession` function):
  - When the user revokes a session, it is deleted from the database. Because of the middleware enforcement (step 3), any subsequent requests using the tokens tied to that `sessionId` will immediately fail.

## Benefits
- Real-time invalidation: As soon as a session is deleted, the database check fails, and the token is rejected.
- Single source of truth for auth logic: Consolidating `loginUser` and 2FA login into `finalizeAuth`.