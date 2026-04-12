import { headers } from "next/headers";
import { Sidebar } from "../../components/layout/Sidebar";
import { Locale, defaultLocale } from "../../i18n/config";
import { getDictionary } from "../../i18n/get-dictionary";

import { PostList } from '../../components/PostList';

import { AutoRefresh } from "../../components/AutoRefresh";
import { getPostListEmptyMessage } from "../../lib/utils";

export const dynamic = 'force-dynamic';

/**
 * Callers: []
 * Callees: [headers, get, getDictionary, fetch, json, error, getPostListEmptyMessage]
 * Description: Handles the recent page logic for the application.
 * Keywords: recentpage, recent, page, auto-annotated
 */
export default async function RecentPage() {
  const headersList = await headers();
  const locale = (headersList.get('x-locale') || defaultLocale) as Locale;
  const dict = await getDictionary(locale);

  let posts = [];
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/posts?sortBy=latest`, {
      cache: 'no-store'
    });
    if (res.ok) {
      posts = await res.json();
    }
  } catch (error) {
    console.error('Failed to fetch recent posts:', error);
  }

  return (
    <main className="mx-auto flex max-w-7xl px-4 sm:px-6 lg:px-8">
      <AutoRefresh />
      <Sidebar dict={dict} />
      
      <div className="flex-1 py-6 md:pl-8">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">{dict.nav?.recent || 'Recent Posts'}</h1>
            <p className="text-sm text-muted">{dict.home?.recentDesc || "Showing the newest posts on the platform"}</p>
          </div>

          <PostList posts={posts} emptyMessage={getPostListEmptyMessage('recent', dict)} dict={dict} />
        </div>
      </div>
    </main>
  );
}
