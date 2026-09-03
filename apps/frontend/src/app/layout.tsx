import type { Metadata, Viewport } from 'next';
import './globals.css';
import { GoogleAuthProvider } from '../components/GoogleAuthProvider';

export const metadata: Metadata = {
  title: 'Chess online - Chơi cờ vua trực tuyến',
  description: 'Nền tảng thi đấu và chơi cờ vua trực tuyến.',
  referrer: 'no-referrer',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="bg-[#0B0F19] text-[#E2E8F0] antialiased font-sans overflow-x-hidden">
        <GoogleAuthProvider>
          {children}
        </GoogleAuthProvider>
      </body>
    </html>
  );
}
