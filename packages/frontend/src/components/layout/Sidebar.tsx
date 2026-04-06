import Link from 'next/link';
import { Home, TrendingUp, Clock, Hash } from 'lucide-react';

const MAIN_NAV = [
  { name: 'Home', href: '/', icon: Home },
  { name: 'Popular', href: '/popular', icon: TrendingUp },
  { name: 'Recent', href: '/recent', icon: Clock },
];

const CATEGORIES = [
  { name: 'Technology', href: '/c/tech' },
  { name: 'Life', href: '/c/life' },
  { name: 'Q&A', href: '/c/qa' },
];

export function Sidebar() {
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
            Categories
          </h3>
          <nav className="flex flex-col gap-1">
            {CATEGORIES.map((category) => (
              <Link
                key={category.name}
                href={category.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-white hover:text-foreground hover:shadow-sm"
              >
                <Hash className="h-4 w-4 opacity-50" />
                {category.name}
              </Link>
            ))}
          </nav>
        </div>
        
      </div>
    </aside>
  );
}
