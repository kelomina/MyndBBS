/**
 * 启动引导：bootstrapBadgeEvaluation
 *
 * 函数作用：
 *   启动徽章自动评估周期任务：
 *   - 有 Redis 时使用 BullMQ repeatable job（每 5 分钟）
 *   - 无 Redis 或调度失败时降级为 setInterval
 *   任务内容：调用 BadgeApplicationService.evaluateAndGrantAll()，
 *   为所有启用中的 AUTO 徽章评估并授予新达标用户。
 *
 * Purpose:
 *   Starts the periodic badge auto-grant evaluation job (BullMQ with
 *   setInterval fallback), mirroring bootstrapMessageCleanup patterns.
 */
import { createWorker, BADGE_QUEUE_NAME, getBadgeQueue } from '../infrastructure/queues/queueFactory';
import { badgeApplicationService } from '../registry';

const EVALUATION_INTERVAL_MS = 5 * 60 * 1000;

export function bootstrapBadgeEvaluation(): void {
  const runEvaluation = async (): Promise<void> => {
    try {
      const result = await badgeApplicationService.evaluateAndGrantAll();
      if (result.grantedCount > 0) {
        console.log(`[BadgeEvaluation] Granted ${result.grantedCount} badge(s) across ${result.evaluatedBadges} auto badges.`);
      }
    } catch (err) {
      console.error('[BadgeEvaluation] Evaluation failed:', err);
    }
  };

  if (!process.env.REDIS_URL) {
    setInterval(runEvaluation, EVALUATION_INTERVAL_MS);
    return;
  }

  try {
    const worker = createWorker(BADGE_QUEUE_NAME, async () => {
      await runEvaluation();
    });
    worker.on('failed', (_job: unknown, err: Error) => {
      console.error('[BadgeEvaluation] Job failed:', err);
    });

    getBadgeQueue().add(
      'evaluate-badges',
      {},
      {
        repeat: { every: EVALUATION_INTERVAL_MS },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    ).catch((err: unknown) => {
      console.error('[BadgeEvaluation] Failed to schedule repeatable job, falling back to interval:', err);
      setInterval(runEvaluation, EVALUATION_INTERVAL_MS);
    });
  } catch (err) {
    console.error('[BadgeEvaluation] Worker bootstrap failed, falling back to interval:', err);
    setInterval(runEvaluation, EVALUATION_INTERVAL_MS);
  }
}
