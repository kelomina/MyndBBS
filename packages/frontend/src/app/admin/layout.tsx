import React from 'react';
import Link from 'next/link';
import { useTranslation } from '../../components/TranslationProvider';
import { getDictionary } from '../../i18n/get-dictionary';
import { defaultLocale, Locale } from '../../i18n/config';
import { headers, cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ShieldCheck, Users, FolderTree, LayoutDashboard, Trash2, Database, ShieldAlert } from 'lucide-react';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const locale = (headersList.get('x-locale') || defaultLocale) as Locale;
  const dict = await getDictionary(locale);

  // Route protection
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');

  try {
    const response = await fetch('http://localhost:3001/api/v1/user/profile', {
      headers: {
        Cookie: allCookies
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      redirect('/login');
    }

    const data = await response.json();
    if (!data.user || (data.user.role !== 'SUPER_ADMIN' && data.user.role !== 'ADMIN' && data.user.role !== 'MODERATOR')) {
      redirect('/');
    }

    const isSuperAdmin = data.user.role === 'SUPER_ADMIN';

    return (
      <div className="flex min-h-screen w-full bg-background">
        {/* Sidebar */}
        <aside className="hidden w-64 flex-col border-r border-border bg-card sm:flex">
          <div className="flex h-16 items-center px-6 border-b border-border">
            <Link href="/admin" className="text-xl font-bold tracking-tight text-primary">
              Admin Panel
            </Link>
          </div>
          <nav className="flex-1 space-y-1 px-4 py-4">
            <Link
              href="/admin/users"
              className="flex items-center space-x-3 rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <Users className="h-5 w-5" />
              <span>{dict.admin?.users || "Users"}</span>
            </Link>
            <Link
              href="/admin/categories"
              className="flex items-center space-x-3 rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <FolderTree className="h-5 w-5" />
              <span>{dict.admin?.categories || "Categories"}</span>
            </Link>
            <Link
              href="/admin/moderation"
              className="flex items-center space-x-3 rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <ShieldAlert className="h-5 w-5" />
              <span>{dict.admin?.moderation || "Moderation"}</span>
            </Link>
            <Link
              href="/admin/recycle"
              className="flex items-center space-x-3 rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <Trash2 className="h-5 w-5" />
              <span>{dict.admin?.recycleBin || "Recycle Bin"}</span>
            </Link>
            {isSuperAdmin && (
              <Link
                href="/admin/routes"
                className="flex items-center space-x-3 rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <ShieldCheck className="h-5 w-5" />
                <span>{dict.admin?.routingWhitelist || "Routing Whitelist"}</span>
              </Link>
            )}
            {isSuperAdmin && (
              <Link
                href="/admin/db"
                className="flex items-center space-x-3 rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <Database className="h-5 w-5" />
                <span>{dict.admin?.database || "Database"}</span>
              </Link>
            )}
          </nav>
        </aside>

        <div className="flex flex-1 flex-col">
          {/* Header */}
          <header className="sticky top-0 z-40 flex h-16 items-center border-b border-border bg-background/80 px-6 backdrop-blur-md">
            <div className="flex items-center sm:hidden">
              <Link href="/admin" className="text-lg font-bold text-primary">
                Admin
              </Link>
            </div>
            <div className="hidden sm:block text-sm font-medium text-muted-foreground">
              {dict.admin?.dashboard || "Dashboard"}
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-6">
            {children}
          </main>
        </div>
      </div>
    );
  } catch (error) {
    redirect('/');
  }
}
