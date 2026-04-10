# In-Site Communication System Design (E2EE Messages & Notifications)

## Overview
This document specifies the design for a secure, zero-knowledge, end-to-end encrypted (E2EE) private messaging system and a scalable, plaintext system notification module for MyndBBS. The system relies on WebAuthn's PRF (Pseudo-Random Function) extension, ECDH (NIST P-521 curve), and AES-GCM-256 to ensure that the server has absolutely zero knowledge of private message contents.

## Database Schema (Prisma)

### 1. `UserKey` Model (E2EE Keys)
Stores the user's asymmetric keypair for receiving encrypted messages.
- `userId`: `String` @id (Relation to User)
- `publicKey`: `String` (Base64-encoded NIST P-521 public key, stored in plaintext)
- `encryptedPrivateKey`: `String` (Base64-encoded NIST P-521 private key, encrypted with AES-GCM-256 using the PRF-derived symmetric key)
- `createdAt` / `updatedAt`

### 2. `PrivateMessage` Model (E2EE Messages)
Restricted to users with `level >= 2`.
- `id`: `String` @id @default(uuid())
- `senderId`: `String` (Relation to User)
- `receiverId`: `String` (Relation to User)
- `ephemeralPublicKey`: `String` (Base64-encoded sender's ephemeral P-521 public key, plaintext)
- `encryptedContent`: `String` (Base64-encoded AES-GCM-256 ciphertext containing the actual message text + IV)
- `isRead`: `Boolean` @default(false)
- `createdAt` / `updatedAt`

### 3. `Notification` Model (System Alerts)
Stores system-generated notifications. Unencrypted.
- `id`: `String` @id @default(uuid())
- `userId`: `String` (Relation to User)
- `type`: `NotificationType` (Enum: `POST_APPROVED`, `POST_REJECTED`, `POST_REPLIED`, `COMMENT_REPLIED`, `SYSTEM`)
- `title`: `String`
- `content`: `String`
- `relatedId`: `String?` (Optional ID to link to the relevant post/comment)
- `isRead`: `Boolean` @default(false)
- `createdAt` / `updatedAt`

## Architecture & Data Flow

### Phase 1: Key Initialization (First-Time Setup)
1. User (Level >= 2) visits the Private Messages page.
2. If `UserKey` doesn't exist, the frontend generates a new ECDH P-521 keypair via `window.crypto.subtle`.
3. Frontend triggers WebAuthn authentication requesting the `prf` extension.
4. The authenticator returns a stable PRF symmetric key.
5. Frontend uses the PRF key and AES-GCM-256 to encrypt the generated P-521 private key.
6. Frontend uploads the plaintext `publicKey` and the `encryptedPrivateKey` to the server.

### Phase 2: Sending an Encrypted Message (A -> B)
1. User A requests User B's `publicKey` from the server.
2. User A generates an ephemeral (temporary) ECDH P-521 keypair.
3. User A performs ECDH key agreement using their ephemeral private key and B's public key to derive a Shared Secret.
4. User A derives a 256-bit AES-GCM key from the Shared Secret via HKDF.
5. User A encrypts the message content using the AES-GCM key.
6. User A sends the `ephemeralPublicKey` (plaintext) and `encryptedContent` (ciphertext + IV) to the server.
7. The ephemeral private key is discarded from memory immediately.

### Phase 3: Receiving and Decrypting a Message (User B)
1. User B visits the inbox.
2. Frontend triggers WebAuthn authentication requesting the `prf` extension to obtain the PRF key.
3. Frontend downloads B's `encryptedPrivateKey` from the server and decrypts it using the PRF key to obtain the actual P-521 private key.
4. For each message, frontend extracts the sender's `ephemeralPublicKey`.
5. Frontend performs ECDH using B's real private key and the sender's `ephemeralPublicKey` to reconstruct the exact same Shared Secret.
6. Frontend derives the AES-GCM key via HKDF.
7. Frontend decrypts the `encryptedContent` to display the message in the UI.

### Phase 4: System Notifications
1. Triggered server-side (e.g., when an admin approves a post, or a user comments on a post).
2. Backend creates a `Notification` record in the database.
3. Frontend polls or fetches the `/api/v1/notifications` endpoint to display a badge/bell icon.
4. Users can mark notifications as read individually or all at once.

## Security Constraints & Edge Cases
- **Level Constraint**: Only Level 2 or above users can initialize keys or send/receive private messages.
- **Passkey Loss/Rotation**: If a user loses their Passkey, they lose the PRF key. Consequently, they cannot decrypt their `encryptedPrivateKey` and will permanently lose access to all past encrypted messages. They must re-initialize a new keypair to receive future messages.
- **Zero-Knowledge**: The server never sees the PRF key, the P-521 private key, the shared secret, the AES key, or the plaintext message content.

## Implementation Steps
1. Update Prisma schema with `UserKey`, `PrivateMessage`, and `Notification` models.
2. Implement backend API routes for key management (`/api/v1/messages/keys`).
3. Implement backend API routes for sending/fetching messages (`/api/v1/messages`).
4. Implement backend API routes for notifications (`/api/v1/notifications`) and integrate trigger points in existing post/comment logic.
5. Build the frontend E2EE cryptography service (`lib/crypto.ts`) using Web Crypto API.
6. Build frontend UI for the Notifications Dropdown/Page.
7. Build frontend UI for the Private Messages Inbox/Chat interface.
