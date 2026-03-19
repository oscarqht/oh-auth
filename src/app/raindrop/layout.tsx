import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Raindrop',
};

export default function RaindropLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
