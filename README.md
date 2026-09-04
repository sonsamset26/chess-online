# Chess Online

Nền tảng cờ vua trực tuyến thời gian thực tích hợp công cụ phân tích Stockfish engine và mô hình học máy chẩn đoán điểm yếu kỳ thủ. Dự án thực tập tốt nghiệp ngành Công nghệ Thông tin.

---

## Chức năng hệ thống

### 1. Đấu trực tuyến và thi đấu giải
- **Ghép trận xếp hạng:** Ghép cặp tự động giữa hai người chơi dựa trên điểm Elo, sử dụng kết nối WebSocket qua Socket.IO.
- **Đấu với bạn bè:** Tạo phòng thi đấu riêng với mã phòng 6 ký tự.
- **Đấu giải loại trực tiếp:** Tổ chức nhánh đấu cúp 4 hoặc 8 người, tự động phân cặp, đếm ngược chuyển vòng và kích hoạt ván phụ Armageddon khi hòa cờ.
- **Đồng hồ thi đấu hướng sự kiện:** Máy chủ chỉ tính toán thời gian khi nhận nước đi hợp lệ hoặc khi hết giờ, giảm thiểu tải vi xử lý.
- **Bảo vệ ngắt kết nối:** Giữ trạng thái ván cờ trong 45 giây khi người chơi tải lại trang hoặc mất kết nối mạng.

### 2. Đấu với máy và giải thế cờ
- **Đấu với máy:** Tích hợp thuật toán Negamax kết hợp cắt tỉa Alpha-Beta chạy trên Web Worker của trình duyệt với các cấp độ Elo từ 800 đến 2000.
- **Giải thế cờ:** Ngân hàng 30 bài tập cờ thế chiến thuật tuyển chọn, phân bổ theo các dải trình độ từ 1000 đến 2050 Elo.

### 3. Phân tích ván cờ với Stockfish engine
- **Phân tích tức thời:** Tích hợp Stockfish engine phiên bản WebAssembly chạy trên Web Worker để đánh giá nước đi.
- **Hệ thống nhãn đánh giá:** Phân loại nước đi theo chỉ số mất điểm thế cờ (CPL) thành các mức: Tối ưu, Tốt, Chưa tối ưu, Sai lầm và Sai sót lớn.
- **Xem lại ván cờ:** Tua lại diễn biến ván cờ từng nước đi kèm biểu đồ biến thiên lợi thế của hai bên.

### 4. Hồ sơ kỳ thủ và mô hình học máy
- **Trích xuất 8 đặc trưng thi đấu:** Đo lường độ chính xác (CPL) và tỉ lệ sai sót ở 3 giai đoạn (đầu trận, giữa trận, cuối trận), thời gian suy nghĩ trung bình và mức độ ổn định dưới áp lực thời gian.
- **Phân cụm phong cách thi đấu:** Sử dụng thuật toán K-Means kết hợp bộ chuẩn hóa StandardScaler để phân loại người chơi vào 4 nhóm phong cách: Tiến công, Toàn diện, Đột biến và Phòng thủ.
- **Chẩn đoán điểm yếu và gợi ý bài tập:** Tự động phát hiện giai đoạn thi đấu có hiệu suất thấp nhất, đưa ra khuyến nghị cải thiện và đề xuất các bài tập cờ thế phù hợp với trình độ Elo.
- **Trực quan hóa năng lực:** Biểu đồ mạng nhện SVG 8 trục hiển thị trên giao diện hồ sơ cá nhân.

---

## Công nghệ sử dụng

- **Giao diện (Frontend):**
  - Next.js 14 (App Router), React 18, TypeScript, TailwindCSS.
  - Xử lý bàn cờ: `chess.js`, `react-chessboard`.
  - Động cơ phân tích: Stockfish 10 (WebAssembly qua Web Worker).
- **Máy chủ (Backend):**
  - Node.js, Express, TypeScript.
  - Giao tiếp thời gian thực: Socket.IO.
  - Cơ sở dữ liệu: MongoDB Atlas, Mongoose ODM.
  - Xác thực: JSON Web Token (JWT) và Google OAuth 2.0.
- **Mô đun học máy:**
  - Thuật toán K-Means phân cụm phong cách thi đấu.
  - Bộ chuẩn hóa dữ liệu StandardScaler.
  - Bộ phân tích điểm yếu WeaknessAnalyzer và bộ gợi ý thích ứng RecommendationService.

---

## Cấu trúc thư mục

```text
Chess/
├── apps/
│   ├── frontend/             # Ứng dụng web (Next.js 14, TailwindCSS)
│   │   ├── public/stockfish/ # Tệp nhị phân Stockfish JS và WebAssembly
│   │   └── src/
│   │       ├── app/          # Định tuyến trang Next.js App Router
│   │       ├── components/   # Bàn cờ, lịch sử nước đi, hồ sơ kỳ thủ
│   │       ├── hooks/        # Quản lý Socket, đồng hồ và động cơ cờ
│   │       └── services/     # Kết nối Stockfish, phân loại nước đi
│   └── backend/              # Máy chủ dịch vụ (Express, Socket.IO)
│       └── src/
│           ├── config/       # Kết nối cơ sở dữ liệu MongoDB Atlas
│           ├── middlewares/  # Xác thực danh tính qua JWT
│           └── modules/      # Phân hệ Match, Tournament, Auth, Puzzle, ML
├── docs/                     # Tài liệu đặc tả hệ thống và hướng dẫn
└── README.md
```

---

## Hướng dẫn cài đặt và khởi chạy

### 1. Yêu cầu môi trường
- Node.js phiên bản 18 trở lên.
- Trình quản lý gói npm.
- Cơ sở dữ liệu MongoDB (cục bộ hoặc tài khoản MongoDB Atlas).

### 2. Cài đặt các gói phụ thuộc
```bash
# Cài đặt cho máy chủ Backend
cd apps/backend
npm install

# Cài đặt cho giao diện Frontend
cd ../frontend
npm install
```

### 3. Cấu hình biến môi trường
Tạo tệp `.env` tại thư mục `apps/backend/`:
```env
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/chess
JWT_SECRET=your_secret_key
CLIENT_URL=http://localhost:3000
```

Tạo tệp `.env.local` tại thư mục `apps/frontend/`:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

### 4. Khởi chạy ứng dụng
```bash
# Chạy máy chủ Backend (cổng 5000)
cd apps/backend
npm run dev

# Chạy giao diện Frontend (cổng 3000)
cd ../frontend
npm run dev
```

---

## Tài liệu liên quan
- [Tài liệu đặc tả yêu cầu phần mềm (SRS)](docs/SRS_Document.md)
- [Quy chuẩn phân nhánh Git](docs/GIT_BRANCHING_STRATEGY.md)
