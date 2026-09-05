'use client';

import Link from 'next/link';
import { RateLimitCard } from './RateLimitCard';
import { RateLimitUnlockModal } from './RateLimitUnlockModal';
import { useRateLimitRetry } from '../lib/rate-limit/use-rate-limit';
import { useToast } from './ui/Toast';
import type { Dictionary } from '../types';

interface TagItem {
  name: string;
  postCount: number;
}

interface TagsRateLimitIslandProps {
  initialRetryAfterSec: number;
  dict: Dictionary;
}

/** /tags 列表桥：SSR 429 时限流卡，水合后附头重试恢复标签网格 */
export function TagsRateLimitIsland({ initialRetryAfterSec, dict }: TagsRateLimitIslandProps) {
  const { toast } = useToast();
  const rl = (dict.rateLimitUnlock ?? {}) as unknown as Record<string, string>;
  const { limited, retryAfterSec, modalOpen, setModalOpen, retrying, data, handleRetry, handleUnlocked, openVerify } =
    useRateLimitRetry<{ tags: TagItem[] }>('/api/tags', initialRetryAfterSec);

  const tags: TagItem[] = Array.isArray((data as unknown as { tags?: TagItem[] })?.tags)
    ? (data as unknown as { tags: TagItem[] }).tags
    : Array.isArray(data)
      ? (data as unknown as TagItem[])
      : [];

  if (!limited && data) {
    return (
      <div className="flex flex-wrap gap-3">
        {tags.map((tag) => (
          <Link
            key={tag.name}
            href={`/tags/${encodeURIComponent(tag.name)}`}
            className="group rounded-xl border border-border bg-card px-5 py-4 shadow-sm transition-colors hover:border-primary/50"
          >
            <div className="text-lg font-semibold text-primary group-hover:underline"># {tag.name}</div>
            <div className="text-xs text-muted">
              {(dict.tags?.postCount || '{count} posts').replace('{count}', String(tag.postCount))}
            </div>
          </Link>
        ))}
      </div>
    );
  }

  return (
    <>
      <RateLimitCard
        key={retryAfterSec}
        retryAfterSec={retryAfterSec}
        onVerifyClick={openVerify}
        onRetryClick={() => void handleRetry()}
        dict={dict}
        retrying={retrying}
      />
      {modalOpen && (
        <RateLimitUnlockModal
          isOpen
          onClose={() => setModalOpen(false)}
          retryAfterSec={retryAfterSec}
          onUnlocked={() => {
            toast(rl.unlockSuccess || 'Verified — access restored', 'success');
            handleUnlocked();
          }}
          dict={dict}
        />
      )}
    </>
  );
}
