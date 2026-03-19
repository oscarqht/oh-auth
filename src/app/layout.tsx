import type { Metadata } from 'next';
import Script from 'next/script';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const themeInitializer = `
  (() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const apply = (isDark) => {
      const theme = isDark ? 'dark' : 'light';
      if (root.dataset.theme !== theme) {
        root.dataset.theme = theme;
      }
      root.style.colorScheme = theme;
    };

    apply(media.matches);
    media.addEventListener('change', (event) => apply(event.matches));
  })();
`;

export const metadata: Metadata = {
  title: 'Oh, auth!',
  description:
    'Minimal Next.js app to start OAuth2 flows for Google and Raindrop, redirect to provider authorization pages, and log received tokens on callback.',
  icons: {
    icon: [
      {
        url: '/favicon.ico',
        type: 'image/x-icon',
      },
    ],
    shortcut: ['/favicon.ico'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitializer }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
