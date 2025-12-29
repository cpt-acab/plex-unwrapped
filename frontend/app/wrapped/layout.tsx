import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Your Wrapped - Plex Unwrapped',
  description: 'Your year in entertainment. Discover your watch time, top movies, favorite shows, and more.',
  keywords: ['plex', 'wrapped', 'movies', 'tv shows', 'streaming', 'entertainment', 'statistics'],
  authors: [{ name: 'Plex Unwrapped' }],
  openGraph: {
    title: 'Plex Unwrapped',
    description: 'Your year in entertainment wrapped up.',
    type: 'website',
    siteName: 'Plex Unwrapped',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Plex Unwrapped',
    description: 'Your year in entertainment wrapped up.',
  },
  themeColor: '#ff6b35',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function WrappedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
