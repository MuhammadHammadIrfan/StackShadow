import type { Metadata, Viewport } from "next"
import { Outfit, Geist_Mono } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import "./globals.css"

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
})

export const metadata: Metadata = {
  title: 'StackShadow - Personal Technical Intelligence Layer',
  description:
    'An AI-powered system that monitors your startup\'s tech stack for security vulnerabilities, model pricing changes, and framework deprecations - so you can focus on shipping.',
  keywords: ['AI', 'security', 'startup', 'tech stack', 'vulnerability', 'monitoring'],
};

export const viewport: Viewport = {
  themeColor: "#050505",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${outfit.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased overflow-x-hidden">
        <div className="noise-overlay" />
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

