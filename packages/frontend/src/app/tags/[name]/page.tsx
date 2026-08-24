import Link from 'next/link';
import { headers } from 'next/headers';
import { Locale, defaultLocale } from '../../../i18n/config';
import { getDictionary } from '../../../i18n/get-dictionary';
import { Sidebar } from '../../../components/layout/Sidebar';
import { serverApiUrl } from '../../../lib/bff/serverApi';

export const dynamic = 'force-dynamic';

interface PostItem {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  author?: { username?: string | null };
  category?: { name?: string };
}

async function getPostsByTag(tag: string): Promise<PostItem[]> {
  try {
    const res = await fetch(serverApiUrl(`/api/posts?tag=${encodeURIComponent(tag)}`), {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export default async function TagDetailPage({ params }: { params: Promise<{ name: string }> }) {
  const resolved = await params;
  const tagName = decodeURIComponent(resolved.name);
  const posts = await getPostsByTag(tagName);

  const headersList = await headers();
  const locale = (headersList.get('x-locale') || defaultLocale) as Locale;
  const dict = await getDictionary(locale);

  return (
    <main className="mx-auto flex max-w-7xl px-4 sm:px-6 lg:px-8">
      <Sidebar dict={dict} />
      <div className="flex-1 py-6 md:pl-8">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/tags"
            className="mb-4 inline-block text-sm font-medium text-muted hover:text-foreground"
          >
            &larr; {dict.tags?.backToTags || 'All tags'}
          </Link>

          <h1 className="mb-8 text-3xl font-bold text-foreground"># {tagName}</h1>

          {posts.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-10 text-center text-muted">
              {dict.tags?.noPosts || 'No posts with this tag yet'}
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  href={`/p/${post.id}`}
                  className="block rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/50"
                >
                  <h2 className="text-lg font-semibold text-foreground">{post.title}</h2>
                  <p className="mt-2 line-clamp-2 text-sm text-muted">
                    {post.content.slice(0, 160)}
                  </p>
                  <div className="mt-3 flex items-center gap-3 text-xs text-muted">
                    {post.author?.username && <span>@{post.author.username}</span>}
                    {post.category?.name && (
                      <span className="rounded-full bg-muted/40 px-2 py-0.5">{post.category.name}</span>
                    )}
                    <span>{new Date(post.createdAt).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US')}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
