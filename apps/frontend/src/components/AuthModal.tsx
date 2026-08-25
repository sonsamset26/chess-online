import React, { useState } from 'react';
import { X, Mail, Lock, User as UserIcon, Crown, ArrowRight } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessLogin: (userData: { username: string; eloRating: number; token: string }) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccessLogin,
}) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [name, setName] = useState(''); // Tên hiển thị khi Đăng ký
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Hook Đăng nhập Google OAuth 2.0 chuẩn của @react-oauth/google
  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: tokenResponse.access_token }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Đăng nhập Google thất bại');
        }

        localStorage.setItem('chess_token', data.data.token);
        onSuccessLogin({
          username: data.data.user.name || data.data.user.username,
          eloRating: data.data.user.eloRating || 1200,
          token: data.data.token,
        });

        onClose();
      } catch (err: any) {
        setError(err.message || 'Lỗi kết nối Backend Google Auth');
      } finally {
        setLoading(false);
      }
    },
    onError: () => {
      setError('Đăng nhập Google bị hủy hoặc thất bại');
    },
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isLogin
        ? `${API_BASE_URL}/api/v1/auth/login`
        : `${API_BASE_URL}/api/v1/auth/register`;

      const payload = isLogin
        ? { email, password }
        : { email, name, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Đã xảy ra lỗi khi xác thực');
      }

      // Lưu Token vào LocalStorage
      localStorage.setItem('chess_token', data.data.token);
      onSuccessLogin({
        username: data.data.user.name || data.data.user.username,
        eloRating: data.data.user.eloRating || 1200,
        token: data.data.token,
      });

      onClose();
    } catch (err: any) {
      setError(err.message || 'Không thể kết nối đến máy chủ Backend');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-md bg-[#262421] border border-[#363431] rounded-2xl p-6 shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#8B8987] hover:text-white p-1 rounded-lg hover:bg-[#312E2B] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header với Icon Quân Vua & Nền Hồng */}
        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-600 to-rose-500 flex items-center justify-center text-white shadow-lg shadow-pink-500/30 mx-auto mb-3">
            <Crown className="w-7 h-7 fill-white/20" />
          </div>
          <h2 className="text-xl font-extrabold text-white">
            {isLogin ? 'Đăng nhập Chess Online' : 'Tạo Tài khoản Mới'}
          </h2>
          <p className="text-xs text-[#8B8987] mt-1">
            {isLogin ? 'Nhập Email và Mật khẩu của bạn' : 'Điền Tên hiển thị, Email và Mật khẩu để tham gia'}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold text-center">
            {error}
          </div>
        )}

        {/* Nút Đăng nhập Nhanh bằng Google OAuth 2.0 */}
        <button
          type="button"
          onClick={() => googleLogin()}
          disabled={loading}
          className="w-full py-2.5 px-4 mb-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-extrabold text-xs flex items-center justify-center gap-2.5 shadow-md border transition-all active:scale-95 disabled:opacity-50"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Đăng nhập nhanh bằng Google</span>
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-[1px] bg-[#3A3733]" />
          <span className="text-[10px] text-[#8B8987] font-semibold uppercase">Hoặc dùng Mật khẩu</span>
          <div className="flex-1 h-[1px] bg-[#3A3733]" />
        </div>

        {/* Form Đăng nhập / Đăng ký */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* ĐĂNG KÝ: Ô 1 = Tên hiển thị (name), Ô 2 = Email, Ô 3 = Mật khẩu */}
          {!isLogin && (
            <div>
              <label className="text-xs font-bold text-[#C3C1C0] mb-1 block">Tên hiển thị:</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-[#8B8987] absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Lê Quang Liêm"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#2B2926] border border-[#3A3733] text-white text-sm focus:outline-none focus:border-pink-500 transition-colors"
                />
              </div>
            </div>
          )}

          {/* Cả Đăng nhập & Đăng ký đều có ô EMAIL */}
          <div>
            <label className="text-xs font-bold text-[#C3C1C0] mb-1 block">Địa chỉ Email:</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#8B8987] absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@gmail.com"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#2B2926] border border-[#3A3733] text-white text-sm focus:outline-none focus:border-pink-500 transition-colors"
              />
            </div>
          </div>

          {/* Cả Đăng nhập & Đăng ký đều có ô MẬT KHẨU */}
          <div>
            <label className="text-xs font-bold text-[#C3C1C0] mb-1 block">Mật khẩu:</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#8B8987] absolute left-3 top-3" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#2B2926] border border-[#3A3733] text-white text-sm focus:outline-none focus:border-pink-500 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-1 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-extrabold text-sm shadow-lg shadow-pink-500/30 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>{loading ? 'Đang xử lý...' : isLogin ? 'Đăng nhập' : 'Tạo Tài khoản'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Toggle Login/Register */}
        <div className="mt-4 text-center text-xs text-[#8B8987]">
          {isLogin ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="ml-1.5 text-pink-400 font-bold hover:underline"
          >
            {isLogin ? 'Đăng ký ngay' : 'Đăng nhập'}
          </button>
        </div>
      </div>
    </div>
  );
};
