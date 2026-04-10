-- AlterEnum
ALTER TYPE "PostStatus" ADD VALUE 'PENDING';
ALTER TYPE "UserStatus" ADD VALUE 'PENDING';

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN "isPending" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ModeratedWord" (
    "id" UUID NOT NULL,
    "word" TEXT NOT NULL,
    "categoryId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModeratedWord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModeratedWord_categoryId_idx" ON "ModeratedWord"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "ModeratedWord_word_categoryId_key" ON "ModeratedWord"("word", "categoryId");

-- CreateIndex
CREATE INDEX "Comment_isPending_idx" ON "Comment"("isPending");

-- AddForeignKey
ALTER TABLE "ModeratedWord" ADD CONSTRAINT "ModeratedWord_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
