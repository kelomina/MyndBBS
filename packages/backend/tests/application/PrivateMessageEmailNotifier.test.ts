import { PrivateMessageEmailNotifier } from '../../src/application/notification/PrivateMessageEmailNotifier';
import { PrivateMessageSentEvent } from '../../src/domain/shared/events/DomainEvents';

describe('PrivateMessageEmailNotifier', () => {
  it('sends an unread-message email when the receiver opted in', async () => {
    const handlers = new Map<string, (event: PrivateMessageSentEvent) => Promise<void>>();
    const emailSender = { sendEmail: jest.fn().mockResolvedValue(undefined) };
    const userDeliveryInfo = {
      getDeliveryInfo: jest.fn().mockResolvedValue({
        email: 'receiver@example.test',
        emailNotificationsEnabled: true,
      }),
    };
    const eventBus = {
      subscribe: jest.fn((name, handler) => handlers.set(name, handler)),
    };

    new PrivateMessageEmailNotifier({
      emailSender,
      userDeliveryInfo,
      frontendUrl: 'https://kolobbs.kolostudio.fun/',
    }).register(eventBus);

    await handlers.get('PrivateMessageSentEvent')!(
      new PrivateMessageSentEvent('message-1', 'sender-1', 'receiver-1', false),
    );

    expect(userDeliveryInfo.getDeliveryInfo).toHaveBeenCalledWith('receiver-1');
    expect(emailSender.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'receiver@example.test',
        subject: '[MyndBBS] You have a new unread private message',
        textBody: expect.stringContaining('https://kolobbs.kolostudio.fun/messages'),
      }),
    );
  });

  it('does not send for opted-out or system messages', async () => {
    const handlers = new Map<string, (event: PrivateMessageSentEvent) => Promise<void>>();
    const emailSender = { sendEmail: jest.fn().mockResolvedValue(undefined) };
    const userDeliveryInfo = {
      getDeliveryInfo: jest.fn().mockResolvedValue({
        email: 'receiver@example.test',
        emailNotificationsEnabled: false,
      }),
    };
    const eventBus = {
      subscribe: jest.fn((name, handler) => handlers.set(name, handler)),
    };
    new PrivateMessageEmailNotifier({ emailSender, userDeliveryInfo }).register(eventBus);
    const handler = handlers.get('PrivateMessageSentEvent')!;

    await handler(new PrivateMessageSentEvent('message-1', 'sender-1', 'receiver-1', false));
    await handler(new PrivateMessageSentEvent('message-2', 'system', 'receiver-1', true));

    expect(emailSender.sendEmail).not.toHaveBeenCalled();
  });
});
