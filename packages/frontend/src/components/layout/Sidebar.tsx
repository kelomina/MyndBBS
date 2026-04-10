"use client";

import Link from 'next/link';
import { Home, TrendingUp, Clock, Hash } from 'lucide-react';
import { useCategories } from '../../lib/hooks';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function Sidebar({ dict }: { dict: any }) {
  const MAIN_NAV = [
    { name: dict.nav.home, href: '/', icon: Home },
    { name: dict.nav.popular, href: '/popular', icon: TrendingUp },
    { name: dict.nav.recent, href: '/recent', icon: Clock },
  ];

  const { categories, loading } = useCategories();

  return (
    <aside className="hidden w-64 shrink-0 md:block">
      <div className="sticky top-20 flex flex-col gap-8 py-6 pr-6">
        
        <nav className="flex flex-col gap-1">
          {MAIN_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-white hover:shadow-sm"
              >
                <Icon className="h-4 w-4 text-muted" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div>
          <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted">
            {dict.common.categories}
          </h3>
          <nav className="flex flex-col gap-1">
            {loading ? (
              <div className="px-3 py-2 text-sm text-muted">{dict.common.loading}</div>
            ) : categories.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted">{dict.category.noCategories || 'No categories available.'}</div>
            ) : (
              categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/c/${encodeURIComponent(category.name)}`}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-white hover:text-foreground hover:shadow-sm"
                >
                  <Hash className="h-4 w-4 opacity-50" />
                  {dict.common[`category${category.name.charAt(0).toUpperCase() + category.name.slice(1)}` as keyof typeof dict.common] || category.name}
                </Link>
              ))
            )}
          </nav>
        </div>
        
      </div>
    </aside>
  );
}
