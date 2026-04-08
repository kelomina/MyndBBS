import type { Metadata } from "next";
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
  const pathname = headersList.get('x-pathname') || '';
  const isAdminPath = pathname.startsWith('/admin');
  const dict = await getDictionary(locale);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-screen flex flex-col bg-background transition-colors duration-300">
        <ThemeProvider>
          <TranslationProvider dict={dict}>
            {!isAdminPath && <Header locale={locale} />}
            <div className="flex-1">
              {children}
            </div>
          </TranslationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
