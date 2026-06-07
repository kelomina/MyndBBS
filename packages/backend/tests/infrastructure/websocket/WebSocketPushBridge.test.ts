const subscribe = jest.fn();
const pushToUser = jest.fn();
const publish = jest.fn();
const quit = jest.fn();

jest.mock('../../../src/infrastructure/events/EventBusFactory', () => ({
  getEventBus: () => ({ subscribe }),
}));

jest.mock('../../../src/infrastructure/websocket/WebSocketServer', () => ({
  wsConnectionManager: { pushToUser },
}));

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({ publish, quit }));
});

describe('WebSocketPushBridge', () => {
  const originalRedisUrl = process.env.REDIS_URL;

  beforeEach(() => {
    jest.resetModules();
    subscribe.mockReset();
    pushToUser.mockReset();
    publish.mockReset();
    quit.mockReset();
    delete process.env.REDIS_URL;
  });

  afterEach(() => {
    if (originalRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = originalRedisUrl;
    }
  });

  it('pushes PrivateMessageSentEvent to the receiver as new_message', async () => {
    const { bootstrapWebSocketPushBridge } = await import('../../../src/infrastructure/websocket/WebSocketPushBridge');

    bootstrapWebSocketPushBridge();

    const handler = subscribe.mock.calls.find((call) => call[0] === 'PrivateMessageSentEvent')?.[1];
    expect(handler).toBeDefined();

    await handler({
      eventName: 'PrivateMessageSentEvent',
      messageId: 'msg-1',
      senderId: 'user-1',
      receiverId: 'user-2',
      isSystem: false,
      occurredOn: new Date(),
    });

    expect(pushToUser).toHaveBeenCalledWith('user-2', {
      type: 'new_message',
      data: {
        eventName: 'PrivateMessageSentEvent',
        messageId: 'msg-1',
        senderId: 'user-1',
        isSystem: false,
      },
    });
  });

  it('uses Redis Pub/Sub when REDIS_URL is configured', async () => {
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    const { bootstrapWebSocketPushBridge } = await import('../../../src/infrastructure/websocket/WebSocketPushBridge');

    bootstrapWebSocketPushBridge();
    const handler = subscribe.mock.calls.find((call) => call[0] === 'PrivateMessageSentEvent')?.[1];

    await handler({
      eventName: 'PrivateMessageSentEvent',
      messageId: 'msg-2',
      senderId: 'user-1',
      receiverId: 'user-3',
      isSystem: true,
      occurredOn: new Date(),
    });

    expect(publish).toHaveBeenCalledWith(
      'myndbbs:ws-push:user-3',
      JSON.stringify({
        type: 'new_message',
        data: {
          eventName: 'PrivateMessageSentEvent',
          messageId: 'msg-2',
          senderId: 'user-1',
          isSystem: true,
        },
      }),
    );
    expect(pushToUser).not.toHaveBeenCalled();
  });

  it('closes its Redis publisher on shutdown', async () => {
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    const { bootstrapWebSocketPushBridge, shutdownWebSocketPushBridge } = await import('../../../src/infrastructure/websocket/WebSocketPushBridge');

    bootstrapWebSocketPushBridge();
    const handler = subscribe.mock.calls.find((call) => call[0] === 'PrivateMessageSentEvent')?.[1];

    await handler({
      eventName: 'PrivateMessageSentEvent',
      messageId: 'msg-3',
      senderId: 'user-1',
      receiverId: 'user-4',
      isSystem: false,
      occurredOn: new Date(),
    });
    await shutdownWebSocketPushBridge();

    expect(quit).toHaveBeenCalledTimes(1);
  });
});
