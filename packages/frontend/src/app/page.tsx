import { headers } from "next/headers";
import { Sidebar } from "../components/layout/Sidebar";
import { MessageSquare, ArrowBigUp } from "lucide-react";
import { Locale, defaultLocale } from "../i18n/config";
import { getDictionary } from "../i18n/get-dictionary";

export default async function Home() {
  const headersList = await headers();
  const locale = (headersList.get('x-locale') || defaultLocale) as Locale;
  const dict = await getDictionary(locale);

  const MOCK_POSTS = dict.home.mockPosts.map((post: any, index: number) => ({
    id: index + 1,
    title: post.title,
    author: post.author,
    category: post.category,
    time: post.time,
    upvotes: [142, 38, 215][index] || 0,
    comments: [24, 12, 89][index] || 0,
    excerpt: post.excerpt
  }));

  return (
    <main className="mx-auto flex max-w-7xl px-4 sm:px-6 lg:px-8">
      <Sidebar dict={dict} />
      
      {/* Main Feed Area */}
      <div className="flex-1 py-6 md:pl-8">
        <div className="mx-auto max-w-3xl space-y-4">
          {MOCK_POSTS.map((post) => (
            <article key={post.id} className="rounded-xl bg-card p-5 shadow-sm transition-shadow hover:shadow-md border border-border/50">
              <div className="mb-3 flex items-center justify-between text-xs text-muted">
                <div className="flex items-center space-x-2">
                  <div className="h-6 w-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold">{post.author[0]}</div>
                  <span className="font-medium text-foreground">{post.author}</span>
                  <span>•</span>
                  <span>{post.time}</span>
                </div>
                <span className="rounded-full bg-background px-2.5 py-0.5 font-medium">
                  {post.category}
                </span>
              </div>
              
              <h2 className="mb-2 text-xl font-bold text-foreground transition-colors hover:text-primary cursor-pointer">
                {post.title}
              </h2>
              <p className="mb-4 text-sm text-muted line-clamp-2">
                {post.excerpt}
              </p>
              
              <div className="flex items-center space-x-4 text-sm font-medium text-muted">
                <button className="flex items-center space-x-1 transition-colors hover:text-primary">
                  <ArrowBigUp className="h-5 w-5" />
                  <span>{post.upvotes}</span>
                </button>
                <button className="flex items-center space-x-1 transition-colors hover:text-primary">
                  <MessageSquare className="h-4 w-4" />
                  <span>{post.comments}</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
