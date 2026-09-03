import jwt from 'jsonwebtoken';

/**
 * Xác thực JWT token gửi từ client khi kết nối hoặc thực hiện hành động trên WebSocket.
 * Trả về userId nếu token hợp lệ, hoặc null nếu không hợp lệ hoặc thiếu cấu hình.
 */
export function verifySocketToken(token: string): string | null {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;
    const decoded: any = jwt.verify(token, secret);
    return decoded?.userId || null;
  } catch {
    return null;
  }
}
