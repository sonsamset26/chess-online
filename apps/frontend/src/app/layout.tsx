import type { Metadata, Viewport } from 'next';
import './globals.css';
import { GoogleAuthProvider } from '../components/GoogleAuthProvider';

export const metadata: Metadata = {
  title: 'Chess Online - Đánh Cờ Vua Trực Tuyến Realtime tích hợp AI',
  description: 'Nền tảng thi đấu cờ vua trực tuyến realtime qua WebSocket và luyện tập với Stockfish AI.',
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
      <body className="bg-[#161512] text-[#C3C1C0] antialiased font-sans overflow-x-hidden">
        <GoogleAuthProvider>
          {children}
        </GoogleAuthProvider>
      </body>
    </html>
  );
}
