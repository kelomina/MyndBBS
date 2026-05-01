"use client";

import { Search } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

interface SearchInputProps {
  placeholder: string;
}

function SearchInputInner({ placeholder }: SearchInputProps) {
  const searchParams = useSearchParams();
  const q = searchParams.get('q') || '';

  return (
    <form action="/search" method="GET" className="relative w-full">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
        <Search className="h-4 w-4 text-muted" suppressHydrationWarning />
      </div>
      <input
        name="q"
        type="search"
        defaultValue={q}
        className="block w-full rounded-full border border-border bg-background py-2 pl-10 pr-3 text-sm text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        placeholder={placeholder}
        required
      />
    </form>
  );
}

export function SearchInput({ placeholder }: SearchInputProps) {
  return (
    <div className="relative w-full max-w-md hidden sm:block">
      <Suspense fallback={
        <form action="/search" method="GET" className="relative w-full">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-4 w-4 text-muted" suppressHydrationWarning />
          </div>
          <input
            name="q"
            type="search"
            className="block w-full rounded-full border border-border bg-background py-2 pl-10 pr-3 text-sm text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder={placeholder}
            required
          />
        </form>
      }>
        <SearchInputInner placeholder={placeholder} />
      </Suspense>
    </div>
  );
}
