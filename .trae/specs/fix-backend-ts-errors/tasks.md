# Tasks
- [x] Task 1: Fix package installations and build scripts
  - [x] SubTask 1.1: Ensure `argon2` is properly installed and rebuilt using `pnpm rebuild argon2` or running install with `ignore-scripts=false`.
- [x] Task 2: Fix Prisma schema and typings
  - [x] SubTask 2.1: Add `url = env("DATABASE_URL")` to `packages/backend/prisma/schema.prisma` if missing. (Adjusted for Prisma 7: using `src/db.ts` with adapter).
  - [x] SubTask 2.2: Add `.env` file in `packages/backend` with a valid local SQLite URL (e.g., `DATABASE_URL="file:./dev.db"`).
  - [x] SubTask 2.3: Run `pnpm --filter backend exec prisma generate` to generate the correct typings.
- [x] Task 3: Validate backend startup
  - [x] SubTask 3.1: Run `pnpm --filter backend exec ts-node src/index.ts` to confirm compilation and startup succeed.