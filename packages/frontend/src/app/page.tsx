import { headers } from "next/headers";
import { Sidebar } from "../components/layout/Sidebar";
import { Locale, defaultLocale } from "../i18n/config";
import { getDictionary } from "../i18n/get-dictionary";

import { PostList } from '../components/PostList';

import { AutoRefresh } from "../components/AutoRefresh";
import { getPostListEmptyMessage } from "../lib/utils";

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
          <PostList posts={posts} emptyMessage={getPostListEmptyMessage('general', dict)} dict={dict} />
        </div>
      </div>
    </main>
  );
}
