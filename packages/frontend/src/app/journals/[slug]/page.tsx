import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { Sidebar } from '../../../components/layout/Sidebar'
import { getPublicDictionary } from '../../../i18n/public-dictionary'
import { defaultLocale, Locale } from '../../../i18n/config'
import { serverFetch } from '../../../lib/bff/serverApi'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function JournalDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const locale = ((await headers()).get('x-locale') || defaultLocale) as Locale
  const dict = await getPublicDictionary(locale)
  let journal: { name: string; description: string | null } | null = null
  try { const response = await serverFetch(`/api/journals/by-slug/${encodeURIComponent(decodeURIComponent(slug))}`); if (response.ok) journal = await response.json() } catch { /* handled as not found */ }
  if (!journal) notFound()
  return <main className="mx-auto flex max-w-7xl px-4 sm:px-6 lg:px-8"><Sidebar dict={dict} /><div className="flex-1 py-6 md:pl-8"><article className="mx-auto max-w-3xl rounded-xl border border-border bg-white p-6"><h1 className="text-3xl font-bold">{journal.name}</h1>{journal.description && <p className="mt-3 text-muted">{journal.description}</p>}<div className="mt-8"><Link href={`/journals/${encodeURIComponent(slug)}/submit`} className="rounded bg-primary px-4 py-2 text-white">提交稿件</Link></div></article></div></main>
}
