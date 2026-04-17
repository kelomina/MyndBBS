import { AdminUserManagementApplicationService } from '../../src/application/identity/AdminUserManagementApplicationService';
import { IUserRepository } from '../../src/domain/identity/IUserRepository';
import { AuditApplicationService } from '../../src/application/system/AuditApplicationService';

describe('AdminUserManagementApplicationService', () => {
  it('should automatically log audit when changing user role', async () => {
    const mockUserRepo = { 
      findById: jest.fn().mockResolvedValue({ 
        roleId: 'oldRole',
        changeRole: jest.fn() 
      }), 
      save: jest.fn() 
    } as unknown as IUserRepository;
    
    const mockRoleRepo = {
      findById: jest.fn().mockResolvedValue({ name: 'USER' }),
      findByName: jest.fn().mockResolvedValue({ id: 'newRole' })
    };
    
    const mockAuditService = { logAudit: jest.fn() } as unknown as AuditApplicationService;
    
    const mockRolePolicy = {
      assertRoleName: jest.fn(),
      isAtLeast: jest.fn().mockReturnValue(false),
      compare: jest.fn().mockReturnValue(-1)
    };
    
    const mockSessionRepo = {
      findByUserId: jest.fn().mockResolvedValue([]),
      deleteManyByUserId: jest.fn().mockResolvedValue(undefined)
    };
    
    const mockSessionCache = {
      markSessionRequiresRefresh: jest.fn()
    };

    const service = new AdminUserManagementApplicationService(
      mockUserRepo, 
      mockRoleRepo as any, 
      null as any, // passkeyRepository
      mockSessionRepo as any, 
      mockSessionCache as any, 
      mockRolePolicy as any,
      mockAuditService as any
    );

    await service.changeUserRole({ userId: 'operator1', role: 'ADMIN' as any }, 'target1', 'MODERATOR' as any);
    expect(mockAuditService.logAudit).toHaveBeenCalledWith('operator1', 'UPDATE_USER_ROLE', 'User:target1 to MODERATOR');
  });
});
