import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'FloodSense Indonesia',
    template: '%s | FloodSense Indonesia',
  },
  description:
    'Platform pemantauan banjir nasional berbasis GIS. Lapor banjir real-time, lihat peta heatmap, dan dapatkan peringatan dini untuk wilayah Anda.',
  keywords: [
    'banjir',
    'flood',
    'indonesia',
    'peta',
    'heatmap',
    'peringatan dini',
    'GIS',
    'crowdsourcing',
  ],
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0F172A',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
