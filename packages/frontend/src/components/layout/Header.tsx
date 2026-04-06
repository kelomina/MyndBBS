import Link from 'next/link';
import { Search, User, PenSquare } from 'lucide-react';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center">
          <Link href="/" className="text-xl font-bold tracking-tight text-primary">
            MyndBBS
          </Link>
        </div>
        
        <div className="flex flex-1 items-center justify-center px-8">
          <div className="relative w-full max-w-md hidden sm:block">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-muted" />
            </div>
            <input
              type="search"
              className="block w-full rounded-full border border-border bg-background py-2 pl-10 pr-3 text-sm placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Search community..."
            />
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <Link 
            href="/compose" 
            className="hidden sm:flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <PenSquare className="mr-2 h-4 w-4" />
            New Post
          </Link>
          <Link 
            href="/login"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted transition-colors hover:bg-background hover:text-foreground"
          >
            <User className="h-5 w-5" />
            <span className="sr-only">Account</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
