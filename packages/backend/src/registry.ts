import { UserApplicationService } from './application/identity/UserApplicationService';
import { AuthApplicationService } from './application/identity/AuthApplicationService';
import { SystemApplicationService } from './application/system/SystemApplicationService';
import { IdentityBootstrapApplicationService } from './application/identity/IdentityBootstrapApplicationService';
import { InstallationApplicationService } from './application/provisioning/InstallationApplicationService';

import { PrismaUserRepository } from './infrastructure/repositories/PrismaUserRepository';
import { PrismaCaptchaChallengeRepository } from './infrastructure/repositories/PrismaCaptchaChallengeRepository';
import { PrismaPasskeyRepository } from './infrastructure/repositories/PrismaPasskeyRepository';
import { PrismaSessionRepository } from './infrastructure/repositories/PrismaSessionRepository';
import { PrismaAuthChallengeRepository } from './infrastructure/repositories/PrismaAuthChallengeRepository';
import { PrismaRoleRepository } from './infrastructure/repositories/PrismaRoleRepository';
import { PrismaRouteWhitelistRepository } from './infrastructure/repositories/PrismaRouteWhitelistRepository';
import { InMemoryInstallationSessionRepository } from './infrastructure/repositories/InMemoryInstallationSessionRepository';

import { Argon2PasswordHasher } from './infrastructure/services/Argon2PasswordHasher';
import { EnvStoreAdapter } from './infrastructure/services/provisioning/EnvStoreAdapter';
import { PrismaDatabaseConnectionValidator } from './infrastructure/services/provisioning/PrismaDatabaseConnectionValidator';
import { PrismaDatabaseSchemaApplier } from './infrastructure/services/provisioning/PrismaDatabaseSchemaApplier';
import { RedisModerationPolicy } from './infrastructure/services/RedisModerationPolicy';
import { ModerationCacheInvalidationHandler } from './infrastructure/events/handlers/ModerationCacheInvalidationHandler';
import { globalEventBus } from './infrastructure/events/InMemoryEventBus';

export const userApplicationService = new UserApplicationService(
  new PrismaUserRepository()
);

export const authApplicationService = new AuthApplicationService(
  new PrismaCaptchaChallengeRepository(),
  new PrismaPasskeyRepository(),
  new PrismaSessionRepository(),
  new PrismaAuthChallengeRepository(),
  new PrismaUserRepository(),
  new PrismaRoleRepository(),
  new Argon2PasswordHasher()
);

export const systemApplicationService = new SystemApplicationService(
  new PrismaRouteWhitelistRepository()
);

export const identityBootstrapApplicationService = new IdentityBootstrapApplicationService(
  new PrismaUserRepository(),
  new PrismaRoleRepository(),
  new Argon2PasswordHasher()
);

export const installationApplicationService = new InstallationApplicationService(
  new EnvStoreAdapter(),
  new PrismaDatabaseConnectionValidator(),
  new PrismaDatabaseSchemaApplier(),
  new InMemoryInstallationSessionRepository(),
  identityBootstrapApplicationService
);

export const redisModerationPolicy = new RedisModerationPolicy();
export const moderationCacheInvalidationHandler = new ModerationCacheInvalidationHandler(
  globalEventBus,
  redisModerationPolicy
);
