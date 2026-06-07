-- CreateEnum
CREATE TYPE "WikiStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "CollaboratorRole" AS ENUM ('VIEW', 'EDIT', 'ADMIN');

-- CreateEnum
CREATE TYPE "PageStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED', 'DELETED');

-- CreateTable
CREATE TABLE "Wiki" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "coverUrl" TEXT,
    "ownerId" UUID NOT NULL,
    "minReadLevel" INTEGER NOT NULL DEFAULT 0,
    "minEditLevel" INTEGER NOT NULL DEFAULT 1,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "status" "WikiStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wiki_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WikiCollaborator" (
    "id" UUID NOT NULL,
    "wikiId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "CollaboratorRole" NOT NULL DEFAULT 'EDIT',
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WikiCollaborator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WikiPage" (
    "id" UUID NOT NULL,
    "wikiId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parentId" UUID,
    "authorId" UUID NOT NULL,
    "lastEditorId" UUID,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "PageStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WikiPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WikiPageHistory" (
    "id" UUID NOT NULL,
    "pageId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "editorId" UUID NOT NULL,
    "editNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WikiPageHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WikiCreationLimit" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "creationTimes" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WikiCreationLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Wiki_title_key" ON "Wiki"("title");

-- CreateIndex
CREATE INDEX "Wiki_ownerId_idx" ON "Wiki"("ownerId");

-- CreateIndex
CREATE INDEX "Wiki_status_idx" ON "Wiki"("status");

-- CreateIndex
CREATE INDEX "WikiCollaborator_wikiId_idx" ON "WikiCollaborator"("wikiId");

-- CreateIndex
CREATE INDEX "WikiCollaborator_userId_idx" ON "WikiCollaborator"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WikiCollaborator_wikiId_userId_key" ON "WikiCollaborator"("wikiId", "userId");

-- CreateIndex
CREATE INDEX "WikiPage_wikiId_idx" ON "WikiPage"("wikiId");

-- CreateIndex
CREATE UNIQUE INDEX "WikiPage_wikiId_slug_key" ON "WikiPage"("wikiId", "slug");

-- CreateIndex
CREATE INDEX "WikiPageHistory_pageId_idx" ON "WikiPageHistory"("pageId");

-- CreateIndex
CREATE UNIQUE INDEX "WikiCreationLimit_userId_key" ON "WikiCreationLimit"("userId");

-- CreateIndex
CREATE INDEX "WikiCreationLimit_userId_idx" ON "WikiCreationLimit"("userId");

-- AddForeignKey
ALTER TABLE "Wiki" ADD CONSTRAINT "Wiki_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiCollaborator" ADD CONSTRAINT "WikiCollaborator_wikiId_fkey" FOREIGN KEY ("wikiId") REFERENCES "Wiki"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiCollaborator" ADD CONSTRAINT "WikiCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiPage" ADD CONSTRAINT "WikiPage_wikiId_fkey" FOREIGN KEY ("wikiId") REFERENCES "Wiki"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiPage" ADD CONSTRAINT "WikiPage_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "WikiPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiPage" ADD CONSTRAINT "WikiPage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiPage" ADD CONSTRAINT "WikiPage_lastEditorId_fkey" FOREIGN KEY ("lastEditorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiPageHistory" ADD CONSTRAINT "WikiPageHistory_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "WikiPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiPageHistory" ADD CONSTRAINT "WikiPageHistory_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiCreationLimit" ADD CONSTRAINT "WikiCreationLimit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
