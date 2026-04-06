import type { Metadata } from "next";
import "./globals.css";
import { Header } from "../components/layout/Header";

export const metadata: Metadata = {
  title: "MyndBBS - Modern Community",
  description: "A clean, fast, and secure community platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-background">
        <Header />
        <div className="flex-1">
          {children}
        </div>
      </body>
    </html>
  );
}
