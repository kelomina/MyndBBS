import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { serverApiUrl } from '../../lib/bff/serverApi';

export default async function AdminPage() {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll().map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');

  let response: Response;
  try {
    response = await fetch(serverApiUrl('/api/v1/user/profile'), {
      headers: { Cookie: allCookies },
      cache: 'no-store',
    });
  } catch {
    redirect('/');
  }

  if (!response.ok) {
    redirect('/login');
  }

  let data: { user?: { role?: 'SUPER_ADMIN' | 'ADMIN' | 'MODERATOR' | string } };
  try {
    data = await response.json() as typeof data;
  } catch {
    redirect('/');
  }

  if (data.user?.role === 'MODERATOR') {
    redirect('/admin/moderation');
  }

  if (data.user?.role === 'SUPER_ADMIN' || data.user?.role === 'ADMIN') {
    redirect('/admin/users');
  }

  redirect('/');
}
