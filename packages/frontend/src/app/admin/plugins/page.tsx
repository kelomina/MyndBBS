import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { serverFetch } from '../../../lib/bff/serverApi'
import PluginAdminClient from './PluginAdminClient'

export default async function PluginsPage() {
  const cookieStore = await cookies()
  const cookieHeader = cookieStore.getAll().map((cookie) => `${cookie.name}=${cookie.value}`).join('; ')
  const response = await serverFetch('/api/v1/user/profile', { headers: { Cookie: cookieHeader } }).catch(() => null)
  if (!response?.ok) notFound()
  const data = await response.json() as { user?: { role?: string } }
  if (data.user?.role !== 'ADMIN' && data.user?.role !== 'SUPER_ADMIN') notFound()
  return <PluginAdminClient />
}
