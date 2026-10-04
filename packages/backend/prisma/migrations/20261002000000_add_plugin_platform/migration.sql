CREATE TYPE "PluginDesiredState" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "PluginRuntimeState" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'STARTING', 'ACTIVE', 'DISABLED', 'UNHEALTHY', 'FAILED', 'ROLLED_BACK');
CREATE TYPE "PluginReleaseState" AS ENUM ('QUARANTINED', 'APPROVED', 'ACTIVE', 'RETIRED', 'REJECTED');
CREATE TYPE "PluginEventDeliveryState" AS ENUM ('PENDING', 'DELIVERING', 'DELIVERED', 'FAILED', 'DEAD_LETTER');

CREATE TABLE "Plugin" (
    "id" UUID NOT NULL,
    "pluginId" TEXT NOT NULL,
    "displayName" TEXT,
    "description" TEXT,
    "desiredState" "PluginDesiredState" NOT NULL DEFAULT 'DISABLED',
    "runtimeState" "PluginRuntimeState" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "currentVersion" TEXT,
    "healthy" BOOLEAN,
    "lastHealthAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Plugin_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PluginRelease" (
    "id" UUID NOT NULL,
    "pluginId" UUID NOT NULL,
    "version" TEXT NOT NULL,
    "apiVersion" INTEGER NOT NULL,
    "manifest" JSONB NOT NULL,
    "artifactSha256" TEXT NOT NULL,
    "signatureKeyId" TEXT NOT NULL,
    "artifactPath" TEXT,
    "state" "PluginReleaseState" NOT NULL DEFAULT 'QUARANTINED',
    "uploadedBy" UUID,
    "approvedBy" UUID,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PluginRelease_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PluginConfig" (
    "id" UUID NOT NULL,
    "pluginId" UUID NOT NULL,
    "publicConfig" JSONB NOT NULL,
    "encryptedSecrets" TEXT NOT NULL,
    "secretPaths" JSONB NOT NULL DEFAULT '[]',
    "updatedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PluginConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PluginEventDelivery" (
    "id" UUID NOT NULL,
    "pluginId" UUID NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "state" "PluginEventDeliveryState" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PluginEventDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Plugin_pluginId_key" ON "Plugin"("pluginId");
CREATE INDEX "Plugin_desiredState_runtimeState_idx" ON "Plugin"("desiredState", "runtimeState");
CREATE UNIQUE INDEX "PluginRelease_pluginId_version_key" ON "PluginRelease"("pluginId", "version");
CREATE INDEX "PluginRelease_pluginId_state_idx" ON "PluginRelease"("pluginId", "state");
CREATE UNIQUE INDEX "PluginConfig_pluginId_key" ON "PluginConfig"("pluginId");
CREATE UNIQUE INDEX "PluginEventDelivery_pluginId_eventId_key" ON "PluginEventDelivery"("pluginId", "eventId");
CREATE INDEX "PluginEventDelivery_pluginId_state_availableAt_idx" ON "PluginEventDelivery"("pluginId", "state", "availableAt");

ALTER TABLE "PluginRelease" ADD CONSTRAINT "PluginRelease_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "Plugin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PluginConfig" ADD CONSTRAINT "PluginConfig_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "Plugin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PluginEventDelivery" ADD CONSTRAINT "PluginEventDelivery_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "Plugin"("id") ON DELETE CASCADE ON UPDATE CASCADE;