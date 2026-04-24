'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslation } from './TranslationProvider';

export function ThemeToggle() {
  const dict = useTranslation();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    const timerId = window.setTimeout(() => {
      setMounted(true);
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, []);
  if (!mounted) return <div className="h-9 w-9" />;

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted transition-colors hover:bg-background hover:text-foreground"
      title={dict.common.toggleTheme}
    >
      {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      <span className="sr-only">{dict.common.toggleTheme}</span>
    </button>
  );
}
