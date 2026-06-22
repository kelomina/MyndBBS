import { Calendar } from 'lucide-react';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { Locale, defaultLocale } from '../../../i18n/config';
import { getDictionary } from '../../../i18n/get-dictionary';
import { ProfileTabs } from './ProfileTabs';
import { OwnerSettingsButton } from './OwnerSettingsButton';
import { Avatar } from '../../../components/Avatar';
import { serverApiUrl } from '../../../lib/bff/serverApi';

async function getProfile(username: string) {
  const res = await fetch(serverApiUrl(`/api/v1/user/public/${username}`), {
    cache: 'no-store'
  });
  if (!res.ok) {
    return null;
  }
  const data = await res.json();
  return data.user;
}

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  // Need to await params in Next.js 15+
  const resolvedParams = await params;
  const username = resolvedParams.username;
  const user = await getProfile(username);

  const headersList = await headers();
  const locale = (headersList.get('x-locale') || defaultLocale) as Locale;
  const dict = await getDictionary(locale);

  if (!user) {
    notFound();
  }

  const joinDate = new Date(user.createdAt).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="h-48 w-full bg-gradient-to-r from-primary/40 to-blue-500/40"></div>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="relative -mt-16 sm:-mt-24 mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-6">
            <Avatar src={user.avatarUrl} username={user.username} size={128} className="border-4 border-background shadow-sm" />
            <div className="pb-2">
              <h1 className="text-3xl font-bold text-foreground">{user.username}</h1>
              <p className="text-muted text-sm capitalize">{user.role}</p>
            </div>
          </div>
          <div className="pb-2">
            <OwnerSettingsButton username={user.username} userId={user.id} />
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-1/3 space-y-6">
            <div className="rounded-xl bg-card p-5 shadow-sm border border-border/50 space-y-4">
              <div className="space-y-2 text-sm text-muted">
                <div className="flex items-center gap-2"><Calendar className="h-4 w-4" /> {dict.profile.joined} {joinDate}</div>
              </div>
              <div className="flex gap-4 pt-4 border-t border-border">
                <div><span className="font-bold text-foreground">{user._count.posts}</span> <span className="text-muted text-sm">{dict.profile.posts}</span></div>
              </div>
            </div>
          </div>

          <div className="w-full md:w-2/3">
            <ProfileTabs user={user} dict={dict} locale={locale} />
          </div>
        </div>
      </div>
    </div>
  );
}
