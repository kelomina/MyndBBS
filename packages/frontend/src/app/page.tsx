import { headers } from "next/headers";
import { Sidebar } from "../components/layout/Sidebar";
import { MessageSquare, ArrowBigUp } from "lucide-react";
import { Locale, defaultLocale } from "../i18n/config";
import { getDictionary } from "../i18n/get-dictionary";

const MOCK_POSTS = [
  { id: 1, title: "Welcome to MyndBBS! Here is our design philosophy.", author: "Admin", category: "Announcements", time: "2h ago", upvotes: 142, comments: 24, excerpt: "We are building a clean, light, and secure forum. In this post, we discuss why we chose Next.js and how we implemented WebAuthn for passwordless login." },
  { id: 2, title: "How to properly type Prisma queries in a monorepo?", author: "DevGuy", category: "Technology", time: "5h ago", upvotes: 38, comments: 12, excerpt: "I'm struggling with sharing Prisma types between my backend and frontend packages. Does anyone have a good pattern for this?" },
  { id: 3, title: "Share your minimal desk setups for 2026", author: "Minimalist", category: "Life", time: "1d ago", upvotes: 215, comments: 89, excerpt: "Since we're all about that clean/light aesthetic here, let's see where you write your code. Post your desk photos below!" },
];

export default async function Home() {
  const headersList = await headers();
  const locale = (headersList.get('x-locale') || defaultLocale) as Locale;
  const dict = await getDictionary(locale);

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
