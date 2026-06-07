import { token } from './container';
import type { IEventBus } from '../domain/shared/events/IEventBus';
import type { IUnitOfWork } from '../domain/shared/IUnitOfWork';
import type { IUserRepository } from '../domain/identity/IUserRepository';
import type { IPasskeyRepository } from '../domain/identity/IPasskeyRepository';
import type { IAbilityCache } from '../domain/identity/IAbilityCache';
import type { IPasswordHasher } from '../domain/identity/IPasswordHasher';
import type { ISessionRepository } from '../domain/identity/ISessionRepository';
import type { IRoleRepository } from '../domain/identity/IRoleRepository';
import type { IPermissionRepository } from '../domain/identity/IPermissionRepository';
import type { IAuthChallengeRepository } from '../domain/identity/IAuthChallengeRepository';
import type { ICaptchaChallengeRepository } from '../domain/identity/ICaptchaChallengeRepository';
import type { IEmailRegistrationTicketRepository } from '../domain/identity/IEmailRegistrationTicketRepository';
import type { IPasswordResetTicketRepository } from '../domain/identity/IPasswordResetTicketRepository';
import type { IEmailSender } from '../domain/identity/ports/IEmailSender';
import type { ITotpPort } from '../domain/identity/ports/ITotpPort';
import type { IPasskeyPort } from '../domain/identity/ports/IPasskeyPort';
import type { ITokenPort } from '../domain/identity/ports/ITokenPort';
import type { ISessionCache } from '../application/identity/ports/ISessionCache';
import type { ISudoStore } from '../application/identity/ports/ISudoStore';
import type { IUserSecurityReadModel } from '../application/identity/ports/IUserSecurityReadModel';
import type { ICategoryRepository } from '../domain/community/ICategoryRepository';
import type { IPostRepository } from '../domain/community/IPostRepository';
import type { ICommentRepository } from '../domain/community/ICommentRepository';
import type { IEngagementRepository } from '../domain/community/IEngagementRepository';
import type { IModeratedWordRepository } from '../domain/community/IModeratedWordRepository';
import type { IModerationPolicy } from '../domain/community/IModerationPolicy';
import type { IModeratedWordsCache } from '../domain/community/IModeratedWordsCache';
import type { ICaptchaValidator } from '../domain/community/ICaptchaValidator';
import type { IIdentityIntegrationPort as CommunityIdentityIntegrationPort } from '../domain/community/IIdentityIntegrationPort';
import type { IFriendshipRepository } from '../domain/messaging/IFriendshipRepository';
import type { IPrivateMessageRepository } from '../domain/messaging/IPrivateMessageRepository';
import type { IUserKeyRepository } from '../domain/messaging/IUserKeyRepository';
import type { IConversationSettingRepository } from '../domain/messaging/IConversationSettingRepository';
import type { IIdentityIntegrationPort as MessagingIdentityIntegrationPort } from '../domain/messaging/IIdentityIntegrationPort';
import type { INotificationRepository } from '../domain/notification/INotificationRepository';
import type { IEmailTemplateRepository } from '../domain/notification/IEmailTemplateRepository';
import type { IAuditLogRepository } from '../domain/system/IAuditLogRepository';
import type { IRouteWhitelistRepository } from '../domain/system/IRouteWhitelistRepository';
import type { IStoragePort } from '../domain/system/ports/IStoragePort';
import type { IWikiRepository } from '../domain/wiki/IWikiRepository';
import type { IWikiPageRepository } from '../domain/wiki/IWikiPageRepository';
import type { IWikiCollaboratorRepository } from '../domain/wiki/IWikiCollaboratorRepository';
import type { IEnvStore } from '../domain/provisioning/IEnvStore';
import type { IDatabaseConnectionValidator } from '../domain/provisioning/IDatabaseConnectionValidator';
import type { IDatabaseSchemaApplier } from '../domain/provisioning/IDatabaseSchemaApplier';
import type { IInstallationSessionRepository } from '../domain/provisioning/IInstallationSessionRepository';
import type { IIdentityBootstrapPort } from '../domain/provisioning/IIdentityBootstrapPort';
import type { IRestartScheduler } from '../domain/provisioning/IRestartScheduler';
import type { IModeratorReadModel } from '../application/notification/ports/IModeratorReadModel';
import type { RoleHierarchyPolicy } from '../application/identity/policies/RoleHierarchyPolicy';
import type { TotpEncryptionService } from '../infrastructure/services/identity/TotpEncryptionService';

export const TOKENS = {
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

  INotificationRepository: token<INotificationRepository>('INotificationRepository'),
  IEmailTemplateRepository: token<IEmailTemplateRepository>('IEmailTemplateRepository'),
  IModeratorReadModel: token<IModeratorReadModel>('IModeratorReadModel'),

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
