import * as Events from '../src/domain/shared/events/DomainEvents'
import { createPluginEventEnvelope, getPluginEventDefinition } from '../src/infrastructure/plugins/PluginEventCatalog'

describe('PluginEventCatalog', () => {
  test('only exposes registered events and strips sensitive fields', () => {
    const event = {
      eventName: 'PostApprovedEvent',
      occurredOn: new Date('2026-10-02T00:00:00.000Z'),
      postId: 'p1',
      token: 'secret',
      nested: { password: 'hidden', title: 'ok' },
    }
    expect(getPluginEventDefinition(event.eventName)).toBeDefined()
    expect(createPluginEventEnvelope(event)).toMatchObject({
      eventName: 'PostApprovedEvent',
      schemaVersion: 1,
      occurredAt: '2026-10-02T00:00:00.000Z',
      idempotencyKey: expect.stringContaining('PostApprovedEvent:'),
      payload: { postId: 'p1' },
    })
    expect(createPluginEventEnvelope(event)?.payload).toEqual({ postId: 'p1' })
    expect(createPluginEventEnvelope({ eventName: 'UnregisteredEvent', occurredOn: new Date() })).toBeNull()
  })
  test('class instances and reordered Redis JSON have identical IDs and sanitized DTOs', () => {
    const event = new Events.MessageExpiredEvent('m1', 'u1', new Date('2026-10-03T00:00:00Z'))
    event.occurredOn.setTime(Date.parse('2026-10-02T00:00:00Z'))
    const reordered = { receiverId: 'u1', expiresAt: '2026-10-03T00:00:00.000Z', messageId: 'm1',
      occurredOn: event.occurredOn, eventName: event.eventName, password: 'never exposed' }
    expect(createPluginEventEnvelope(event)).toEqual(createPluginEventEnvelope(reordered))
    expect(createPluginEventEnvelope(event)?.payload).toEqual({ messageId: 'm1', receiverId: 'u1', expiresAt: '2026-10-03T00:00:00.000Z' })
  })

  test('rejects injected catalog definitions and invalid dates', () => {
    const event = new Events.PostApprovedEvent('p', 'u', 'private draft title')
    expect(createPluginEventEnvelope(event, { name: event.eventName, version: 1, toPayload: () => ({ secret: 'leak' }) })).toBeNull()
    expect(() => createPluginEventEnvelope({ ...event, occurredOn: new Date('invalid') })).toThrow('ERR_PLUGIN_EVENT_INVALID_DATE')
  })

  test('maps all 21 real domain event classes without private/free-text extensions', () => {
    const events = [
      new Events.PostApprovedEvent('p', 'u', 'SECRET'),
      new Events.PostRejectedEvent('p', 'u', 'SECRET', 'SECRET'),
      new Events.PostRepliedEvent('p', 'u', 'SECRET', 'r', 'c'),
      new Events.CommentRepliedEvent('c', 'u', 'p', 'r', 'child'),
      new Events.MentionedEvent('u', 'p', null, 'r'),
      new Events.PrivateMessageSentEvent('m', 's', 'r', false),
      new Events.MessageRemovedEvent('m', 'u', 'p', 'deleted'),
      new Events.MessageExpiredEvent('m', 'u', new Date('2026-10-03T00:00:00Z')),
      new Events.ModeratedWordAddedEvent('w', 'SECRET', null),
      new Events.ModeratedWordDeletedEvent('w', 'SECRET', 'c'),
      new Events.CategoryModeratorAssignedEvent('c', 'u', 'op'),
      new Events.CategoryModeratorRemovedEvent('c', 'u', 'op'),
      new Events.CategoryCreatedEvent('c', 'op'),
      new Events.CategoryUpdatedEvent('c', 'op'),
      new Events.CategoryDeletedEvent('c', 'op'),
      new Events.UserPromotedEvent('u', 3, 'op'),
      new Events.UserStatusChangedEvent('u', 'SECRET', 'op'),
      new Events.UserRoleChangedEvent('u', 'SECRET', 'op'),
      new Events.UserDeletedEvent('u', 'op'),
      new Events.TestAccountCreatedEvent('u', 'op'),
      new Events.ReportResolvedEvent('r', 'u', 'op'),
    ]
    expect(events).toHaveLength(21)
    for (const event of events) {
      const envelope = createPluginEventEnvelope(Object.assign(event, { email: 'SECRET', ip: 'SECRET', content: 'SECRET', nested: { safeName: 'SECRET' } }))
      expect(envelope?.schemaVersion).toBe(1)
      expect(JSON.stringify(envelope)).not.toContain('SECRET')
      const json = JSON.parse(JSON.stringify(event))
      expect(createPluginEventEnvelope({ ...json, occurredOn: new Date(json.occurredOn) })).toEqual(envelope)
    }
  })

})
