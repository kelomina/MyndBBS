# Fix Backend TS Compilation Errors Spec

## Why
When starting the backend with `ts-node src/index.ts`, it fails with TypeScript compilation errors regarding the `argon2` module not being found and missing `captchaChallenge` and `password` properties on Prisma types.

## What Changes
- Install and rebuild the `argon2` module to resolve module resolution errors.
- Add `url = env("DATABASE_URL")` to `datasource db` in `schema.prisma` and provide a `.env` file to fix the PrismaClient initialization error.
- Run `prisma generate` to update the Prisma Client typings so that they match the current `schema.prisma`.

## Impact
- Affected specs: Backend startup and compilation.
- Affected code: `/packages/backend/prisma/schema.prisma` and local `node_modules` typings.

## MODIFIED Requirements
### Requirement: Backend Startup
The backend must start successfully without TS compilation errors and initialize the Prisma Client correctly.