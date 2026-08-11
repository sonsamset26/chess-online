import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Chess Online - Đánh Cờ Vua Trực Tuyến Realtime tích hợp AI',
  description: 'Nền tảng thi đấu cờ vua trực tuyến realtime qua WebSocket và luyện tập với Stockfish AI.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="bg-slate-950 text-slate-100 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
