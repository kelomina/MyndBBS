const xadd = jest.fn();
const xtrim = jest.fn();
const xgroup = jest.fn();

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    xadd,
    xtrim,
    xgroup,
    quit: jest.fn(),
  }));
});

describe('RedisStreamsEventBus', () => {
  const originalRedisUrl = process.env.REDIS_URL;

  beforeEach(() => {
    jest.resetModules();
    xadd.mockReset().mockResolvedValue('1-0');
    xtrim.mockReset().mockResolvedValue(1);
    xgroup.mockReset().mockResolvedValue('OK');
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
  });

  afterEach(() => {
    if (originalRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = originalRedisUrl;
    }
  });

  it('publishes to Redis Streams and immediately dispatches local subscribers', async () => {
    const { RedisStreamsEventBus } = await import('../../../src/infrastructure/events/RedisStreamsEventBus');
    const eventBus = new RedisStreamsEventBus();
    const handler = jest.fn();

    eventBus.subscribe('PrivateMessageSentEvent', handler);
    await eventBus.publish({
      eventName: 'PrivateMessageSentEvent',
      occurredOn: new Date(),
      messageId: 'msg-1',
      senderId: 'user-1',
      receiverId: 'user-2',
      isSystem: false,
    } as any);

    expect(xadd).toHaveBeenCalled();
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      eventName: 'PrivateMessageSentEvent',
      receiverId: 'user-2',
    }));
  });
});
