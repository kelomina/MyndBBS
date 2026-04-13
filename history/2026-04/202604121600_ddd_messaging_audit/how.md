# Technical Design & Architecture (How)

## Architecture Decisions

### 1. Aggregate Roots & Entities (Domain Layer)
- **`UserKey` Aggregate Root**: Represents a user's cryptographic keys within the Messaging domain.
  - Properties: `userId`, `scheme`, `publicKey`, `encryptedPrivateKey`, `mlKemPublicKey`, `encryptedMlKemPrivateKey`, `createdAt`, `updatedAt`.
  - Exposes behaviors like `updateKeys(...)`.
- **`ConversationSetting` Aggregate Root**: Represents a user's preference regarding two-sided message deletion within the Messaging domain.
  - Properties: `userId`, `partnerId`, `allowTwoSidedDelete`, `createdAt`, `updatedAt`.
  - Exposes behaviors like `updatePreference(allow)`.
- **`AuditLog` Aggregate Root**: Represents an immutable log record within the System domain.
  - Properties: `id`, `who`, `action`, `target`, `timestamp`.

### 2. Repositories (Infrastructure Layer)
- Define interfaces: `IUserKeyRepository`, `IConversationSettingRepository`, and `IAuditLogRepository`.
- Implement Prisma repositories: `PrismaUserKeyRepository`, `PrismaConversationSettingRepository`, and `PrismaAuditLogRepository`.

### 3. Application Services & Utilities
- Refactor `MessagingApplicationService` to inject `IUserKeyRepository` and `IConversationSettingRepository`. Replace the direct `upsert` queries in `uploadKeys` and `updateConversationSettings` with repository interactions.
- Refactor `lib/audit.ts` to instantiate `PrismaAuditLogRepository` and call `repository.save()`.

## Security & Performance Mitigations
- The `lib/audit.ts` function acts as a high-frequency cross-domain logger. Extracting it to DDD ensures we decouple the logging persistence. If performance becomes a bottleneck, the `IAuditLogRepository` implementation can be swapped to push logs to a high-throughput message queue or Redis stream without altering any callers.
- The `uploadKeys` and `updateConversationSettings` functions will remain transactional and secure via their respective domain logic.