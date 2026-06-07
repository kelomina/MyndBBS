'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

export function ThemeProvider({ children, nonce }: { children: React.ReactNode; nonce?: string | null }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem nonce={nonce || undefined}>
      {children}
    </NextThemesProvider>
  );
}
