import type { IDomainEvent } from '../../domain/shared/events/IEventBus'
import type { PluginEventEnvelope } from './PluginContracts'
import { createHash } from 'node:crypto'

export type PluginEventDefinition = {
  name: string
  version: number
  toPayload(event: IDomainEvent): Record<string, unknown>
}

// Explicit v1 DTOs: identifiers and bounded metadata only. Never copy domain objects,
// free-text moderation reasons, post titles, private content or future added properties.
const fields: Readonly<Record<string, readonly string[]>> = {
  PostApprovedEvent: ['postId', 'authorId'],
  PostRejectedEvent: ['postId', 'authorId'],
  PostRepliedEvent: ['postId', 'authorId', 'replierId', 'commentId'],
  CommentRepliedEvent: ['parentCommentId', 'authorId', 'postId', 'replierId', 'childCommentId'],
  MentionedEvent: ['userId', 'postId', 'commentId', 'mentionerId'],
  PrivateMessageSentEvent: ['messageId', 'senderId', 'receiverId', 'isSystem'],
  MessageRemovedEvent: ['messageId', 'targetUserId', 'partnerId'],
  MessageExpiredEvent: ['messageId', 'receiverId', 'expiresAt'],
  ModeratedWordAddedEvent: ['id', 'categoryId'],
  ModeratedWordDeletedEvent: ['id', 'categoryId'],
  CategoryModeratorAssignedEvent: ['categoryId', 'userId', 'operatorId'],
  CategoryModeratorRemovedEvent: ['categoryId', 'userId', 'operatorId'],
  CategoryCreatedEvent: ['categoryId', 'operatorId'],
  CategoryUpdatedEvent: ['categoryId', 'operatorId'],
  CategoryDeletedEvent: ['categoryId', 'operatorId'],
  UserPromotedEvent: ['targetUserId', 'newLevel', 'operatorId'],
  UserStatusChangedEvent: ['targetUserId', 'operatorId'],
  UserRoleChangedEvent: ['targetUserId', 'operatorId'],
  UserDeletedEvent: ['targetUserId', 'operatorId'],
  TestAccountCreatedEvent: ['targetUserId', 'operatorId'],
  ReportResolvedEvent: ['reportId', 'reporterId', 'handlerId'],
}

function toPayload(event: IDomainEvent, names: readonly string[]): Record<string, unknown> {
  const source = event as unknown as Record<string, unknown>
  const payload: Record<string, unknown> = {}
  // Fixed order makes IDs identical for class instances and reordered JSON stream records.
  for (const name of names) {
    const value = source[name]
    if (name === 'expiresAt') {
      const date = value instanceof Date ? value : new Date(typeof value === 'string' ? value : NaN)
      if (Number.isFinite(date.getTime())) payload[name] = date.toISOString()
    } else if (name === 'isSystem') {
      if (typeof value === 'boolean') payload[name] = value
    } else if (name === 'newLevel') {
      if (typeof value === 'number' && Number.isSafeInteger(value)) payload[name] = value
    } else if (value === null && (name === 'commentId' || name === 'categoryId')) {
      payload[name] = null
    } else if (typeof value === 'string' && value.length <= 128) {
      payload[name] = value
    }
  }
  return payload
}

const definitions = new Map<string, PluginEventDefinition>(Object.entries(fields).map(([name, names]) => [
  name, Object.freeze({ name, version: 1, toPayload: (event: IDomainEvent) => toPayload(event, names) }),
]))

export function getPluginEventDefinition(eventName: string): PluginEventDefinition | undefined {
  return definitions.get(eventName)
}

export function pluginEventId(event: IDomainEvent): string {
  const raw = JSON.stringify({ eventName: event.eventName, occurredOn: event.occurredOn.toISOString(), payload: getPluginEventDefinition(event.eventName)?.toPayload(event) })
  return createHash('sha256').update(raw).digest('hex')
}

export function createPluginEventEnvelope(event: IDomainEvent, definition = getPluginEventDefinition(event.eventName)): PluginEventEnvelope | null {
  // An optional definition cannot bypass the catalog allowlist.
  if (!definition || definition !== getPluginEventDefinition(event.eventName)) return null
  if (!(event.occurredOn instanceof Date) || !Number.isFinite(event.occurredOn.getTime())) {
    throw new Error('ERR_PLUGIN_EVENT_INVALID_DATE')
  }
  const eventId = pluginEventId(event)
  return {
    eventId,
    eventName: definition.name,
    schemaVersion: definition.version,
    occurredAt: event.occurredOn.toISOString(),
    idempotencyKey: `${definition.name}:${eventId}`,
    payload: definition.toPayload(event),
  }
}