import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Raindrop',
  icons: {
    icon: '/img/provider-raindrop-icon.png',
    shortcut: '/img/provider-raindrop-icon.png',
    apple: '/img/provider-raindrop-icon.png',
  },
};

export default function RaindropLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
