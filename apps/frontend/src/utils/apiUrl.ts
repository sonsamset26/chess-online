/**
 * Lấy URL gốc cho API Backend một cách nhất quán:
 * - Ưu tiên biến môi trường NEXT_PUBLIC_API_URL nếu được cấu hình.
 * - Trên trình duyệt: nếu chạy trên domain thật (như chessvn.tech), dùng window.location.origin.
 * - Nếu chạy local (localhost:3000), trỏ về http://localhost:5000.
 * - Server-side / SSR: fallback về http://localhost:5000.
 */
export const getApiUrl = (): string => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return `http://${window.location.hostname}:5000`;
    }
    return window.location.origin;
  }
  return 'http://localhost:5000';
};
