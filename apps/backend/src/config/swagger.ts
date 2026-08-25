export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Chess Online Platform API Specification',
    version: '1.2.0',
    description: `
### 👑 Chess Online Realtime Platform - RESTful API & WebSocket Documentation
Tài liệu đặc tả toàn bộ các điểm cuối (Endpoints) của hệ thống máy chủ Cờ Vua Trực Tuyến **Chess Online** (\`https://chessvn.tech\`).

#### 🔒 Kiến trúc Bảo mật Dual-Token JWT:
* **AccessToken (\`secretToken\`):** Thời hạn ngắn (\`15 phút\`), lưu trong bộ nhớ **RAM (Zustand State)** phía React Client, truyền qua Header \`Authorization: Bearer <token>\`.
* **RefreshToken (\`refreshToken\`):** Thời hạn dài (\`7 ngày\`), lưu trữ an toàn trong **httpOnly Cookie** (\`SameSite=Lax\`, \`Secure=true\`) chống đánh cắp XSS.

#### 🌐 Máy chủ Môi trường:
* **Production Live:** \`https://chessvn.tech\`
* **Local Development:** \`http://localhost:5000\`
    `,
    contact: {
      name: 'Phan Hồng Sơn (Kỹ sư Phát triển Hệ thống)',
      email: 'sonsamset262002@gmail.com',
      url: 'https://chessvn.tech',
    },
  },
  servers: [
    {
      url: 'https://chessvn.tech',
      description: 'Production Live Server (Cloud VPS)',
    },
    {
      url: 'http://localhost:5000',
      description: 'Local Development Server',
    },
  ],
  tags: [
    { name: 'Auth & Security', description: 'Đăng ký, Đăng nhập Email/Google & Quản lý Dual-Token JWT' },
    { name: 'Users & Leaderboard', description: 'Thông tin người dùng, bảng xếp hạng Elo thế giới' },
    { name: 'Chess Puzzles & Lessons', description: 'Cơ sở dữ liệu thế cờ chiến thuật & Bài học cờ vua' },
    { name: 'System & Health', description: 'Kiểm tra trạng thái máy chủ, MongoDB & WebSocket Gateway' },
    { name: 'WebSocket Events', description: 'Đặc tả các sự kiện Socket.io ghép trận & thời gian thực' },
  ],
  paths: {
    '/api/v1/auth/register': {
      post: {
        tags: ['Auth & Security'],
        summary: 'Đăng ký tài khoản người chơi mới',
        description: 'Tạo tài khoản mới với Tên hiển thị, Email và Mật khẩu. Trả về AccessToken và lưu RefreshToken vào httpOnly Cookie.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name: { type: 'string', example: 'Lê Quang Liêm' },
                  email: { type: 'string', example: 'quangliem@gmail.com' },
                  password: { type: 'string', example: 'chess@2026' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Đăng ký thành công' },
          400: { description: 'Email đã tồn tại hoặc thiếu tham số' },
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Auth & Security'],
        summary: 'Đăng nhập bằng Email và Mật khẩu',
        description: 'Xác thực tài khoản, trả về AccessToken (lưu RAM) và đính kèm RefreshToken vào httpOnly Cookie.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', example: 'sonsamset262002@gmail.com' },
                  password: { type: 'string', example: '123456' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Đăng nhập thành công' },
          401: { description: 'Email hoặc mật khẩu không chính xác' },
        },
      },
    },
    '/api/v1/auth/google': {
      post: {
        tags: ['Auth & Security'],
        summary: 'Đăng nhập nhanh bằng Google OAuth 2.0',
        description: 'Nhận Google idToken/Access Token từ Client, tạo hoặc cập nhật tài khoản người chơi và cấp cặp Token JWT.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['idToken'],
                properties: {
                  idToken: { type: 'string', example: 'ya29.a0AfH6SM...' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Đăng nhập Google thành công' },
          400: { description: 'Google Token không hợp lệ' },
        },
      },
    },
    '/api/v1/auth/refresh': {
      post: {
        tags: ['Auth & Security'],
        summary: 'Cấp mới AccessToken (Silent Token Rotation)',
        description: 'Đọc RefreshToken từ httpOnly Cookie, sinh cặp AccessToken (mới) và RefreshToken (mới) mà không làm gián đoạn người dùng.',
        responses: {
          200: { description: 'Cấp mới AccessToken thành công' },
          401: { description: 'RefreshToken không hợp lệ hoặc đã hết hạn' },
        },
      },
    },
    '/api/v1/auth/logout': {
      post: {
        tags: ['Auth & Security'],
        summary: 'Đăng xuất khỏi hệ thống',
        description: 'Xóa RefreshToken trong httpOnly Cookie và hủy phiên làm việc.',
        responses: {
          200: { description: 'Đăng xuất thành công' },
        },
      },
    },
    '/api/v1/users/leaderboard': {
      get: {
        tags: ['Users & Leaderboard'],
        summary: 'Lấy Bảng Xếp Hạng Elo Quốc Tế (Top Cao Thủ)',
        description: 'Trả về danh sách 50 người chơi có điểm Elo cao nhất được lưu trong MongoDB Atlas.',
        responses: {
          200: { description: 'Lấy bảng xếp hạng thành công' },
        },
      },
    },
    '/api/v1/puzzles': {
      get: {
        tags: ['Chess Puzzles & Lessons'],
        summary: 'Lấy danh sách các Thế Cờ Chiến Thuật (Puzzles)',
        description: 'Truy vấn các bài giải cờ thế phân loại theo cấp độ (Dễ, Trung bình, Khó) từ MongoDB.',
        responses: {
          200: { description: 'Lấy danh sách thế cờ thành công' },
        },
      },
    },
    '/api/v1/health': {
      get: {
        tags: ['System & Health'],
        summary: 'Kiểm tra trạng thái Sống còn của Máy chủ (Health Check)',
        description: 'Kiểm tra kết nối MongoDB, thời gian hoạt động Uptime, bộ nhớ RAM và trạng thái Socket.io Gateway.',
        responses: {
          200: { description: 'Hệ thống hoạt động bình thường 100%' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Nhập AccessToken (secretToken) để xác thực các API yêu cầu đăng nhập.',
      },
    },
  },
};
