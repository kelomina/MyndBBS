'use client';

import Link from 'next/link';
import { PostList } from './PostList';
import { RateLimitCard } from './RateLimitCard';
import { RateLimitUnlockModal } from './RateLimitUnlockModal';
import { useRateLimitRetry } from '../lib/rate-limit/use-rate-limit';
import { useToast } from './ui/Toast';
import type { Dictionary, PostListPost } from '../types';

interface SearchUserResult {
  id: string;
  username: string;
  level: number;
}

interface SearchResponse {
  posts: PostListPost[];
  users: SearchUserResult[];
}

interface SearchRateLimitIslandProps {
  q: string;
  initialRetryAfterSec: number;
  dict: Dictionary;
}

/** /search 桥：SSR 429 时限流卡，水合后附头重试恢复用户+帖子 */
export function SearchRateLimitIsland({ q, initialRetryAfterSec, dict }: SearchRateLimitIslandProps) {
  const { toast } = useToast();
  const rl = (dict.rateLimitUnlock ?? {}) as unknown as Record<string, string>;
  const bffUrl = `/api/search?q=${encodeURIComponent(q)}`;
  const { limited, retryAfterSec, modalOpen, setModalOpen, retrying, data, handleRetry, handleUnlocked, openVerify } =
    useRateLimitRetry<SearchResponse>(bffUrl, initialRetryAfterSec);

  if (!limited && data) {
    const posts = data.posts || [];
    const users = data.users || [];
    if (posts.length === 0 && users.length === 0) {
      return <div data-testid="empty-state" className="text-center text-muted py-10">{dict.search.noResults}</div>;
    }
    return (
      <div className="space-y-8">
        {users.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground border-b border-border pb-2">{dict.search.users}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {users.map((user) => (
                <Link key={user.id} href={`/u/${user.username}`} className="block">
                  <div className="flex items-center space-x-3 rounded-xl bg-card p-4 shadow-sm transition-shadow hover:shadow-md border border-border/50">
                    <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-lg">
                      {user.username?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <div className="font-medium text-foreground">{user.username}</div>
                      <div className="text-xs text-muted">Lv.{user.level}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
        {posts.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground border-b border-border pb-2">{dict.search.posts}</h2>
            <PostList posts={posts} dict={dict} emptyMessage={dict.search.noResults} />
          </div>
        )}
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
