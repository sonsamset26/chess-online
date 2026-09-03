import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0B0F19] text-white p-4">
      <h1 className="text-4xl font-black text-pink-400 mb-2">404</h1>
      <h2 className="text-xl font-bold mb-4">Trang không tồn tại</h2>
      <Link
        href="/"
        className="px-5 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-lg transition-all"
      >
        Trở về Trang chủ
      </Link>
    </div>
  );
}
