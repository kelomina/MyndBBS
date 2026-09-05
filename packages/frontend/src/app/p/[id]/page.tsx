import { Sidebar } from "../../../components/layout/Sidebar";
import { headers } from "next/headers";
import { Locale, defaultLocale } from "../../../i18n/config";
import { getDictionary } from "../../../i18n/get-dictionary";
import { notFound } from "next/navigation";
import { CommentsSection } from "./CommentsSection";
import { PostActions } from "./PostActions";
import { PostDetailRateLimitIsland } from "../../../components/PostDetailRateLimitIsland";
import Link from "next/link";
import { Avatar } from "../../../components/Avatar";
import { BadgeChip } from "../../../components/BadgeChip";
import type { ProfileBadge } from "../../../types/badges";
import { getCategoryTranslation } from '../../../lib/utils';
import { MarkdownContent } from '../../../components/MarkdownContent';
import { serverFetch } from '../../../lib/bff/serverApi';
import { getSsrRateLimitInfo } from '../../../lib/rate-limit/ssr-rate-limit';

export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://kolobbs.kolostudio.fun';

interface PostMeta {
  title: string;
  content: string;
  author?: { username?: string | null };
}

/** 详情页 SEO/OG 元数据：标题 + 正文摘要 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let post: PostMeta | null = null;
  try {
    const res = await serverFetch(`/api/posts/${id}`);
    if (res.ok) post = await res.json();
  } catch {
    return {};
  }
  if (!post) return {};

  const description =
    post.content.replace(/[#*`>\[\]!]/g, '').replace(/\s+/g, ' ').trim().slice(0, 160) || undefined;

  return {
    title: post.title,
    description,
    openGraph: {
      title: post.title,
      description,
      type: 'article',
      url: `${SITE_URL}/p/${id}`,
    },
    alternates: { canonical: `${SITE_URL}/p/${id}` },
  };
}

/**
 * Callers: []
 * Callees: [headers, get, getDictionary, fetch, json, notFound, error, toUpperCase, toLocaleString, getTime, getCategoryTranslation, MarkdownContent, replace]
 * Description: Handles the post detail page logic for the application. Renders markdown content using MarkdownContent (GFM + KaTeX math) with normalized newlines.
 * Keywords: postdetailpage, post, detail, page, markdown, react-markdown, math
 */
export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const headersList = await headers();
  const locale = (headersList.get('x-locale') || defaultLocale) as Locale;
  const dict = await getDictionary(locale);

  let post = null;
  let rateLimited: { retryAfterSec: number } | null = null;
  try {
    const res = await serverFetch(`/api/posts/${id}`);
    if (res.ok) {
      post = await res.json();
    } else if (res.status === 404) {
      return notFound();
    } else {
      rateLimited = await getSsrRateLimitInfo(res);
    }
  } catch (error) {
    console.error('Failed to fetch post:', error);
  }

  if (rateLimited) {
    return (
      <main className="mx-auto flex max-w-7xl px-4 sm:px-6 lg:px-8">
        <Sidebar dict={dict} />
        <div className="flex-1 py-6 md:pl-8">
          <div className="mx-auto max-w-3xl">
            <PostDetailRateLimitIsland postId={id} initialRetryAfterSec={rateLimited.retryAfterSec} dict={dict} />
          </div>
        </div>
      </main>
    );
  }

  if (!post) {
    return (
      <main className="mx-auto flex max-w-7xl px-4 sm:px-6 lg:px-8">
        <Sidebar dict={dict} />
        <div className="flex-1 py-6 md:pl-8 text-center text-muted">
          Failed to load post.
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-7xl px-4 sm:px-6 lg:px-8">
      <Sidebar dict={dict} />
      
      <div className="flex-1 py-6 md:pl-8">
        <div className="mx-auto max-w-3xl">
          {/* Post Content */}
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
                    <div className="text-xs">
                      {new Date(post.createdAt).toLocaleString()}
                      {post.updatedAt && new Date(post.updatedAt).getTime() - new Date(post.createdAt).getTime() > 1000 && (
                        <span className="ml-2 text-muted-foreground italic">({dict.post?.edited || 'Edited'}: {new Date(post.updatedAt).toLocaleString()})</span>
                      )}
                    </div>
                  </div>
                </Link>
              </div>
              <span className="rounded-full bg-background px-3 py-1 font-medium border border-border">
                {getCategoryTranslation(post.category?.name, dict)}
              </span>
            </div>
            
            {post.status === 'FEATURED' && (
              <div className="mb-4">
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                  ⭐ {dict.post?.featured || 'Featured'}
                </span>
              </div>
            )}

            <h1 className="mb-4 text-3xl font-bold text-foreground">
              {post.title}
            </h1>

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
              authorUsername={post.author?.username}
            />
          </article>

          {/* Comments Section */}
          <CommentsSection postId={post.id} dict={dict} initialCount={post._count?.comments || 0} />
          
        </div>
      </div>
    </main>
  );
}
