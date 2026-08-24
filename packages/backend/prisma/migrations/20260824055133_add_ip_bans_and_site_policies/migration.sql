-- CreateEnum
CREATE TYPE "IpBanScope" AS ENUM ('ALL', 'REGISTRATION');

-- CreateTable
CREATE TABLE "BannedIp" (
    "id" UUID NOT NULL,
    "ip" TEXT NOT NULL,
    "scope" "IpBanScope" NOT NULL DEFAULT 'ALL',
    "reason" TEXT,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "BannedIp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SitePolicy" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SitePolicy_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "BannedIp_ip_key" ON "BannedIp"("ip");
