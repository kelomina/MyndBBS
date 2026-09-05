import { headers } from 'next/headers'
import { Sidebar } from '../../components/layout/Sidebar'
import { Locale, defaultLocale } from '../../i18n/config'
import { getPublicDictionary } from '../../i18n/public-dictionary'

import { PostList } from '../../components/PostList'
import { PostListRateLimitIsland } from '../../components/PostListRateLimitIsland'

import { AutoRefresh } from '../../components/AutoRefresh'
import { getPostListEmptyMessage } from '../../lib/utils'
import { serverFetch } from '../../lib/bff/serverApi'
import { getSsrRateLimitInfo } from '../../lib/rate-limit/ssr-rate-limit'

export const dynamic = 'force-dynamic'

export default async function RecentPage() {
  const headersList = await headers()
  const locale = (headersList.get('x-locale') || defaultLocale) as Locale
  const dict = await getPublicDictionary(locale)

  let posts = []
  let rateLimited: { retryAfterSec: number } | null = null
  try {
    const res = await serverFetch('/api/posts?sortBy=latest')
    if (res.ok) {
      posts = await res.json()
    } else {
      rateLimited = await getSsrRateLimitInfo(res)
    }
  } catch (error) {
    console.error('Failed to fetch recent posts:', error)
  }

  return (
    <main className="mx-auto flex max-w-7xl px-4 sm:px-6 lg:px-8">
      <AutoRefresh paused={!!rateLimited} />
      <Sidebar dict={dict} />

      <div className="flex-1 py-6 md:pl-8">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">
              {dict.nav?.recent || 'Recent Posts'}
            </h1>
            <p className="text-sm text-muted">
              {dict.home?.recentDesc || 'Showing the newest posts on the platform'}
            </p>
          </div>

          {rateLimited ? (
            <PostListRateLimitIsland
              initialRetryAfterSec={rateLimited.retryAfterSec}
              bffUrl="/api/posts?sortBy=latest"
              emptyMessage={getPostListEmptyMessage('recent', dict)}
              dict={dict}
            />
          ) : (
            <PostList
              posts={posts}
              emptyMessage={getPostListEmptyMessage('recent', dict)}
              dict={dict}
            />
          )}
        </div>
      </div>
    </main>
  )
}
