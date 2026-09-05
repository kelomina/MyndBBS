'use client';

import React from 'react';
import Link from 'next/link';
import { Avatar } from './Avatar';
import { BadgeChip } from './BadgeChip';
import type { ProfileBadge } from '../types/badges';
import { MarkdownContent } from './MarkdownContent';
import { PostActions } from '../app/p/[id]/PostActions';
import { CommentsSection } from '../app/p/[id]/CommentsSection';
import { RateLimitCard } from './RateLimitCard';
import { RateLimitUnlockModal } from './RateLimitUnlockModal';
import { useRateLimitRetry } from '../lib/rate-limit/use-rate-limit';
import { useToast } from './ui/Toast';
import { getCategoryTranslation } from '../lib/utils';
import type { Dictionary } from '../types';

interface PostDetailRateLimitIslandProps {
  postId: string;
  initialRetryAfterSec: number;
  dict: Dictionary;
}

interface DetailPost {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  status?: string;
  author?: { username?: string | null; avatarUrl?: string | null; badges?: ProfileBadge[] };
  category?: { name?: string };
  tags?: string[];
  _count?: { upvotes?: number; bookmarks?: number; comments?: number };
}

/**
 * 帖子详情 SSR→Client 桥（F2）：详情 SSR 429 时渲染限流卡，水合后附头重试一次恢复正文。
 * 主区内容由本 Island client 接管渲染（含 MarkdownContent + 交互区），侧栏仍由父 RSC 渲染。
 */
export function PostDetailRateLimitIsland({ postId, initialRetryAfterSec, dict }: PostDetailRateLimitIslandProps) {
  const { toast } = useToast();
  const rl = (dict.rateLimitUnlock ?? {}) as unknown as Record<string, string>;
  const bffUrl = `/api/posts/${postId}`;
  const { limited, retryAfterSec, modalOpen, setModalOpen, retrying, data, handleRetry, handleUnlocked, openVerify } =
    useRateLimitRetry<DetailPost>(bffUrl, initialRetryAfterSec);

  const onUnlocked = React.useCallback(() => {
    toast(rl.unlockSuccess || 'Verified — access restored', 'success');
    handleUnlocked();
  }, [toast, rl.unlockSuccess, handleUnlocked]);

  if (!limited && data) {
    const post = data;
    return (
      <div className="mx-auto max-w-3xl">
        <article className="rounded-xl bg-card p-6 shadow-sm border border-border/50 mb-6">
          <div className="mb-6 flex items-center justify-between text-sm text-muted">
            <div className="flex items-center space-x-3">
              <Link href={`/u/${post.author?.username}`} className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
                <Avatar src={post.author?.avatarUrl} username={post.author?.username || '?'} size={40} />
                <div>
                  <div className="font-medium text-foreground">{post.author?.username || 'Unknown'}</div>
                  {Array.isArray(post.author?.badges) && post.author.badges.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(post.author.badges as ProfileBadge[]).map((badge) => (
                        <BadgeChip key={badge.id} badge={badge} dict={dict} />
                      ))}
                    </div>
                  )}
                  <div className="text-xs">{post.createdAt ? new Date(post.createdAt).toLocaleString() : ''}</div>
                </div>
              </Link>
            </div>
            <span className="rounded-full bg-background px-3 py-1 font-medium border border-border">
              {getCategoryTranslation(post.category?.name, dict)}
            </span>
          </div>
          <h1 className="mb-4 text-3xl font-bold text-foreground">{post.title}</h1>
          {Array.isArray(post.tags) && post.tags.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {post.tags.map((tag: string) => (
                <Link
                  key={tag}
                  href={`/tags/${encodeURIComponent(tag)}`}
                  className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                >
                  # {tag}
                </Link>
              ))}
            </div>
          )}
          <div className="prose dark:prose-invert max-w-none text-foreground">
            <MarkdownContent content={post.content?.replace(/\\n/g, '\n') || ''} />
          </div>
          <PostActions
            postId={post.id}
            initialUpvotes={post._count?.upvotes || 0}
            initialBookmarks={post._count?.bookmarks || 0}
            authorUsername={post.author?.username || ''}
          />
          <CommentsSection postId={post.id} dict={dict} initialCount={post._count?.comments || 0} />
        </article>
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
          onUnlocked={onUnlocked}
          dict={dict}
        />
      )}
    </>
  );
}
