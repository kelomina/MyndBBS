import { headers } from 'next/headers';
import Link from 'next/link';
import { Locale, defaultLocale } from '../../i18n/config';
import { getDictionary } from '../../i18n/get-dictionary';
import { Sidebar } from '../../components/layout/Sidebar';
import { TagsRateLimitIsland } from '../../components/TagsRateLimitIsland';
import { serverFetch } from '../../lib/bff/serverApi';
import { getSsrRateLimitInfo } from '../../lib/rate-limit/ssr-rate-limit';

export const dynamic = 'force-dynamic';

interface TagItem {
  name: string;
  postCount: number;
}

async function getTags(): Promise<{ tags: TagItem[]; rateLimited: { retryAfterSec: number } | null }> {
  try {
    const res = await serverFetch('/api/tags');
    if (res.ok) {
      const data = await res.json();
      return { tags: Array.isArray(data.tags) ? data.tags : [], rateLimited: null };
    }
    const rateLimited = await getSsrRateLimitInfo(res);
    return { tags: [], rateLimited };
  } catch {
    return { tags: [], rateLimited: null };
  }
}

export default async function TagsPage() {
  const { tags, rateLimited } = await getTags();
  const headersList = await headers();
  const locale = (headersList.get('x-locale') || defaultLocale) as Locale;
  const dict = await getDictionary(locale);

  return (
    <main className="mx-auto flex max-w-7xl px-4 sm:px-6 lg:px-8">
      <Sidebar dict={dict} />
      <div className="flex-1 py-6 md:pl-8">
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-2 text-3xl font-bold text-foreground">{dict.tags?.title || 'Topics'}</h1>
          <p className="mb-8 text-muted">{dict.tags?.subtitle || 'Browse conversations by topic tag.'}</p>

          {rateLimited ? (
            <TagsRateLimitIsland initialRetryAfterSec={rateLimited.retryAfterSec} dict={dict} />
          ) : tags.length === 0 ? (
            <div data-testid="empty-state" className="rounded-xl border border-border bg-card p-10 text-center text-muted">
              {dict.tags?.empty || 'No tags yet'}
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {tags.map((tag) => (
                <Link
                  key={tag.name}
                  href={`/tags/${encodeURIComponent(tag.name)}`}
                  className="group rounded-xl border border-border bg-card px-5 py-4 shadow-sm transition-colors hover:border-primary/50"
                >
                  <div className="text-lg font-semibold text-primary group-hover:underline"># {tag.name}</div>
                  <div className="text-xs text-muted">
                    {(dict.tags?.postCount || '{count} posts').replace('{count}', String(tag.postCount))}
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
