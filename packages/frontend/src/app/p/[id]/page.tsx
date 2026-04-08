import { Sidebar } from "../../../components/layout/Sidebar";
import { MessageSquare, ArrowBigUp, Bookmark, Share } from "lucide-react";
import { headers } from "next/headers";
import { Locale, defaultLocale } from "../../../i18n/config";
import { getDictionary } from "../../../i18n/get-dictionary";
import { notFound } from "next/navigation";

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
                <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-lg">
                  {post.author?.username?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <div className="font-medium text-foreground">{post.author?.username || 'Unknown'}</div>
                  <div className="text-xs">{new Date(post.createdAt).toLocaleString()}</div>
                </div>
              </div>
              <span className="rounded-full bg-background px-3 py-1 font-medium border border-border">
                {post.category?.name || 'Uncategorized'}
              </span>
            </div>
            
            <h1 className="mb-6 text-3xl font-bold text-foreground">
              {post.title}
            </h1>
            
            <div className="prose dark:prose-invert max-w-none text-foreground space-y-4 whitespace-pre-wrap">
              {post.content}
            </div>
            
            <div className="mt-8 flex items-center justify-between border-t border-border pt-4">
              <div className="flex items-center space-x-6 text-muted">
                <button className="flex items-center space-x-2 transition-colors hover:text-primary">
                  <ArrowBigUp className="h-6 w-6" />
                  <span className="font-medium">0</span>
                </button>
                <button className="flex items-center space-x-2 transition-colors hover:text-primary">
                  <MessageSquare className="h-5 w-5" />
                  <span className="font-medium">0</span>
                </button>
              </div>
              <div className="flex items-center space-x-4 text-muted">
                <button className="transition-colors hover:text-foreground"><Bookmark className="h-5 w-5" /></button>
                <button className="transition-colors hover:text-foreground"><Share className="h-5 w-5" /></button>
              </div>
            </div>
          </article>

          {/* Comments Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-foreground mb-4">{dict.post.comments} (0)</h3>
            
            {/* Comment Input */}
            <div className="rounded-xl bg-card p-4 shadow-sm border border-border/50 flex gap-4">
              <div className="h-8 w-8 shrink-0 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-xs mt-1">?</div>
              <div className="flex-1 space-y-3">
                <textarea 
                  className="w-full rounded-lg border border-border bg-background p-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary min-h-[100px] resize-y"
                  placeholder={dict.post.writeComment}
                ></textarea>
                <div className="flex justify-end">
                  <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                    {dict.post.postComment}
                  </button>
                </div>
              </div>
            </div>

            <div className="text-center text-muted py-4">
              No comments yet. Be the first to comment!
            </div>
          </div>
          
        </div>
      </div>
    </main>
  );
}
