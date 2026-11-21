import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/app/components/ui";

export const metadata: Metadata = {
  title: "SentryLedger - Personal Finance Tracker",
  description: "A secure, offline-first desktop finance tracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground min-h-screen">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
