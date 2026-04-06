import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { Header } from "../components/layout/Header";
import { Locale, defaultLocale } from "../i18n/config";

export const metadata: Metadata = {
  title: "MyndBBS - Modern Community",
  description: "A clean, fast, and secure community platform.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Await headers() in Next.js 15+
  const headersList = await headers();
  const locale = (headersList.get('x-locale') || defaultLocale) as Locale;

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-screen flex flex-col bg-background">
        <Header locale={locale} />
        <div className="flex-1">
          {children}
        </div>
      </body>
    </html>
  );
}
