
import { headers } from "next/headers";
import { Sidebar } from "../../../components/layout/Sidebar";
import { Locale, defaultLocale } from "../../../i18n/config";
import { getDictionary } from "../../../i18n/get-dictionary";

import { PostList } from '../../../components/PostList';
import { AutoRefresh } from "../../../components/AutoRefresh";
import { getCategoryTranslation, getPostListEmptyMessage } from '../../../lib/utils';

export const dynamic = 'force-dynamic';

/**
 * Callers: []
 * Callees: [headers, get, getDictionary, decodeURIComponent, fetch, encodeURIComponent, json, error, getCategoryTranslation, getPostListEmptyMessage]
 * Description: Handles the category page logic for the application.
 * Keywords: categorypage, category, page, auto-annotated
 */
export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const headersList = await headers();
  const locale = (headersList.get('x-locale') || defaultLocale) as Locale;
  const dict = await getDictionary(locale);
  const resolvedParams = await params;
  const rawCategory = resolvedParams.category;
  const decodedCategory = decodeURIComponent(rawCategory);

  let posts = [];
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/posts?category=${encodeURIComponent(decodedCategory)}`, {
      cache: 'no-store'
    });
    if (res.ok) {
      posts = await res.json();
    }
  } catch (error) {
    console.error('Failed to fetch posts:', error);
  }

  // Capitalize category name for display
  const categoryTitle = getCategoryTranslation(decodedCategory, dict);

  return (
    <main className="mx-auto flex max-w-7xl px-4 sm:px-6 lg:px-8">
      <AutoRefresh />
      <Sidebar dict={dict} />
      
      {/* Main Feed Area */}
      <div className="flex-1 py-6 md:pl-8">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground capitalize">{categoryTitle} {dict.category?.postsTitle}</h1>
            <p className="text-sm text-muted">{dict.category?.showingPostsFor}{categoryTitle}</p>
          </div>

          <PostList posts={posts} emptyMessage={getPostListEmptyMessage('category', dict)} dict={dict} />
        </div>
      </div>
    </main>
  );
}
