import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Raindrop',
  icons: {
    icon: [
      {
        url: '/img/provider-raindrop-icon.png',
        type: 'image/png',
        sizes: '936x936',
      },
    ],
    shortcut: [
      {
        url: '/img/provider-raindrop-icon.png',
        type: 'image/png',
        sizes: '936x936',
      },
    ],
    apple: [
      {
        url: '/img/provider-raindrop-icon.png',
        type: 'image/png',
        sizes: '936x936',
      },
    ],
  },
};

export default function RaindropLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
