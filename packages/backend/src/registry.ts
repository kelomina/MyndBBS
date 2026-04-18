import { UserApplicationService } from './application/identity/UserApplicationService';
import { AuthApplicationService } from './application/identity/AuthApplicationService';
import { SystemApplicationService } from './application/system/SystemApplicationService';
import { IdentityBootstrapApplicationService } from './application/identity/IdentityBootstrapApplicationService';
import { InstallationApplicationService } from './application/provisioning/InstallationApplicationService';
import { CommunityApplicationService } from './application/community/CommunityApplicationService';
import { MessagingApplicationService } from './application/messaging/MessagingApplicationService';
import { RoleApplicationService } from './application/identity/RoleApplicationService';
import { ModerationApplicationService } from './application/community/ModerationApplicationService';

import { PrismaUserRepository } from './infrastructure/repositories/PrismaUserRepository';
import { PrismaCaptchaChallengeRepository } from './infrastructure/repositories/PrismaCaptchaChallengeRepository';
import { PrismaPasskeyRepository } from './infrastructure/repositories/PrismaPasskeyRepository';
import { PrismaSessionRepository } from './infrastructure/repositories/PrismaSessionRepository';
import { PrismaAuthChallengeRepository } from './infrastructure/repositories/PrismaAuthChallengeRepository';
import { PrismaRoleRepository } from './infrastructure/repositories/PrismaRoleRepository';
import { PrismaRouteWhitelistRepository } from './infrastructure/repositories/PrismaRouteWhitelistRepository';
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

import { Argon2PasswordHasher } from './infrastructure/services/Argon2PasswordHasher';
import { EnvStoreAdapter } from './infrastructure/services/provisioning/EnvStoreAdapter';
import { PrismaDatabaseConnectionValidator } from './infrastructure/services/provisioning/PrismaDatabaseConnectionValidator';
import { PrismaDatabaseSchemaApplier } from './infrastructure/services/provisioning/PrismaDatabaseSchemaApplier';
import { ProcessExitRestartScheduler } from './infrastructure/services/provisioning/ProcessExitRestartScheduler';
import { RedisModeratedWordsCache } from './infrastructure/services/RedisModeratedWordsCache';
import { ModerationPolicy } from './domain/community/ModerationPolicy';
import { ModerationCacheInvalidationHandler } from './infrastructure/events/handlers/ModerationCacheInvalidationHandler';
import { AbilityCacheInvalidationHandler } from './infrastructure/events/handlers/AbilityCacheInvalidationHandler';
import { globalEventBus } from './infrastructure/events/InMemoryEventBus';

import { AdminUserManagementApplicationService } from './application/identity/AdminUserManagementApplicationService';
import { RedisSessionCache } from './infrastructure/services/RedisSessionCache';
import { RedisAbilityCache } from './infrastructure/services/RedisAbilityCache';
import { RoleHierarchyPolicy } from './application/identity/policies/RoleHierarchyPolicy';
import { TotpAdapter } from './infrastructure/services/identity/TotpAdapter';
import { PasskeyAdapter } from './infrastructure/services/identity/PasskeyAdapter';
import { TokenAdapter } from './infrastructure/services/identity/TokenAdapter';
import { LocalFileStorageAdapter } from './infrastructure/services/system/LocalFileStorageAdapter';

export const redisAbilityCache = new RedisAbilityCache();
export const authCache = new RedisSessionCache();

const totpAdapter = new TotpAdapter();
const passkeyAdapter = new PasskeyAdapter();
const tokenAdapter = new TokenAdapter();
const localFileStorageAdapter = new LocalFileStorageAdapter();

export const abilityCacheInvalidationHandler = new AbilityCacheInvalidationHandler(
  globalEventBus,
  redisAbilityCache
);

export const userApplicationService = new UserApplicationService(
  new PrismaUserRepository(),
  redisAbilityCache,
  new Argon2PasswordHasher(),
  totpAdapter
);



import { AuditApplicationService } from './application/system/AuditApplicationService';
import { PrismaAuditLogRepository } from './infrastructure/repositories/PrismaAuditLogRepository';

export const auditApplicationService = new AuditApplicationService(
  new PrismaAuditLogRepository()
);

export const adminUserManagementApplicationService = new AdminUserManagementApplicationService(
  new PrismaUserRepository(),
  new PrismaRoleRepository(),
  new PrismaPasskeyRepository(),
  new PrismaSessionRepository(),
  new RedisSessionCache(),
  new RoleHierarchyPolicy(),
  auditApplicationService
);

import { SudoApplicationService } from './application/identity/SudoApplicationService';
import { RedisSudoStore } from './infrastructure/services/RedisSudoStore';
import { identityQueryService } from './queries/identity/IdentityQueryService';
import { PrismaUserSecurityReadModel } from './infrastructure/queries/PrismaUserSecurityReadModel';

export const authApplicationService = new AuthApplicationService(
  new PrismaCaptchaChallengeRepository(),
  new PrismaPasskeyRepository(),
  new PrismaSessionRepository(),
  new PrismaAuthChallengeRepository(),
  new PrismaUserRepository(),
  new PrismaRoleRepository(),
  new Argon2PasswordHasher(),
  authCache,
  totpAdapter,
  passkeyAdapter,
  tokenAdapter
);

export const sudoApplicationService = new SudoApplicationService(
  new PrismaUserSecurityReadModel(),
  authApplicationService,
  new RedisSudoStore(),
  process.env.RP_ID || 'localhost',
  process.env.ORIGIN || `http://${process.env.RP_ID || 'localhost'}:3000`
);

export const systemApplicationService = new SystemApplicationService(
  new PrismaRouteWhitelistRepository(),
  localFileStorageAdapter
);

export const identityBootstrapApplicationService = new IdentityBootstrapApplicationService(
  new PrismaUserRepository(),
  new PrismaRoleRepository(),
  new Argon2PasswordHasher()
);

import { IdentityBootstrapServiceAdapter } from './infrastructure/services/provisioning/IdentityBootstrapServiceAdapter';
export const identityBootstrapServiceAdapter = new IdentityBootstrapServiceAdapter(
  identityBootstrapApplicationService
);

export const installationApplicationService = new InstallationApplicationService(
  new EnvStoreAdapter(),
  new PrismaDatabaseConnectionValidator(),
  new PrismaDatabaseSchemaApplier(),
  new InMemoryInstallationSessionRepository(),
  identityBootstrapServiceAdapter,
  new ProcessExitRestartScheduler(),
  auditApplicationService
);

export const redisModeratedWordsCache = new RedisModeratedWordsCache(
  new PrismaModeratedWordRepository()
);
export const moderationPolicy = new ModerationPolicy(redisModeratedWordsCache);

export const moderationCacheInvalidationHandler = new ModerationCacheInvalidationHandler(
  globalEventBus,
  moderationPolicy
);

import { IdentityIntegrationPort } from './infrastructure/services/IdentityIntegrationPort';

export const identityIntegrationPort = new IdentityIntegrationPort(identityQueryService);

export const communityApplicationService = new CommunityApplicationService(
  new PrismaCategoryRepository(),
  new PrismaPostRepository(),
  new PrismaCommentRepository(),
  new PrismaEngagementRepository(),
  identityIntegrationPort,
  moderationPolicy,
  authApplicationService,
  globalEventBus,
  auditApplicationService
);

export const messagingApplicationService = new MessagingApplicationService(
  new PrismaFriendshipRepository(),
  new PrismaPrivateMessageRepository(),
  new PrismaUserKeyRepository(),
  new PrismaConversationSettingRepository(),
  identityIntegrationPort
);

export const roleApplicationService = new RoleApplicationService(
  new PrismaRoleRepository(),
  new PrismaPermissionRepository(),
  new PrismaUserRepository(),
  redisAbilityCache
);

export const moderationApplicationService = new ModerationApplicationService(
  new PrismaPostRepository(),
  new PrismaCommentRepository(),
  new PrismaModeratedWordRepository(),
  globalEventBus,
  auditApplicationService
);
