import { UserApplicationService } from './application/identity/UserApplicationService';
import { AuthApplicationService } from './application/identity/AuthApplicationService';
import { PrismaUserRepository } from './infrastructure/repositories/PrismaUserRepository';
import { PrismaCaptchaChallengeRepository } from './infrastructure/repositories/PrismaCaptchaChallengeRepository';
import { PrismaPasskeyRepository } from './infrastructure/repositories/PrismaPasskeyRepository';
import { PrismaSessionRepository } from './infrastructure/repositories/PrismaSessionRepository';
import { PrismaAuthChallengeRepository } from './infrastructure/repositories/PrismaAuthChallengeRepository';
import { PrismaRoleRepository } from './infrastructure/repositories/PrismaRoleRepository';
import { Argon2PasswordHasher } from './infrastructure/services/Argon2PasswordHasher';

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
