import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/providers";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "СУХ[pay] - Доставка продуктов и товаров",
  description: "Интернет-магазин с быстрой доставкой продуктов питания, напитков и товаров для дома. Заказывайте онлайн с доставкой на дом.",
  keywords: ["СУХ[pay]", "доставка", "продукты", "интернет-магазин", "заказ продуктов", "доставка еды"],
  authors: [{ name: "СУХ[pay] Team" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "СУХ[pay] - Доставка продуктов и товаров",
    description: "Заказывайте продукты питания онлайн с быстрой доставкой",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head />
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {/* Telegram WebApp SDK - loaded locally for better mobile network compatibility */}
        <Script
          src="/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>{children}</ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
