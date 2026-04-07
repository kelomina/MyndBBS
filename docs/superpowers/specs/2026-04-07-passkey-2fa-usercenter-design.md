# PassKey, 2FA, and User Center Design Specification

## Overview
This feature implements PassKey and Two-Factor Authentication (2FA) enforcement during user registration and login, along with a comprehensive User Center page. 

## Registration Flow
1. **Initial Registration**: The user enters their email, username, password, and completes a CAPTCHA.
2. **2FA Evaluation**:
   - The frontend checks if the browser supports Passkeys (`window.PublicKeyCredential`).
   - If **supported**, the user is forced to register a Passkey via WebAuthn to complete the registration process.
   - If **not supported**, the backend generates a TOTP secret and presents a QR code. The user must scan and verify the TOTP code to complete registration.
3. **Completion**: The user is fully registered and logged in with their chosen 2FA method securely linked.

## Login Flow
1. **Primary Authentication**: The user enters their username and password.
2. **2FA Challenge**:
   - The backend identifies the user's registered 2FA method (Passkey or TOTP).
   - A temporary token is issued, and the user is prompted for their required 2FA verification.
3. **Verification**: 
   - **Passkey**: The frontend requests a WebAuthn assertion, which the backend verifies.
   - **TOTP**: The user enters their TOTP code, which the backend verifies.
4. **Completion**: A final, fully authenticated JWT is issued.

## Database Changes (Prisma)
- **User Model**:
  - Add `totpSecret` (String, optional)
  - Add `isTotpEnabled` (Boolean, default false)
- **Session Model** (New):
  - Add `Session` model to track login history for the User Center (fields: `id`, `userId`, `ipAddress`, `userAgent`, `expiresAt`, `createdAt`).

## User Center Functionality
The User Center will provide the following sections:
- **Basic Profile**: Update email, username, and password.
- **Security Settings**: Manage Passkeys (add/remove) and manage TOTP settings.
- **Session Management**: View active sessions and login history, with the ability to revoke sessions.
- **Activity/Posts**: List posts created by the user.
- **Admin Link**: Display an entry point to the Admin Dashboard conditionally if `user.role === 'ADMIN'`.

## Architecture & Data Flow
- **Frontend**: Next.js React application handling the UI, WebAuthn interactions (via `@simplewebauthn/browser`), and TOTP QR code rendering.
- **Backend**: Express/Node.js application providing REST endpoints for 2FA registration, Passkey challenges/verification, TOTP verification, and user management.
- **Security**: 2FA secrets and assertions are securely stored and verified. Temporary JWTs with limited scopes are used during the multi-step authentication process.
