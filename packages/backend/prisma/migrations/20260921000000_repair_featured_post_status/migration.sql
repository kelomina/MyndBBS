-- Repair the historical no-op migration that declared FEATURED in Prisma
-- but never added it to the PostgreSQL enum.
ALTER TYPE "PostStatus" ADD VALUE IF NOT EXISTS 'FEATURED';
