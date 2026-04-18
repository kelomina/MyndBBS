import { AuditEventListener } from '../../../../src/infrastructure/events/handlers/AuditEventListener';
import { IEventBus } from '../../../../src/domain/shared/events/IEventBus';
import { AuditApplicationService } from '../../../../src/application/system/AuditApplicationService';
import { CategoryCreatedEvent } from '../../../../src/domain/shared/events/DomainEvents';

describe('AuditEventListener', () => {
  it('should register handlers and call auditApplicationService.logAudit on events', async () => {
    const mockEventBus = {
      subscribe: jest.fn()
    } as unknown as IEventBus;

    const mockAuditApplicationService = {
      logAudit: jest.fn()
    } as unknown as AuditApplicationService;

    new AuditEventListener(mockEventBus, mockAuditApplicationService);

    expect(mockEventBus.subscribe).toHaveBeenCalledWith('CategoryCreatedEvent', expect.any(Function));

    // Simulate an event
    const subscribeCalls = (mockEventBus.subscribe as jest.Mock).mock.calls;
    const categoryCreatedHandler = subscribeCalls.find(call => call[0] === 'CategoryCreatedEvent')![1];

    await categoryCreatedHandler(new CategoryCreatedEvent('cat-1', 'op-1'));

    expect(mockAuditApplicationService.logAudit).toHaveBeenCalledWith('op-1', 'CREATE_CATEGORY', 'Category:cat-1');
  });
});
