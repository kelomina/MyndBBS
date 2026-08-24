-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bio" VARCHAR(200);

-- CreateTable
CREATE TABLE "PostDraft" (
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "categoryId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostDraft_pkey" PRIMARY KEY ("userId")
);
