import { headers } from "next/headers";
import { Sidebar } from "../../components/layout/Sidebar";
import { Locale, defaultLocale } from "../../i18n/config";
import { getDictionary } from "../../i18n/get-dictionary";
import { PostList } from '../../components/PostList';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const headersList = await headers();
  const locale = (headersList.get('x-locale') || defaultLocale) as Locale;
  const dict = await getDictionary(locale);
  
  const resolvedParams = await searchParams;
  const q = resolvedParams.q || '';

  let posts = [];
  let users = [];

  if (q) {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/search?q=${encodeURIComponent(q)}`, {
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        posts = data.posts || [];
        users = data.users || [];
      }
    } catch (error) {
      console.error('Failed to fetch search results:', error);
    }
  }

  const resultsTitle = dict.search.resultsFor.replace('{q}', q);

  return (
    <main className="mx-auto flex max-w-7xl px-4 sm:px-6 lg:px-8">
      <Sidebar dict={dict} />
      
      {/* Main Content Area */}
      <div className="flex-1 py-6 md:pl-8">
        <div className="mx-auto max-w-3xl space-y-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">
              {q ? resultsTitle : dict.search.search}
            </h1>
          </div>

          {q && posts.length === 0 && users.length === 0 && (
            <div className="text-center text-muted py-10">
              {dict.search.noResults}
            </div>
          )}

          {users.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-foreground border-b border-border pb-2">{dict.search.users}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {users.map((user: any) => (
                  <Link key={user.id} href={`/u/${user.username}`} className="block">
                    <div className="flex items-center space-x-3 rounded-xl bg-card p-4 shadow-sm transition-shadow hover:shadow-md border border-border/50">
                      <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-lg">
                        {user.username?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <div className="font-medium text-foreground">{user.username}</div>
                        <div className="text-xs text-muted">Lv.{user.level}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {posts.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-foreground border-b border-border pb-2">{dict.search.posts}</h2>
              <PostList posts={posts} dict={dict} emptyMessage={dict.search.noResults} />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}