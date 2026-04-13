# Domain Context & Purpose (Why)

## Background
The application has successfully migrated its core logic to a Domain-Driven Design (DDD) and Command Query Responsibility Segregation (CQRS) architecture. However, during a final microscopic codebase audit, three specific persistence operations were identified as bypassing the domain layer via direct Prisma transaction scripts:
1. **UserKey Updates**: `MessagingApplicationService.uploadKeys` utilizes `prisma.userKey.upsert` to store end-to-end encryption keys.
2. **Conversation Settings**: `MessagingApplicationService.updateConversationSettings` utilizes `prisma.conversationSetting.upsert` to handle "allow two-sided delete" permissions.
3. **Audit Logging**: `lib/audit.ts` utilizes `prisma.auditLog.create` to record system actions.

## Value Proposition
While these components represent edge cases (key-value storage and append-only logging), elevating them to true Domain Aggregates finalizes the architectural purity of the system.
1. **Absolute Consistency**: Reaches the theoretical milestone of 0 direct database mutations within business logic or common utility libraries (excluding the deployment installer script).
2. **Future-Proofing**: If encryption key rotation policies or advanced audit log retention rules are needed, the logic will reside securely within the `UserKey` or `AuditLog` domain entities, preventing fragmented script updates.