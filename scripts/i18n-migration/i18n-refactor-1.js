const fs = require('fs');
const path = require('path');

const files = {
  "packages/frontend/src/components/TranslationProvider.tsx": `'use client';
import React, { createContext, useContext } from 'react';

const TranslationContext = createContext<any>(null);

export function TranslationProvider({ dict, children }: { dict: any, children: React.ReactNode }) {
  return (
    <TranslationContext.Provider value={dict}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
}
`,
  "packages/frontend/src/app/layout.tsx": `import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { Header } from "../components/layout/Header";
import { Locale, defaultLocale } from "../i18n/config";
import { getDictionary } from "../i18n/get-dictionary";
import { ThemeProvider } from "../components/ThemeProvider";
import { TranslationProvider } from "../components/TranslationProvider";

export const metadata: Metadata = {
  title: "MyndBBS - Modern Community",
  description: "A clean, fast, and secure community platform.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const locale = (headersList.get('x-locale') || defaultLocale) as Locale;
  const dict = await getDictionary(locale);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-screen flex flex-col bg-background transition-colors duration-300">
        <ThemeProvider>
          <TranslationProvider dict={dict}>
            <Header locale={locale} />
            <div className="flex-1">
              {children}
            </div>
          </TranslationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
`
};

for (const [relPath, content] of Object.entries(files)) {
  const absPath = path.join(__dirname, relPath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, content, 'utf-8');
}
console.log('Updated layout and added TranslationProvider');
