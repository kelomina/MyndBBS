import { Sidebar } from "../../../components/layout/Sidebar";
import { MessageSquare } from "lucide-react";
import { headers } from "next/headers";
import { Locale, defaultLocale } from "../../../i18n/config";
import { getDictionary } from "../../../i18n/get-dictionary";
import { notFound } from "next/navigation";
import { CommentsSection } from "./CommentsSection";
import { PostActions } from "./PostActions";
import Link from "next/link";
import { getCategoryTranslation } from '../../../lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export const dynamic = 'force-dynamic';

/**
 * Callers: []
 * Callees: [headers, get, getDictionary, fetch, json, notFound, error, toUpperCase, toLocaleString, getTime, getCategoryTranslation, ReactMarkdown]
 * Description: Handles the post detail page logic for the application. Renders markdown content using ReactMarkdown.
 * Keywords: postdetailpage, post, detail, page, markdown, react-markdown
 */
export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const headersList = await headers();
  const locale = (headersList.get('x-locale') || defaultLocale) as Locale;
  const dict = await getDictionary(locale);

  let post = null;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/posts/${id}`, {
      cache: 'no-store'
    });
    if (res.ok) {
      post = await res.json();
    } else if (res.status === 404) {
      return notFound();
    }
  } catch (error) {
    console.error('Failed to fetch post:', error);
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
                  <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-lg">
                    {post.author?.username?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <div className="font-medium text-foreground">{post.author?.username || 'Unknown'}</div>
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
            
            <h1 className="mb-6 text-3xl font-bold text-foreground">
              {post.title}
            </h1>
            
            <div className="prose dark:prose-invert max-w-none text-foreground space-y-4 whitespace-pre-wrap">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {post.content}
              </ReactMarkdown>
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
