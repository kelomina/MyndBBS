import Link from 'next/link'
import { headers } from 'next/headers'
import { Sidebar } from '../../components/layout/Sidebar'
import { Locale, defaultLocale } from '../../i18n/config'
import { getPublicDictionary } from '../../i18n/public-dictionary'
import { serverFetch } from '../../lib/bff/serverApi'

export const dynamic = 'force-dynamic'

export default async function JournalsPage() {
  const locale = ((await headers()).get('x-locale') || defaultLocale) as Locale
  const dict = await getPublicDictionary(locale)
  let journals: Array<{ id: string; slug: string; name: string; description: string | null }> = []
  try { const response = await serverFetch('/api/journals'); if (response.ok) journals = await response.json() } catch { /* public page remains usable when API is unavailable */ }
  return <main className="mx-auto flex max-w-7xl px-4 sm:px-6 lg:px-8"><Sidebar dict={dict} /><div className="flex-1 py-6 md:pl-8"><div className="mx-auto max-w-3xl space-y-4"><h1 className="text-2xl font-bold">{dict.common?.journals || 'Journals'}</h1>{journals.length === 0 ? <p className="text-muted">No journals available.</p> : journals.map((journal) => <Link key={journal.id} href={`/journals/${encodeURIComponent(journal.slug)}`} className="block rounded-xl border border-border bg-white p-5 hover:shadow-sm"><h2 className="font-semibold">{journal.name}</h2>{journal.description && <p className="mt-1 text-sm text-muted">{journal.description}</p>}</Link>)}</div></div></main>
}
