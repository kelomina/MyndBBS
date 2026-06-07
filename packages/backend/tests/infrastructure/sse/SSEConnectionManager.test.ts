const subscribe = jest.fn();

jest.mock('../../../src/infrastructure/events/EventBusFactory', () => ({
  getEventBus: () => ({ subscribe }),
}));

describe('SSEConnectionManager', () => {
  beforeEach(() => {
    jest.resetModules();
    subscribe.mockReset();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('maps PrivateMessageSentEvent to new_message and targets receiverId', async () => {
    const { SSEConnectionManager } = await import('../../../src/infrastructure/sse/SSEConnectionManager');
    const manager = new SSEConnectionManager();
    const writes: string[] = [];
    const response = {
      writeHead: jest.fn(),
      write: jest.fn((chunk: string) => {
        writes.push(chunk);
      }),
      on: jest.fn(),
      writableEnded: false,
      socket: { remotePort: 12345 },
      end: jest.fn(),
    };

    manager.registerConnection('user-2', response as any);

    const handler = [...subscribe.mock.calls].reverse().find((call) => call[0] === 'PrivateMessageSentEvent')?.[1];
    expect(handler).toBeDefined();

    handler({
      eventName: 'PrivateMessageSentEvent',
      messageId: 'msg-1',
      senderId: 'user-1',
      receiverId: 'user-2',
      isSystem: false,
      occurredOn: new Date(),
    });

    expect(writes.some((chunk) => chunk.includes('event: new_message'))).toBe(true);
    expect(writes.some((chunk) => chunk.includes('"messageId":"msg-1"'))).toBe(true);

    manager.shutdown();
  });
});
