-- Explicit destructive rollback: back up plugin tables and stop plugin consumers first.
-- Run manually ONLY when reverting this migration; Prisma does not execute this file.
BEGIN;
DROP TABLE "PluginEventDelivery";
DROP TABLE "PluginConfig";
DROP TABLE "PluginRelease";
DROP TABLE "Plugin";
DROP TYPE "PluginEventDeliveryState";
DROP TYPE "PluginReleaseState";
DROP TYPE "PluginRuntimeState";
DROP TYPE "PluginDesiredState";
COMMIT;
