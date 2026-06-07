ALTER TABLE "PrivateMessage"
ADD COLUMN "expiresInMs" INTEGER,
ADD COLUMN "expiresStartedAt" TIMESTAMP(3),
ADD COLUMN "autoDeleteForSenderAfterRead" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "PrivateMessage_expiresAt_idx" ON "PrivateMessage"("expiresAt");
