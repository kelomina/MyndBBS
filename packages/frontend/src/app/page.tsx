import { headers } from "next/headers";
import { Sidebar } from "../components/layout/Sidebar";
import { MessageSquare, ArrowBigUp } from "lucide-react";
import { Locale, defaultLocale } from "../i18n/config";
import { getDictionary } from "../i18n/get-dictionary";
import Link from 'next/link';
import { AutoRefresh } from "../components/AutoRefresh";

export const dynamic = 'force-dynamic';

export default async function Home() {
  const headersList = await headers();
  const locale = (headersList.get('x-locale') || defaultLocale) as Locale;
  const dict = await getDictionary(locale);

  let posts = [];
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/posts`, {
      cache: 'no-store'
    });
    if (res.ok) {
      posts = await res.json();
    }
  } catch (error) {
    console.error('Failed to fetch posts:', error);
  }

  return (
    <main className="mx-auto flex max-w-7xl px-4 sm:px-6 lg:px-8">
      <AutoRefresh />
      <Sidebar dict={dict} />
      
      {/* Main Feed Area */}
      <div className="flex-1 py-6 md:pl-8">
        <div className="mx-auto max-w-3xl space-y-4">
          {posts.length === 0 ? (
            <div className="text-center text-muted py-10">
              No posts found.
            </div>
          ) : (
            posts.map((post: any) => (
              <article key={post.id} className="rounded-xl bg-card p-5 shadow-sm transition-shadow hover:shadow-md border border-border/50">
                <div className="mb-3 flex items-center justify-between text-xs text-muted">
                  <div className="flex items-center space-x-2">
                    <Link href={`/u/${post.author?.username}`} className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
                      <div className="h-6 w-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold">
                        {post.author?.username?.[0]?.toUpperCase() || '?'}
                      </div>
                      <span className="font-medium text-foreground">{post.author?.username || 'Unknown'}</span>
                    </Link>
                    <span>•</span>
                    <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                  </div>
                  <span className="rounded-full bg-background px-2.5 py-0.5 font-medium">
                    {post.category?.name || 'Uncategorized'}
                  </span>
                </div>
                
                <h2 className="mb-2 text-xl font-bold text-foreground transition-colors hover:text-primary cursor-pointer">
                  <Link href={`/p/${post.id}`}>{post.title}</Link>
                </h2>
                <p className="mb-4 text-sm text-muted line-clamp-2">
                  {post.content}
                </p>
                
                <div className="flex items-center space-x-4 text-sm font-medium text-muted">
                  <button className="flex items-center space-x-1 transition-colors hover:text-primary">
                    <ArrowBigUp className="h-5 w-5" />
                    <span>0</span>
                  </button>
                  <button className="flex items-center space-x-1 transition-colors hover:text-primary">
                    <MessageSquare className="h-4 w-4" />
                    <span>0</span>
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
