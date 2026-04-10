# In-Site Communication System Design (E2EE Messages & Notifications)

## Overview
This document specifies the design for a secure, zero-knowledge, end-to-end encrypted (E2EE) private messaging system and a scalable, plaintext system notification module for MyndBBS. The system relies on WebAuthn's PRF (Pseudo-Random Function) extension and AES-GCM-256 to ensure that the server has absolutely zero knowledge of private message contents.
For Level >= 2 users, it uses ECDH (NIST P-521 curve).
For Level >= 4 users, it offers an optional **X-Wing** Hybrid Post-Quantum KEM scheme (mixing ECDH P-521 with ML-KEM-1024) for advanced security.

## Database Schema (Prisma)

### 1. `UserKey` Model (E2EE Keys)
Stores the user's asymmetric keypair for receiving encrypted messages.
- `userId`: `String` @id (Relation to User)
- `publicKey`: `String` (Base64-encoded NIST P-521 public key, stored in plaintext)
- `encryptedPrivateKey`: `String` (Base64-encoded NIST P-521 private key, encrypted with AES-GCM-256 using the PRF-derived symmetric key)
- `scheme`: `String` @default("P521_ONLY") (Enum: "P521_ONLY", "X_WING_HYBRID")
- `mlKemPublicKey`: `String?` (Base64-encoded ML-KEM-1024 public key, if X-Wing is used)
- `encryptedMlKemPrivateKey`: `String?` (Base64-encoded ML-KEM-1024 private key, encrypted with the same PRF AES key, if X-Wing is used)
- `createdAt` / `updatedAt`

### 2. `PrivateMessage` Model (E2EE Messages)
Restricted to users with `level >= 2`.
- `id`: `String` @id @default(uuid())
- `senderId`: `String` (Relation to User)
- `receiverId`: `String` (Relation to User)
- `ephemeralPublicKey`: `String` (Base64-encoded sender's ephemeral P-521 public key, plaintext)
- `mlKemCiphertext`: `String?` (Base64-encoded ML-KEM-1024 encapsulation ciphertext, if the receiver supports X-Wing and the sender uses it)
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
3. **If User Level >= 4**, they can optionally generate an additional ML-KEM-1024 keypair for the X-Wing hybrid scheme.
4. Frontend triggers WebAuthn authentication requesting the `prf` extension.
5. The authenticator returns a stable PRF symmetric key.
6. Frontend uses the PRF key and AES-GCM-256 to encrypt the generated private key(s) (P-521 and optionally ML-KEM-1024).
7. Frontend uploads the plaintext public key(s), the encrypted private key(s), and the chosen `scheme` to the server.

### Phase 2: Sending an Encrypted Message (A -> B)
1. User A requests User B's public key data from the server.
2. User A generates an ephemeral (temporary) ECDH P-521 keypair.
3. User A performs ECDH key agreement using their ephemeral private key and B's P-521 public key to derive `SharedSecret1`.
4. **If B supports X-Wing (Level >= 4)** and A chooses to use it, A encapsulates a secret against B's ML-KEM-1024 public key to derive `SharedSecret2` and an `mlKemCiphertext`.
5. User A derives a 256-bit AES-GCM key via HKDF. If using X-Wing, the HKDF input combines `SharedSecret1` and `SharedSecret2`. Otherwise, it uses just `SharedSecret1`.
6. User A encrypts the message content using the AES-GCM key.
7. User A sends the `ephemeralPublicKey`, `mlKemCiphertext` (if applicable), and `encryptedContent` (ciphertext + IV) to the server.
8. The ephemeral keys are discarded from memory immediately.

### Phase 3: Receiving and Decrypting a Message (User B)
1. User B visits the inbox.
2. Frontend triggers WebAuthn authentication requesting the `prf` extension to obtain the PRF key.
3. Frontend downloads B's encrypted private key(s) from the server and decrypts them using the PRF key to obtain the actual P-521 (and ML-KEM-1024) private key(s).
4. For each message, frontend extracts the sender's `ephemeralPublicKey` and optionally `mlKemCiphertext`.
5. Frontend performs ECDH using B's P-521 private key and the sender's `ephemeralPublicKey` to reconstruct `SharedSecret1`.
6. **If X-Wing was used**, B decapsulates the `mlKemCiphertext` using their ML-KEM-1024 private key to reconstruct `SharedSecret2`.
7. Frontend derives the AES-GCM key via HKDF (combining secrets if X-Wing was used).
8. Frontend decrypts the `encryptedContent` to display the message in the UI.

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
