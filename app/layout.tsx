import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Sans_Khmer, Space_Grotesk } from 'next/font/google';
import 'maplibre-gl/dist/maplibre-gl.css';
import './globals.css';

const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display', weight: ['500', '600', '700'] });
const body = Inter({ subsets: ['latin'], variable: '--font-body' });
const khmer = Noto_Sans_Khmer({ subsets: ['khmer'], variable: '--font-khmer', weight: ['400', '600'] });

export const metadata: Metadata = {
  title: 'Cambodia 3D Map',
  description: 'Explore Cambodia in 3D: terrain, buildings, landmarks and driving directions.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#f4f2fb',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${khmer.variable}`}>
      <body data-theme="day">{children}</body>
    </html>
  );
}
