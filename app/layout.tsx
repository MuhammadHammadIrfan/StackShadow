import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'StackShadow — Personal Technical Intelligence Layer',
  description:
    'An AI-powered system that monitors your startup\'s tech stack for security vulnerabilities, model pricing changes, and framework deprecations — so you can focus on shipping.',
  keywords: ['AI', 'security', 'startup', 'tech stack', 'vulnerability', 'monitoring'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
