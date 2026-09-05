-- B1: captcha strength snapshot (frozen low/normal/strict); existing rows backfill normal to preserve current semantics
ALTER TABLE "CaptchaChallenge" ADD COLUMN "strength" TEXT NOT NULL DEFAULT 'normal';

