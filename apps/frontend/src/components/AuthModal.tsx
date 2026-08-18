import React, { useState } from 'react';
import { X, Mail, Lock, User as UserIcon, Shield, ArrowRight } from 'lucide-react';

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
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isLogin
        ? 'http://localhost:5000/api/v1/auth/login'
        : 'http://localhost:5000/api/v1/auth/register';

      const payload = isLogin
        ? { email, password }
        : { email, username, password };

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
        username: data.data.user.username,
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

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-green-500 flex items-center justify-center text-white shadow-lg shadow-green-500/20 mx-auto mb-3">
            <Shield className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-extrabold text-white">
            {isLogin ? 'Đăng nhập Chess Online' : 'Tạo Tài khoản Mới'}
          </h2>
          <p className="text-xs text-[#8B8987] mt-1">
            {isLogin ? 'Nhập thông tin tài khoản của bạn' : 'Tham gia cộng đồng cờ vua trực tuyến'}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold text-center">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {!isLogin && (
            <div>
              <label className="text-xs font-bold text-[#C3C1C0] mb-1 block">Tên đăng nhập (Username):</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-[#8B8987] absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="grandmaster99"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#2B2926] border border-[#3A3733] text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>
          )}

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
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#2B2926] border border-[#3A3733] text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

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
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#2B2926] border border-[#3A3733] text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white font-extrabold text-sm shadow-lg shadow-green-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>{loading ? 'Đang xử lý...' : isLogin ? 'Đăng nhập' : 'Tạo Tài khoản'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Toggle Login/Register */}
        <div className="mt-5 text-center text-xs text-[#8B8987]">
          {isLogin ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="ml-1.5 text-emerald-400 font-bold hover:underline"
          >
            {isLogin ? 'Đăng ký ngay' : 'Đăng nhập'}
          </button>
        </div>
      </div>
    </div>
  );
};
