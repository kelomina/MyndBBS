import { AdminUserManagementApplicationService } from '../../src/application/identity/AdminUserManagementApplicationService';
import { IUserRepository } from '../../src/domain/identity/IUserRepository';
import { IEventBus } from '../../src/domain/shared/events/IEventBus';
import { UserStatus } from '@myndbbs/shared';

describe('AdminUserManagementApplicationService', () => {
  it('should throw ERR_LEVEL_MUST_BE_BETWEEN_1_AND_6 if level is invalid', async () => {
    const service = new AdminUserManagementApplicationService(
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any
    );
    await expect(service.changeUserLevel({ userId: 'operator1', role: 'ADMIN' as any }, 'target1', 0)).rejects.toThrow('ERR_LEVEL_MUST_BE_BETWEEN_1_AND_6');
    await expect(service.changeUserLevel({ userId: 'operator1', role: 'ADMIN' as any }, 'target1', 7)).rejects.toThrow('ERR_LEVEL_MUST_BE_BETWEEN_1_AND_6');
  });

  it('should throw ERR_INVALID_STATUS if status is invalid', async () => {
    const service = new AdminUserManagementApplicationService(
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any
    );
    await expect(service.changeUserStatus({ userId: 'operator1', role: 'ADMIN' as any }, 'target1', 'INVALID_STATUS' as any)).rejects.toThrow('ERR_INVALID_STATUS');
  });

  it('should throw ERR_INVALID_ROLE if role is invalid', async () => {
    const service = new AdminUserManagementApplicationService(
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any
    );
    await expect(service.changeUserRole({ userId: 'operator1', role: 'ADMIN' as any }, 'target1', 'INVALID_ROLE' as any)).rejects.toThrow('ERR_INVALID_ROLE');
  });

  it('should auto-disable root when another user gets SUPER_ADMIN', async () => {
    const mockRootUser = { id: 'rootId', username: 'root', status: UserStatus.ACTIVE, changeStatus: jest.fn() };
    const mockTargetUser = { id: 'target1', username: 'other', roleId: 'oldRole', changeRole: jest.fn() };
    
    const mockUserRepo = { 
      findById: jest.fn().mockImplementation((id) => id === 'target1' ? Promise.resolve(mockTargetUser) : Promise.resolve(mockRootUser)),
      findByUsername: jest.fn().mockImplementation((username) => username === 'root' ? Promise.resolve(mockRootUser) : Promise.resolve(null)),
      save: jest.fn() 
    } as unknown as IUserRepository;
    
    const mockRoleRepo = {
      findById: jest.fn().mockResolvedValue({ name: 'USER' }),
      findByName: jest.fn().mockResolvedValue({ id: 'newRole' })
    };
    
    const mockEventBus = { publish: jest.fn(), subscribe: jest.fn() } as unknown as IEventBus;
    
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
      markSessionRequiresRefresh: jest.fn(),
      revokeSession: jest.fn()
    };

    const service = new AdminUserManagementApplicationService(
      mockUserRepo, 
      mockRoleRepo as any, 
      null as any, // passkeyRepository
      mockSessionRepo as any, 
      mockSessionCache as any, 
      mockRolePolicy as any,
      mockEventBus as any
    );

    await service.changeUserRole({ userId: 'operator1', role: 'SUPER_ADMIN' as any }, 'target1', 'SUPER_ADMIN' as any);
    
    // verify root user was banned
    expect(mockUserRepo.findByUsername).toHaveBeenCalledWith('root');
    expect(mockRootUser.changeStatus).toHaveBeenCalledWith(UserStatus.BANNED);
    expect(mockUserRepo.save).toHaveBeenCalledWith(mockRootUser);
  });

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
    
    const mockEventBus = { publish: jest.fn(), subscribe: jest.fn() } as unknown as IEventBus;
    
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
      mockEventBus as any
    );

    await service.changeUserRole({ userId: 'operator1', role: 'ADMIN' as any }, 'target1', 'MODERATOR' as any);
    expect(mockEventBus.publish).toHaveBeenCalled();
  });

  it('should change user role and level in a single operation', async () => {
    const service = new AdminUserManagementApplicationService(
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any
    );
    service.changeUserLevel = jest.fn();
    service.changeUserRole = jest.fn();

    await service.changeUserRoleAndLevel({ userId: 'operator1', role: 'ADMIN' as any }, 'target1', { role: 'MODERATOR' as any, level: 3 });

    expect(service.changeUserLevel).toHaveBeenCalledWith({ userId: 'operator1', role: 'ADMIN' }, 'target1', 3);
    expect(service.changeUserRole).toHaveBeenCalledWith({ userId: 'operator1', role: 'ADMIN' }, 'target1', 'MODERATOR');
  });
});
