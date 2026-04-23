import { UserApplicationService } from '../src/application/identity/UserApplicationService';
import { IUserRepository } from '../src/domain/identity/IUserRepository';
import { IUnitOfWork } from '../src/domain/shared/IUnitOfWork';
import { UserStatus } from '@myndbbs/shared';
import { User, UserProps } from '../src/domain/identity/User';

describe('UserApplicationService - Cookie Preferences', () => {
  let userApplicationService: UserApplicationService;
  let mockUserRepository: jest.Mocked<IUserRepository>;
  let mockUnitOfWork: jest.Mocked<IUnitOfWork>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUserRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByUsername: jest.fn(),
      findByRoleId: jest.fn(),
      save: jest.fn(),
    };

    mockUnitOfWork = {
      execute: jest.fn().mockImplementation(async (work) => await work()),
    };

    userApplicationService = new UserApplicationService(
      mockUserRepository,
      {} as any, // passkeyRepository
      {} as any, // abilityCache
      {} as any, // passwordHasher
      {} as any, // totpPort
      mockUnitOfWork
    );
  });

  it('should update cookie preferences successfully', async () => {
    const userProps: UserProps = {
      id: 'user-1',
      email: 'test@example.com',
      username: 'testuser',
      password: 'hashedpassword',
      roleId: 'role-1',
      status: UserStatus.ACTIVE,
      level: 1,
      isPasskeyMandatory: false,
      totpSecret: null,
      isTotpEnabled: false,
      cookiePreferences: null,
      createdAt: new Date(),
    };
    
    const user = User.create(userProps);

    mockUserRepository.findById.mockResolvedValue(user);

    await userApplicationService.updateCookiePreferences('user-1', { analytics: true });

    expect(mockUserRepository.findById).toHaveBeenCalledWith('user-1');
    expect(mockUserRepository.save).toHaveBeenCalledWith(user);
    expect(user.cookiePreferences).toEqual({ analytics: true });
  });

  it('should throw an error if user is not found', async () => {
    mockUserRepository.findById.mockResolvedValue(null);

    await expect(userApplicationService.updateCookiePreferences('unknown-user', { analytics: true }))
      .rejects.toThrow('ERR_USER_NOT_FOUND');
  });
});
