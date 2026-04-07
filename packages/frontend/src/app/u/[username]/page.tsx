import { Calendar } from 'lucide-react';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { Locale, defaultLocale } from '../../../i18n/config';
import { getDictionary } from '../../../i18n/get-dictionary';

async function getProfile(username: string) {
  // Using localhost:3001 for server-side fetch to backend
  const res = await fetch(`http://localhost:3001/api/v1/user/public/${username}`, {
    cache: 'no-store' // or next: { revalidate: 60 }
  });
  if (!res.ok) {
    return null;
  }
  const data = await res.json();
  return data.user;
}

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  // Need to await params in Next.js 15+
  const resolvedParams = await params;
  const username = resolvedParams.username;
  const user = await getProfile(username);

  const headersList = await headers();
  const locale = (headersList.get('x-locale') || defaultLocale) as Locale;
  const dict = await getDictionary(locale);

  if (!user) {
    notFound();
  }

  const joinDate = new Date(user.createdAt).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="h-48 w-full bg-gradient-to-r from-primary/40 to-blue-500/40"></div>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="relative -mt-16 sm:-mt-24 mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-6">
            <div className="h-32 w-32 rounded-full border-4 border-background bg-card flex items-center justify-center text-4xl font-bold text-muted shadow-sm uppercase">
              {user.username[0]}
            </div>
            <div className="pb-2">
              <h1 className="text-3xl font-bold text-foreground">{user.username}</h1>
              <p className="text-muted text-sm capitalize">{user.role}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-1/3 space-y-6">
            <div className="rounded-xl bg-card p-5 shadow-sm border border-border/50 space-y-4">
              <div className="space-y-2 text-sm text-muted">
                <div className="flex items-center gap-2"><Calendar className="h-4 w-4" /> {dict.profile.joined} {joinDate}</div>
              </div>
              <div className="flex gap-4 pt-4 border-t border-border">
                <div><span className="font-bold text-foreground">{user._count.posts}</span> <span className="text-muted text-sm">{dict.profile.posts}</span></div>
              </div>
            </div>
          </div>

          <div className="w-full md:w-2/3">
            <div className="border-b border-border mb-6">
              <nav className="-mb-px flex space-x-8">
                <span className="border-primary text-primary whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium">{dict.profile.posts} ({user._count.posts})</span>
              </nav>
            </div>

            <div className="space-y-4">
              {user.posts.length === 0 ? (
                <p className="text-muted text-sm">{dict.profile.noPostsYet}</p>
              ) : (
                user.posts.map((post: { id: string; title: string; content: string; createdAt: string; category?: { name: string } }) => (
                  <div key={post.id} className="rounded-xl bg-card p-5 shadow-sm border border-border/50 transition-shadow hover:shadow-md cursor-pointer">
                    <h2 className="text-lg font-bold text-foreground mb-2">{post.title}</h2>
                    <p className="text-sm text-muted mb-4 line-clamp-2">{post.content}</p>
                    <div className="flex items-center text-xs text-muted gap-4">
                      <span>{post.category?.name || dict.profile.uncategorized}</span>
                      <span>•</span>
                      <span>{new Date(post.createdAt).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US')}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
