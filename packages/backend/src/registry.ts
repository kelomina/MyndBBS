import { container, token, type ServiceToken } from './lib/container';
import type { IEventBus } from './domain/shared/events/IEventBus';
import type { IUnitOfWork } from './domain/shared/IUnitOfWork';
import type { IUserRepository } from './domain/identity/IUserRepository';
import type { IPasskeyRepository } from './domain/identity/IPasskeyRepository';
import type { IAbilityCache } from './domain/identity/IAbilityCache';
import type { IPasswordHasher } from './domain/identity/IPasswordHasher';
import type { ISessionRepository } from './domain/identity/ISessionRepository';
import type { IRoleRepository } from './domain/identity/IRoleRepository';
import type { IPermissionRepository } from './domain/identity/IPermissionRepository';
import type { IAuthChallengeRepository } from './domain/identity/IAuthChallengeRepository';
import type { ICaptchaChallengeRepository } from './domain/identity/ICaptchaChallengeRepository';
import type { IEmailRegistrationTicketRepository } from './domain/identity/IEmailRegistrationTicketRepository';
import type { IPasswordResetTicketRepository } from './domain/identity/IPasswordResetTicketRepository';
import type { IEmailSender } from './domain/identity/ports/IEmailSender';
import type { ITotpPort } from './domain/identity/ports/ITotpPort';
import type { IPasskeyPort } from './domain/identity/ports/IPasskeyPort';
import type { ITokenPort } from './domain/identity/ports/ITokenPort';
import type { ISessionCache } from './application/identity/ports/ISessionCache';
import type { ISudoStore } from './application/identity/ports/ISudoStore';
import type { IUserSecurityReadModel } from './application/identity/ports/IUserSecurityReadModel';
import type { ICategoryRepository } from './domain/community/ICategoryRepository';
import type { IPostRepository } from './domain/community/IPostRepository';
import type { ICommentRepository } from './domain/community/ICommentRepository';
import type { IEngagementRepository } from './domain/community/IEngagementRepository';
import type { IModeratedWordRepository } from './domain/community/IModeratedWordRepository';
import type { IModerationPolicy } from './domain/community/IModerationPolicy';
import type { IModeratedWordsCache } from './domain/community/IModeratedWordsCache';
import type { ICaptchaValidator } from './domain/community/ICaptchaValidator';
import type { IIdentityIntegrationPort as CommunityIdentityIntegrationPort } from './domain/community/IIdentityIntegrationPort';
import type { IFriendshipRepository } from './domain/messaging/IFriendshipRepository';
import type { IPrivateMessageRepository } from './domain/messaging/IPrivateMessageRepository';
import type { IUserKeyRepository } from './domain/messaging/IUserKeyRepository';
import type { IConversationSettingRepository } from './domain/messaging/IConversationSettingRepository';
import type { IIdentityIntegrationPort as MessagingIdentityIntegrationPort } from './domain/messaging/IIdentityIntegrationPort';
import type { INotificationRepository } from './domain/notification/INotificationRepository';
import type { IEmailTemplateRepository } from './domain/notification/IEmailTemplateRepository';
import type { IAuditLogRepository } from './domain/system/IAuditLogRepository';
import type { IRouteWhitelistRepository } from './domain/system/IRouteWhitelistRepository';
import type { IStoragePort } from './domain/system/ports/IStoragePort';
import type { IWikiRepository } from './domain/wiki/IWikiRepository';
import type { IWikiPageRepository } from './domain/wiki/IWikiPageRepository';
import type { IWikiCollaboratorRepository } from './domain/wiki/IWikiCollaboratorRepository';
import type { IEnvStore } from './domain/provisioning/IEnvStore';
import type { IDatabaseConnectionValidator } from './domain/provisioning/IDatabaseConnectionValidator';
import type { IDatabaseSchemaApplier } from './domain/provisioning/IDatabaseSchemaApplier';
import type { IInstallationSessionRepository } from './domain/provisioning/IInstallationSessionRepository';
import type { IIdentityBootstrapPort } from './domain/provisioning/IIdentityBootstrapPort';
import type { IRestartScheduler } from './domain/provisioning/IRestartScheduler';
import type { IModeratorReadModel } from './application/notification/ports/IModeratorReadModel';

import { UserApplicationService } from './application/identity/UserApplicationService';
import { AuthApplicationService } from './application/identity/AuthApplicationService';
import { OidcLoginService } from './application/identity/OidcLoginService';
import { SystemApplicationService } from './application/system/SystemApplicationService';
import { IdentityBootstrapApplicationService } from './application/identity/IdentityBootstrapApplicationService';
import { InstallationApplicationService } from './application/provisioning/InstallationApplicationService';
import { CommunityApplicationService } from './application/community/CommunityApplicationService';
import { MessagingApplicationService } from './application/messaging/MessagingApplicationService';
import { RoleApplicationService } from './application/identity/RoleApplicationService';
import { ModerationApplicationService } from './application/community/ModerationApplicationService';
import { AdminUserManagementApplicationService } from './application/identity/AdminUserManagementApplicationService';
import { SudoApplicationService } from './application/identity/SudoApplicationService';
import { AuditApplicationService } from './application/system/AuditApplicationService';
import { EmailConfigurationApplicationService } from './application/notification/EmailConfigurationApplicationService';
import { WikiApplicationService } from './application/wiki/WikiApplicationService';
import { WikiPageApplicationService } from './application/wiki/WikiPageApplicationService';

import { PrismaUserRepository } from './infrastructure/repositories/PrismaUserRepository';
import { PrismaCaptchaChallengeRepository } from './infrastructure/repositories/PrismaCaptchaChallengeRepository';
import { PrismaPasskeyRepository } from './infrastructure/repositories/PrismaPasskeyRepository';
import { PrismaSessionRepository } from './infrastructure/repositories/PrismaSessionRepository';
import { PrismaAuthChallengeRepository } from './infrastructure/repositories/PrismaAuthChallengeRepository';
import { PrismaRoleRepository } from './infrastructure/repositories/PrismaRoleRepository';
import { PrismaRouteWhitelistRepository } from './infrastructure/repositories/PrismaRouteWhitelistRepository';
import { RedisEmailRegistrationTicketRepository } from './infrastructure/repositories/RedisEmailRegistrationTicketRepository';
import { RedisPasswordResetTicketRepository } from './infrastructure/repositories/RedisPasswordResetTicketRepository';
import { InMemoryInstallationSessionRepository } from './infrastructure/repositories/InMemoryInstallationSessionRepository';
import { PrismaCategoryRepository } from './infrastructure/repositories/PrismaCategoryRepository';
import { PrismaPostRepository } from './infrastructure/repositories/PrismaPostRepository';
import { PrismaCommentRepository } from './infrastructure/repositories/PrismaCommentRepository';
import { PrismaEngagementRepository } from './infrastructure/repositories/PrismaEngagementRepository';
import { PrismaFriendshipRepository } from './infrastructure/repositories/PrismaFriendshipRepository';
import { PrismaPrivateMessageRepository } from './infrastructure/repositories/PrismaPrivateMessageRepository';
import { PrismaUserKeyRepository } from './infrastructure/repositories/PrismaUserKeyRepository';
import { PrismaConversationSettingRepository } from './infrastructure/repositories/PrismaConversationSettingRepository';
import { PrismaPermissionRepository } from './infrastructure/repositories/PrismaPermissionRepository';
import { PrismaModeratedWordRepository } from './infrastructure/repositories/PrismaModeratedWordRepository';
import { PrismaUnitOfWork } from './infrastructure/repositories/PrismaUnitOfWork';
import { PrismaAuditLogRepository } from './infrastructure/repositories/PrismaAuditLogRepository';
import { PrismaEmailTemplateRepository } from './infrastructure/repositories/PrismaEmailTemplateRepository';
import { PrismaWikiRepository } from './infrastructure/repositories/PrismaWikiRepository';
import { PrismaWikiPageRepository } from './infrastructure/repositories/PrismaWikiPageRepository';
import { PrismaWikiCollaboratorRepository } from './infrastructure/repositories/PrismaWikiCollaboratorRepository';

import { Argon2PasswordHasher } from './infrastructure/services/Argon2PasswordHasher';
import { EnvStoreAdapter } from './infrastructure/services/provisioning/EnvStoreAdapter';
import { PrismaDatabaseConnectionValidator } from './infrastructure/services/provisioning/PrismaDatabaseConnectionValidator';
import { PrismaDatabaseSchemaApplier } from './infrastructure/services/provisioning/PrismaDatabaseSchemaApplier';
import { ProcessExitRestartScheduler } from './infrastructure/services/provisioning/ProcessExitRestartScheduler';
import { IdentityBootstrapServiceAdapter } from './infrastructure/services/provisioning/IdentityBootstrapServiceAdapter';
import { RedisModeratedWordsCache } from './infrastructure/services/RedisModeratedWordsCache';
import { RedisSessionCache } from './infrastructure/services/RedisSessionCache';
import { RedisAbilityCache } from './infrastructure/services/RedisAbilityCache';
import { RedisSudoStore } from './infrastructure/services/RedisSudoStore';
import { TotpAdapter } from './infrastructure/services/identity/TotpAdapter';
import { TotpEncryptionService } from './infrastructure/services/identity/TotpEncryptionService';
import { PasskeyAdapter } from './infrastructure/services/identity/PasskeyAdapter';
import { SmtpEmailSender } from './infrastructure/services/identity/SmtpEmailSender';
import { QueuedEmailSender } from './infrastructure/services/identity/QueuedEmailSender';
import { TokenAdapter } from './infrastructure/services/identity/TokenAdapter';
import { LocalFileStorageAdapter } from './infrastructure/services/system/LocalFileStorageAdapter';
import { IdentityIntegrationPort } from './infrastructure/services/IdentityIntegrationPort';
import { PrismaUserSecurityReadModel } from './infrastructure/queries/PrismaUserSecurityReadModel';

import { ModerationPolicy } from './domain/community/ModerationPolicy';
import { RoleHierarchyPolicy } from './application/identity/policies/RoleHierarchyPolicy';
import { getEventBus } from './infrastructure/events/EventBusFactory';
import { ModerationCacheInvalidationHandler } from './infrastructure/events/handlers/ModerationCacheInvalidationHandler';
import { AbilityCacheInvalidationHandler } from './infrastructure/events/handlers/AbilityCacheInvalidationHandler';
import { AuditEventListener } from './infrastructure/events/handlers/AuditEventListener';
import { identityQueryService } from './queries/identity/IdentityQueryService';

const globalEventBus = getEventBus();

const T = {
  IEventBus: token<IEventBus>('IEventBus'),
  IUnitOfWork: token<IUnitOfWork>('IUnitOfWork'),
  IUserRepository: token<IUserRepository>('IUserRepository'),
  IPasskeyRepository: token<IPasskeyRepository>('IPasskeyRepository'),
  IAbilityCache: token<IAbilityCache>('IAbilityCache'),
  IPasswordHasher: token<IPasswordHasher>('IPasswordHasher'),
  ISessionRepository: token<ISessionRepository>('ISessionRepository'),
  IRoleRepository: token<IRoleRepository>('IRoleRepository'),
  IPermissionRepository: token<IPermissionRepository>('IPermissionRepository'),
  IAuthChallengeRepository: token<IAuthChallengeRepository>('IAuthChallengeRepository'),
  ICaptchaChallengeRepository: token<ICaptchaChallengeRepository>('ICaptchaChallengeRepository'),
  IEmailRegistrationTicketRepository: token<IEmailRegistrationTicketRepository>('IEmailRegistrationTicketRepository'),
  IPasswordResetTicketRepository: token<IPasswordResetTicketRepository>('IPasswordResetTicketRepository'),
  IEmailSender: token<IEmailSender>('IEmailSender'),
  ITotpPort: token<ITotpPort>('ITotpPort'),
  IPasskeyPort: token<IPasskeyPort>('IPasskeyPort'),
  ITokenPort: token<ITokenPort>('ITokenPort'),
  ISessionCache: token<ISessionCache>('ISessionCache'),
  ISudoStore: token<ISudoStore>('ISudoStore'),
  IUserSecurityReadModel: token<IUserSecurityReadModel>('IUserSecurityReadModel'),
  ICategoryRepository: token<ICategoryRepository>('ICategoryRepository'),
  IPostRepository: token<IPostRepository>('IPostRepository'),
  ICommentRepository: token<ICommentRepository>('ICommentRepository'),
  IEngagementRepository: token<IEngagementRepository>('IEngagementRepository'),
  IModeratedWordRepository: token<IModeratedWordRepository>('IModeratedWordRepository'),
  IModerationPolicy: token<IModerationPolicy>('IModerationPolicy'),
  IModeratedWordsCache: token<IModeratedWordsCache>('IModeratedWordsCache'),
  ICaptchaValidator: token<ICaptchaValidator>('ICaptchaValidator'),
  CommunityIdentityIntegrationPort: token<CommunityIdentityIntegrationPort>('CommunityIdentityIntegrationPort'),
  IFriendshipRepository: token<IFriendshipRepository>('IFriendshipRepository'),
  IPrivateMessageRepository: token<IPrivateMessageRepository>('IPrivateMessageRepository'),
  IUserKeyRepository: token<IUserKeyRepository>('IUserKeyRepository'),
  IConversationSettingRepository: token<IConversationSettingRepository>('IConversationSettingRepository'),
  MessagingIdentityIntegrationPort: token<MessagingIdentityIntegrationPort>('MessagingIdentityIntegrationPort'),
  IEmailTemplateRepository: token<IEmailTemplateRepository>('IEmailTemplateRepository'),
  IAuditLogRepository: token<IAuditLogRepository>('IAuditLogRepository'),
  IRouteWhitelistRepository: token<IRouteWhitelistRepository>('IRouteWhitelistRepository'),
  IStoragePort: token<IStoragePort>('IStoragePort'),
  IWikiRepository: token<IWikiRepository>('IWikiRepository'),
  IWikiPageRepository: token<IWikiPageRepository>('IWikiPageRepository'),
  IWikiCollaboratorRepository: token<IWikiCollaboratorRepository>('IWikiCollaboratorRepository'),
  IEnvStore: token<IEnvStore>('IEnvStore'),
  IDatabaseConnectionValidator: token<IDatabaseConnectionValidator>('IDatabaseConnectionValidator'),
  IDatabaseSchemaApplier: token<IDatabaseSchemaApplier>('IDatabaseSchemaApplier'),
  IInstallationSessionRepository: token<IInstallationSessionRepository>('IInstallationSessionRepository'),
  IIdentityBootstrapPort: token<IIdentityBootstrapPort>('IIdentityBootstrapPort'),
  IRestartScheduler: token<IRestartScheduler>('IRestartScheduler'),
  RoleHierarchyPolicy: token<RoleHierarchyPolicy>('RoleHierarchyPolicy'),
  TotpEncryptionService: token<TotpEncryptionService>('TotpEncryptionService'),
} as const;

function registerServices(): void {
  container.registerSingleton(T.IEventBus, () => globalEventBus);
  container.registerSingleton(T.IUnitOfWork, () => new PrismaUnitOfWork());
  container.registerSingleton(T.TotpEncryptionService, () => new TotpEncryptionService());

  container.register(T.IUserRepository, () => new PrismaUserRepository(container.resolve(T.TotpEncryptionService)));
  container.register(T.IPasskeyRepository, () => new PrismaPasskeyRepository());
  container.registerSingleton(T.IAbilityCache, () => new RedisAbilityCache());
  container.register(T.IPasswordHasher, () => new Argon2PasswordHasher());
  container.register(T.ISessionRepository, () => new PrismaSessionRepository());
  container.register(T.IRoleRepository, () => new PrismaRoleRepository());
  container.register(T.IPermissionRepository, () => new PrismaPermissionRepository());
  container.register(T.IAuthChallengeRepository, () => new PrismaAuthChallengeRepository());
  container.register(T.ICaptchaChallengeRepository, () => new PrismaCaptchaChallengeRepository());
  container.register(T.IEmailRegistrationTicketRepository, () => new RedisEmailRegistrationTicketRepository());
  container.register(T.IPasswordResetTicketRepository, () => new RedisPasswordResetTicketRepository());
  container.register(T.IEmailSender, () => new QueuedEmailSender(new SmtpEmailSender()));
  container.register(T.ITotpPort, () => new TotpAdapter());
  container.register(T.IPasskeyPort, () => new PasskeyAdapter());
  container.register(T.ITokenPort, () => new TokenAdapter());
  container.registerSingleton(T.ISessionCache, () => new RedisSessionCache(container.resolve(T.TotpEncryptionService)));
  container.register(T.ISudoStore, () => new RedisSudoStore());
  container.register(T.IUserSecurityReadModel, () => new PrismaUserSecurityReadModel(container.resolve(T.TotpEncryptionService)));
  container.register(T.RoleHierarchyPolicy, () => new RoleHierarchyPolicy());

  container.register(T.ICategoryRepository, () => new PrismaCategoryRepository());
  container.register(T.IPostRepository, () => new PrismaPostRepository());
  container.register(T.ICommentRepository, () => new PrismaCommentRepository());
  container.register(T.IEngagementRepository, () => new PrismaEngagementRepository());
  container.register(T.IModeratedWordRepository, () => new PrismaModeratedWordRepository());
  container.register(T.IModeratedWordsCache, () => new RedisModeratedWordsCache(new PrismaModeratedWordRepository()));
  container.register(T.IModerationPolicy, () => new ModerationPolicy(container.resolve(T.IModeratedWordsCache)));
  container.register(T.CommunityIdentityIntegrationPort, () => new IdentityIntegrationPort(identityQueryService));

  container.register(T.IFriendshipRepository, () => new PrismaFriendshipRepository());
  container.register(T.IPrivateMessageRepository, () => new PrismaPrivateMessageRepository());
  container.register(T.IUserKeyRepository, () => new PrismaUserKeyRepository());
  container.register(T.IConversationSettingRepository, () => new PrismaConversationSettingRepository());
  container.register(T.MessagingIdentityIntegrationPort, () => new IdentityIntegrationPort(identityQueryService));

  container.register(T.IEmailTemplateRepository, () => new PrismaEmailTemplateRepository());
  container.register(T.IAuditLogRepository, () => new PrismaAuditLogRepository());
  container.register(T.IRouteWhitelistRepository, () => new PrismaRouteWhitelistRepository());
  container.register(T.IStoragePort, () => new LocalFileStorageAdapter());

  container.register(T.IWikiRepository, () => new PrismaWikiRepository());
  container.register(T.IWikiPageRepository, () => new PrismaWikiPageRepository());
  container.register(T.IWikiCollaboratorRepository, () => new PrismaWikiCollaboratorRepository());

  container.register(T.IEnvStore, () => new EnvStoreAdapter());
  container.register(T.IDatabaseConnectionValidator, () => new PrismaDatabaseConnectionValidator());
  container.register(T.IDatabaseSchemaApplier, () => new PrismaDatabaseSchemaApplier());
  container.register(T.IInstallationSessionRepository, () => new InMemoryInstallationSessionRepository());
  container.register(T.IRestartScheduler, () => new ProcessExitRestartScheduler());
}

registerServices();

function validateRegistrations(): void {
  const requiredTokens: ServiceToken<unknown>[] = [
    T.IEventBus, T.IUnitOfWork, T.IUserRepository, T.IPasskeyRepository,
    T.IAbilityCache, T.IPasswordHasher, T.ISessionRepository, T.IRoleRepository,
    T.IPermissionRepository, T.IEmailSender, T.ITotpPort, T.IPasskeyPort,
    T.ITokenPort, T.ISessionCache, T.ISudoStore, T.IUserSecurityReadModel,
    T.ICategoryRepository, T.IPostRepository, T.ICommentRepository,
    T.IEngagementRepository, T.IModerationPolicy, T.IModeratedWordsCache,
    T.IFriendshipRepository, T.IPrivateMessageRepository, T.IUserKeyRepository,
    T.IConversationSettingRepository, T.IAuditLogRepository, T.IStoragePort,
    T.IWikiRepository, T.IWikiPageRepository, T.IWikiCollaboratorRepository,
  ];

  const missing: string[] = [];
  for (const t of requiredTokens) {
    if (!container.has(t)) {
      missing.push(t);
    }
  }

  if (missing.length > 0) {
    throw new Error(`[Registry] Missing service registrations: ${missing.join(', ')}`);
  }
}

validateRegistrations();

export const unitOfWork = container.resolve<IUnitOfWork>(T.IUnitOfWork);

export const redisAbilityCache = container.resolve<IAbilityCache>(T.IAbilityCache);
export const authCache = container.resolve<ISessionCache>(T.ISessionCache);

export const abilityCacheInvalidationHandler = new AbilityCacheInvalidationHandler(
  globalEventBus,
  redisAbilityCache,
);

export const userApplicationService = new UserApplicationService({
  userRepository: container.resolve(T.IUserRepository),
  passkeyRepository: container.resolve(T.IPasskeyRepository),
  abilityCache: container.resolve(T.IAbilityCache),
  passwordHasher: container.resolve(T.IPasswordHasher),
  totpPort: container.resolve(T.ITotpPort),
  unitOfWork: container.resolve(T.IUnitOfWork),
  storagePort: container.resolve(T.IStoragePort),
});

export const auditApplicationService = new AuditApplicationService({
  auditLogRepository: container.resolve(T.IAuditLogRepository),
  unitOfWork: container.resolve(T.IUnitOfWork),
});

export const auditEventListener = new AuditEventListener(
  globalEventBus,
  auditApplicationService,
);

export const adminUserManagementApplicationService = new AdminUserManagementApplicationService({
  userRepository: container.resolve(T.IUserRepository),
  roleRepository: container.resolve(T.IRoleRepository),
  passkeyRepository: container.resolve(T.IPasskeyRepository),
  sessionRepository: container.resolve(T.ISessionRepository),
  sessionCache: container.resolve(T.ISessionCache),
  passwordHasher: container.resolve(T.IPasswordHasher),
  roleHierarchyPolicy: container.resolve(T.RoleHierarchyPolicy),
  eventBus: container.resolve(T.IEventBus),
  unitOfWork: container.resolve(T.IUnitOfWork),
  abilityCache: container.resolve(T.IAbilityCache),
  emailRegistrationTicketRepository: container.resolve(T.IEmailRegistrationTicketRepository),
  passwordResetTicketRepository: container.resolve(T.IPasswordResetTicketRepository),
  storagePort: container.resolve(T.IStoragePort),
});

export const authApplicationService = new AuthApplicationService({
  captchaChallengeRepository: container.resolve(T.ICaptchaChallengeRepository),
  passkeyRepository: container.resolve(T.IPasskeyRepository),
  sessionRepository: container.resolve(T.ISessionRepository),
  authChallengeRepository: container.resolve(T.IAuthChallengeRepository),
  userRepository: container.resolve(T.IUserRepository),
  roleRepository: container.resolve(T.IRoleRepository),
  emailRegistrationTicketRepository: container.resolve(T.IEmailRegistrationTicketRepository),
  passwordResetTicketRepository: container.resolve(T.IPasswordResetTicketRepository),
  passwordHasher: container.resolve(T.IPasswordHasher),
  authCache: container.resolve(T.ISessionCache),
  totpPort: container.resolve(T.ITotpPort),
  passkeyPort: container.resolve(T.IPasskeyPort),
  tokenPort: container.resolve(T.ITokenPort),
  emailSender: container.resolve(T.IEmailSender),
  emailTemplateRepository: container.resolve(T.IEmailTemplateRepository),
  unitOfWork: container.resolve(T.IUnitOfWork),
});

export const oidcLoginService = new OidcLoginService({
  userRepository: container.resolve(T.IUserRepository),
  roleRepository: container.resolve(T.IRoleRepository),
});

export const sudoApplicationService = new SudoApplicationService({
  userSecurityReadModel: container.resolve(T.IUserSecurityReadModel),
  authApplicationService: authApplicationService,
  sudoStore: container.resolve(T.ISudoStore),
  getRpID: () => process.env.RP_ID || 'localhost',
  getOrigin: () => process.env.ORIGIN || `http://${process.env.RP_ID || 'localhost'}:3000`,
  totpPort: container.resolve(T.ITotpPort),
});

export const systemApplicationService = new SystemApplicationService({
  routeWhitelistRepository: container.resolve(T.IRouteWhitelistRepository),
  storagePort: container.resolve(T.IStoragePort),
  unitOfWork: container.resolve(T.IUnitOfWork),
});

export const identityBootstrapApplicationService = new IdentityBootstrapApplicationService({
  userRepository: container.resolve(T.IUserRepository),
  roleRepository: container.resolve(T.IRoleRepository),
  passwordHasher: container.resolve(T.IPasswordHasher),
  unitOfWork: container.resolve(T.IUnitOfWork),
});

export const identityBootstrapServiceAdapter = new IdentityBootstrapServiceAdapter(
  identityBootstrapApplicationService,
);

export const installationApplicationService = new InstallationApplicationService({
  envStore: container.resolve(T.IEnvStore),
  dbValidator: container.resolve(T.IDatabaseConnectionValidator),
  dbSchemaApplier: container.resolve(T.IDatabaseSchemaApplier),
  sessionRepository: container.resolve(T.IInstallationSessionRepository),
  identityBootstrap: identityBootstrapServiceAdapter,
  restartScheduler: container.resolve(T.IRestartScheduler),
  eventBus: container.resolve(T.IEventBus),
});

export const redisModeratedWordsCache = container.resolve<IModeratedWordsCache>(T.IModeratedWordsCache);
export const moderationPolicy = container.resolve<IModerationPolicy>(T.IModerationPolicy);

export const moderationCacheInvalidationHandler = new ModerationCacheInvalidationHandler(
  globalEventBus,
  moderationPolicy,
);

export const identityIntegrationPort = new IdentityIntegrationPort(identityQueryService);

export const communityApplicationService = new CommunityApplicationService({
  categoryRepository: container.resolve(T.ICategoryRepository),
  postRepository: container.resolve(T.IPostRepository),
  commentRepository: container.resolve(T.ICommentRepository),
  engagementRepository: container.resolve(T.IEngagementRepository),
  identityIntegrationPort: container.resolve(T.CommunityIdentityIntegrationPort),
  moderationPolicy: container.resolve(T.IModerationPolicy),
  captchaValidator: authApplicationService,
  eventBus: container.resolve(T.IEventBus),
  auditApplicationService: auditApplicationService,
  unitOfWork: container.resolve(T.IUnitOfWork),
});

export const messagingApplicationService = new MessagingApplicationService({
  friendshipRepository: container.resolve(T.IFriendshipRepository),
  privateMessageRepository: container.resolve(T.IPrivateMessageRepository),
  userKeyRepository: container.resolve(T.IUserKeyRepository),
  conversationSettingRepository: container.resolve(T.IConversationSettingRepository),
  identityIntegrationPort: container.resolve(T.MessagingIdentityIntegrationPort),
  unitOfWork: container.resolve(T.IUnitOfWork),
  eventBus: container.resolve(T.IEventBus),
});

export const roleApplicationService = new RoleApplicationService({
  roleRepository: container.resolve(T.IRoleRepository),
  permissionRepository: container.resolve(T.IPermissionRepository),
  userRepository: container.resolve(T.IUserRepository),
  abilityCache: container.resolve(T.IAbilityCache),
  unitOfWork: container.resolve(T.IUnitOfWork),
});

export const emailConfigurationApplicationService = new EmailConfigurationApplicationService({
  envStore: container.resolve(T.IEnvStore),
  emailTemplateRepository: container.resolve(T.IEmailTemplateRepository),
});

export const moderationApplicationService = new ModerationApplicationService({
  postRepository: container.resolve(T.IPostRepository),
  commentRepository: container.resolve(T.ICommentRepository),
  moderatedWordRepository: container.resolve(T.IModeratedWordRepository),
  eventBus: container.resolve(T.IEventBus),
  auditApplicationService: auditApplicationService,
  unitOfWork: container.resolve(T.IUnitOfWork),
});

export const wikiApplicationService = new WikiApplicationService({
  wikiRepository: container.resolve(T.IWikiRepository),
  collaboratorRepository: container.resolve(T.IWikiCollaboratorRepository),
});

export const wikiPageApplicationService = new WikiPageApplicationService({
  wikiRepository: container.resolve(T.IWikiRepository),
  pageRepository: container.resolve(T.IWikiPageRepository),
  collaboratorRepository: container.resolve(T.IWikiCollaboratorRepository),
});

export { container, T as TOKENS };
