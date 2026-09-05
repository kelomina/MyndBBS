-- 联邦验证 + 通知徽标增量（API-SPEC-TAG-CAPTCHA-NOTIFY v1.0.0 + 演示批准增量 02:00）
-- CaptchaChallenge 加列 challengeKind/challengeData/attempts（存量默认 slider/0，滑块 5 处语义不变）
ALTER TABLE "CaptchaChallenge" ADD COLUMN "challengeKind" TEXT NOT NULL DEFAULT 'slider';
ALTER TABLE "CaptchaChallenge" ADD COLUMN "challengeData" JSONB;
ALTER TABLE "CaptchaChallenge" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;

-- Notification 补 commentId 可空列 + 复合索引 (userId,isRead,createdAt)（unread-count 全扫风险）
ALTER TABLE "Notification" ADD COLUMN "commentId" UUID;
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");
