/**
 * 模块：依赖注入注册表
 *
 * 函数作用：
 *   集中管理所有应用服务、仓储实现、基础设施适配器和事件处理器的实例化与依赖注入。
 *   采用手动 DI 模式，避免引入 IoC 容器的额外复杂度。
 * Purpose:
 *   Central registry for all application services, repository implementations,
 *   infrastructure adapters, and event handler instantiations with dependency injection.
 *   Uses manual DI pattern to avoid IoC container complexity.
 *
 * 中文关键词：
 *   依赖注入，注册表，服务，仓储，适配器
 * English keywords:
 *   dependency injection, registry, service, repository, adapter
 */
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

/** 全局单例 Unit of Work 实例 */
export const unitOfWork = new PrismaUnitOfWork();

import { Argon2PasswordHasher } from './infrastructure/services/Argon2PasswordHasher';
import { EnvStoreAdapter } from './infrastructure/services/provisioning/EnvStoreAdapter';
import { PrismaDatabaseConnectionValidator } from './infrastructure/services/provisioning/PrismaDatabaseConnectionValidator';
import { PrismaDatabaseSchemaApplier } from './infrastructure/services/provisioning/PrismaDatabaseSchemaApplier';
import { ProcessExitRestartScheduler } from './infrastructure/services/provisioning/ProcessExitRestartScheduler';
import { RedisModeratedWordsCache } from './infrastructure/services/RedisModeratedWordsCache';
import { ModerationPolicy } from './domain/community/ModerationPolicy';
import { ModerationCacheInvalidationHandler } from './infrastructure/events/handlers/ModerationCacheInvalidationHandler';
import { AbilityCacheInvalidationHandler } from './infrastructure/events/handlers/AbilityCacheInvalidationHandler';
import { AuditEventListener } from './infrastructure/events/handlers/AuditEventListener';
import { globalEventBus } from './infrastructure/events/InMemoryEventBus';

import { AdminUserManagementApplicationService } from './application/identity/AdminUserManagementApplicationService';
import { RedisSessionCache } from './infrastructure/services/RedisSessionCache';
import { RedisAbilityCache } from './infrastructure/services/RedisAbilityCache';
import { RoleHierarchyPolicy } from './application/identity/policies/RoleHierarchyPolicy';
import { TotpAdapter } from './infrastructure/services/identity/TotpAdapter';
import { TotpEncryptionService } from './infrastructure/services/identity/TotpEncryptionService';
import { PasskeyAdapter } from './infrastructure/services/identity/PasskeyAdapter';
import { SmtpEmailSender } from './infrastructure/services/identity/SmtpEmailSender';
import { TokenAdapter } from './infrastructure/services/identity/TokenAdapter';
import { LocalFileStorageAdapter } from './infrastructure/services/system/LocalFileStorageAdapter';
import { EmailConfigurationApplicationService } from './application/notification/EmailConfigurationApplicationService';
import { PrismaEmailTemplateRepository } from './infrastructure/repositories/PrismaEmailTemplateRepository';

// ── 共享基础设施实例 ──

/** Redis 权限缓存 */
export const redisAbilityCache = new RedisAbilityCache();

const totpEncryptionService = new TotpEncryptionService();
/** Redis 会话缓存（含 TOTP secret 临时存储） */
export const authCache = new RedisSessionCache(totpEncryptionService);

const totpAdapter = new TotpAdapter();
const passkeyAdapter = new PasskeyAdapter();
const tokenAdapter = new TokenAdapter();
const smtpEmailSender = new SmtpEmailSender();
const localFileStorageAdapter = new LocalFileStorageAdapter();

/** 权限缓存失效事件处理器 */
export const abilityCacheInvalidationHandler = new AbilityCacheInvalidationHandler(
  globalEventBus,
  redisAbilityCache
);

// ── 应用服务实例化 ──

/** 用户管理应用服务 */
export const userApplicationService = new UserApplicationService(
  new PrismaUserRepository(totpEncryptionService),
  new PrismaPasskeyRepository(),
  redisAbilityCache,
  new Argon2PasswordHasher(),
  totpAdapter,
  unitOfWork
);



import { AuditApplicationService } from './application/system/AuditApplicationService';
import { PrismaAuditLogRepository } from './infrastructure/repositories/PrismaAuditLogRepository';

/** 审计日志应用服务 */
export const auditApplicationService = new AuditApplicationService(
  new PrismaAuditLogRepository(),
  unitOfWork
);

/** 审计事件侦听器（订阅领域事件写入审计日志） */
export const auditEventListener = new AuditEventListener(
  globalEventBus,
  auditApplicationService
);

/** 管理员用户管理应用服务 */
export const adminUserManagementApplicationService = new AdminUserManagementApplicationService(
  new PrismaUserRepository(totpEncryptionService),
  new PrismaRoleRepository(),
  new PrismaPasskeyRepository(),
  new PrismaSessionRepository(),
  new RedisSessionCache(totpEncryptionService),
  new RoleHierarchyPolicy(),
  globalEventBus,
  unitOfWork,
  redisAbilityCache
);

import { SudoApplicationService } from './application/identity/SudoApplicationService';
import { RedisSudoStore } from './infrastructure/services/RedisSudoStore';
import { identityQueryService } from './queries/identity/IdentityQueryService';
import { PrismaUserSecurityReadModel } from './infrastructure/queries/PrismaUserSecurityReadModel';

const emailTemplateRepo = new PrismaEmailTemplateRepository();

/** 认证应用服务（注册/登录/2FA/Passkey/会话管理） */
export const authApplicationService = new AuthApplicationService(
  new PrismaCaptchaChallengeRepository(),
  new PrismaPasskeyRepository(),
  new PrismaSessionRepository(),
  new PrismaAuthChallengeRepository(),
  new PrismaUserRepository(totpEncryptionService),
  new PrismaRoleRepository(),
  new RedisEmailRegistrationTicketRepository(),
  new RedisPasswordResetTicketRepository(),
  new Argon2PasswordHasher(),
  authCache,
  totpAdapter,
  passkeyAdapter,
  tokenAdapter,
  smtpEmailSender,
  emailTemplateRepo,
  unitOfWork
);

/** Sudo 模式应用服务 */
export const sudoApplicationService = new SudoApplicationService(
  new PrismaUserSecurityReadModel(totpEncryptionService),
  authApplicationService,
  new RedisSudoStore(),
  process.env.RP_ID || 'localhost',
  process.env.ORIGIN || `http://${process.env.RP_ID || 'localhost'}:3000`,
  totpAdapter
);

/** 系统应用服务（路由白名单、文件上传） */
export const systemApplicationService = new SystemApplicationService(
  new PrismaRouteWhitelistRepository(),
  localFileStorageAdapter,
  unitOfWork
);

/** 身份引导应用服务（初始角色/用户创建） */
export const identityBootstrapApplicationService = new IdentityBootstrapApplicationService(
  new PrismaUserRepository(totpEncryptionService),
  new PrismaRoleRepository(),
  new Argon2PasswordHasher(),
  unitOfWork
);

import { IdentityBootstrapServiceAdapter } from './infrastructure/services/provisioning/IdentityBootstrapServiceAdapter';
export const identityBootstrapServiceAdapter = new IdentityBootstrapServiceAdapter(
  identityBootstrapApplicationService
);

/** 安装引导应用服务 */
export const installationApplicationService = new InstallationApplicationService(
  new EnvStoreAdapter(),
  new PrismaDatabaseConnectionValidator(),
  new PrismaDatabaseSchemaApplier(),
  new InMemoryInstallationSessionRepository(),
  identityBootstrapServiceAdapter,
  new ProcessExitRestartScheduler(),
  globalEventBus
);

/** 审核敏感词缓存（Redis/内存） */
export const redisModeratedWordsCache = new RedisModeratedWordsCache(
  new PrismaModeratedWordRepository()
);
/** 内容审核策略（基于敏感词匹配） */
export const moderationPolicy = new ModerationPolicy(redisModeratedWordsCache);

/** 审核缓存失效事件处理器 */
export const moderationCacheInvalidationHandler = new ModerationCacheInvalidationHandler(
  globalEventBus,
  moderationPolicy
);

import { IdentityIntegrationPort } from './infrastructure/services/IdentityIntegrationPort';

export const identityIntegrationPort = new IdentityIntegrationPort(identityQueryService);

/** 社区应用服务（分类/帖子/评论/互动管理） */
export const communityApplicationService = new CommunityApplicationService(
  new PrismaCategoryRepository(),
  new PrismaPostRepository(),
  new PrismaCommentRepository(),
  new PrismaEngagementRepository(),
  identityIntegrationPort,
  moderationPolicy,
  authApplicationService,
  globalEventBus,
  auditApplicationService,
  unitOfWork
);

/** 私信应用服务 */
export const messagingApplicationService = new MessagingApplicationService(
  new PrismaFriendshipRepository(),
  new PrismaPrivateMessageRepository(),
  new PrismaUserKeyRepository(),
  new PrismaConversationSettingRepository(),
  identityIntegrationPort,
  unitOfWork
);

/** 角色权限应用服务 */
export const roleApplicationService = new RoleApplicationService(
  new PrismaRoleRepository(),
  new PrismaPermissionRepository(),
  new PrismaUserRepository(totpEncryptionService),
  redisAbilityCache,
  unitOfWork
);

/** 邮件配置应用服务 */
export const emailConfigurationApplicationService = new EmailConfigurationApplicationService(
  new EnvStoreAdapter(),
  new PrismaEmailTemplateRepository(),
);

/** 内容审核应用服务 */
export const moderationApplicationService = new ModerationApplicationService(
  new PrismaPostRepository(),
  new PrismaCommentRepository(),
  new PrismaModeratedWordRepository(),
  globalEventBus,
  auditApplicationService,
  unitOfWork
);
