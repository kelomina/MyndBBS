import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export default async function AdminPage() {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll().map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
  const apiOrigin = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';

  let response: Response;
  try {
    response = await fetch(`${apiOrigin}/api/v1/user/profile`, {
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
