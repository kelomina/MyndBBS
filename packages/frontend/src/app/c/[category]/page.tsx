import { headers } from "next/headers";
import { Sidebar } from "../../../components/layout/Sidebar";
import { MessageSquare, ArrowBigUp } from "lucide-react";
import { Locale, defaultLocale } from "../../../i18n/config";
import { getDictionary } from "../../../i18n/get-dictionary";
import Link from 'next/link';

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const headersList = await headers();
  const locale = (headersList.get('x-locale') || defaultLocale) as Locale;
  const dict = await getDictionary(locale);
  const resolvedParams = await params;
  const category = resolvedParams.category;

  let posts = [];
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/posts?category=${category}`, {
      cache: 'no-store'
    });
    if (res.ok) {
      posts = await res.json();
    }
  } catch (error) {
    console.error('Failed to fetch posts:', error);
  }

  // Capitalize category name for display
  const categoryTitle = dict.common[`category${category.charAt(0).toUpperCase() + category.slice(1)}` as keyof typeof dict.common] || category;

  return (
    <main className="mx-auto flex max-w-7xl px-4 sm:px-6 lg:px-8">
      <Sidebar dict={dict} />
      
      {/* Main Feed Area */}
      <div className="flex-1 py-6 md:pl-8">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground capitalize">{categoryTitle} Posts</h1>
            <p className="text-sm text-muted">Showing posts for category: {categoryTitle}</p>
          </div>

          {posts.length === 0 ? (
            <div className="text-center text-muted py-10">
              No posts found in this category.
            </div>
          ) : (
            posts.map((post: any) => (
              <article key={post.id} className="rounded-xl bg-card p-5 shadow-sm transition-shadow hover:shadow-md border border-border/50">
                <div className="mb-3 flex items-center justify-between text-xs text-muted">
                  <div className="flex items-center space-x-2">
                    <div className="h-6 w-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold">
                      {post.author?.username?.[0]?.toUpperCase() || '?'}
                    </div>
                    <span className="font-medium text-foreground">{post.author?.username || 'Unknown'}</span>
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