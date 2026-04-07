import { Sidebar } from "../../../components/layout/Sidebar";
import { MessageSquare, ArrowBigUp, Bookmark, Share } from "lucide-react";
import { headers } from "next/headers";
import { Locale, defaultLocale } from "../../../i18n/config";
import { getDictionary } from "../../../i18n/get-dictionary";

export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // TODO: Fetch post using id
  console.log("Fetching post:", id);
  const headersList = await headers();
  const locale = (headersList.get('x-locale') || defaultLocale) as Locale;
  const dict = await getDictionary(locale);

  return (
    <main className="mx-auto flex max-w-7xl px-4 sm:px-6 lg:px-8">
      <Sidebar dict={dict} />
      
      <div className="flex-1 py-6 md:pl-8">
        <div className="mx-auto max-w-3xl">
          {/* Post Content */}
          <article className="rounded-xl bg-card p-6 shadow-sm border border-border/50 mb-6">
            <div className="mb-6 flex items-center justify-between text-sm text-muted">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-lg">A</div>
                <div>
                  <div className="font-medium text-foreground">Admin</div>
                  <div className="text-xs">2 hours ago</div>
                </div>
              </div>
              <span className="rounded-full bg-background px-3 py-1 font-medium border border-border">
                Announcements
              </span>
            </div>
            
            <h1 className="mb-6 text-3xl font-bold text-foreground">
              Welcome to MyndBBS! Here is our design philosophy.
            </h1>
            
            <div className="prose dark:prose-invert max-w-none text-foreground space-y-4">
              <p>We are building a clean, light, and secure forum. In this post, we discuss why we chose Next.js and how we implemented WebAuthn for passwordless login.</p>
              <p>Our philosophy is simple: Content first, distractions second. We use plenty of whitespace, soft shadows, and careful typography to make reading a joy.</p>
              <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto text-sm">
                <code>console.log(&quot;Hello World&quot;);</code>
              </pre>
            </div>
            
            <div className="mt-8 flex items-center justify-between border-t border-border pt-4">
              <div className="flex items-center space-x-6 text-muted">
                <button className="flex items-center space-x-2 transition-colors hover:text-primary">
                  <ArrowBigUp className="h-6 w-6" />
                  <span className="font-medium">142</span>
                </button>
                <button className="flex items-center space-x-2 transition-colors hover:text-primary">
                  <MessageSquare className="h-5 w-5" />
                  <span className="font-medium">24</span>
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
            <h3 className="text-lg font-bold text-foreground mb-4">{dict.post.comments} (24)</h3>
            
            {/* Comment Input */}
            <div className="rounded-xl bg-card p-4 shadow-sm border border-border/50 flex gap-4">
              <div className="h-8 w-8 shrink-0 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-xs mt-1">U</div>
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

            {/* Mock Comment */}
            <div className="rounded-xl bg-card p-5 shadow-sm border border-border/50">
              <div className="flex space-x-3">
                <div className="h-8 w-8 shrink-0 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-xs">D</div>
                <div>
                  <div className="flex items-baseline space-x-2">
                    <span className="font-medium text-foreground text-sm">DevGuy</span>
                    <span className="text-xs text-muted">1 {dict.post.hoursAgo}</span>
                  </div>
                  <p className="mt-1 text-sm text-foreground">
                    This looks amazing! The dark mode support is exactly what I was hoping for.
                  </p>
                  <div className="mt-2 flex items-center space-x-4 text-xs text-muted font-medium">
                    <button className="hover:text-primary">{dict.post.reply}</button>
                    <button className="hover:text-primary flex items-center gap-1"><ArrowBigUp className="h-4 w-4" /> 12</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </main>
  );
}
