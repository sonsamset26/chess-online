# ♟️ Chess Online - Nền tảng Đánh Cờ Vua Trực Tuyến

Dự án Đồ án tốt nghiệp / Thực tập tốt nghiệp ngành Công nghệ Thông tin.

---

## 📌 Các Chức Năng Chính

### 1. Chơi cờ với Máy (PvAI) & Luyện tập
- **Bot cờ vua:** Sử dụng thuật toán tìm kiếm Negamax kết hợp tỉa nhánh Alpha-Beta chạy trong Web Worker với 3 cấp độ (Dễ, Trung bình, Khó).
- **Live Move Analysis (Live Coach):** Đánh giá chất lượng từng nước đi ngay trong trận bằng Stockfish 10 (WebAssembly). Gắn nhãn phân loại (Nước tối ưu, Tốt, Không chuẩn xác, Sai lầm, Sai lầm nghiêm trọng) kèm điểm hao hụt thế cờ (CPL) và gợi ý nước đi tốt hơn.

### 2. Đấu trực tuyến (PvP Realtime)
- **Ghép trận ngẫu nhiên & Phòng bạn bè:** Kết nối thời gian thực qua WebSocket (Socket.io), tạo phòng và tham gia bằng mã phòng 6 ký tự.
- **Đồng hồ thi đấu & Tính điểm Elo:** Đồng hồ đếm ngược có gia hạn thời gian (Increment), cập nhật điểm xếp hạng Elo sau mỗi trận đấu.
- **Fair-play:** Tự động tắt tính năng Live Coach trong các trận đấu xếp hạng để đảm bảo tính công bằng.

### 3. Giải đấu loại trực tiếp (Tournament)
- Hỗ trợ giải đấu 4 người hoặc 8 người.
- Tự động sinh nhánh đấu (Bracket), đếm ngược chuyển vòng và tổ chức ván phụ Armageddon khi hòa cờ.

### 4. Lịch sử ván đấu & Phân tích chuyên sâu (Game Review)
- **Xem lại ván cờ (Replay):** Tua lại từng nước cờ của các ván đấu đã lưu.
- **Báo cáo trận đấu:** Vẽ biểu đồ đường SVG thể hiện diễn biến lợi thế thế cờ của hai bên và bảng tổng hợp độ chính xác.

---

## 🛠️ Công Nghệ Sử Dụng

- **Frontend:**
  - Next.js 14 (App Router), React, TypeScript, TailwindCSS.
  - Thư viện bàn cờ: `chess.js`, `react-chessboard`.
  - Phân tích cờ: Stockfish 10 (WebAssembly qua Web Worker).
- **Backend:**
  - Node.js, Express.js, TypeScript.
  - Giao tiếp thời gian thực: Socket.io.
  - Cơ sở dữ liệu: MongoDB (Mongoose).
  - Xác thực tài khoản: JSON Web Token (JWT) & Google OAuth.

---

## 📁 Cấu Trúc Thư Mục

```text
Chess/
├── apps/
│   ├── frontend/             # Ứng dụng Web (Next.js 14, TailwindCSS)
│   │   ├── public/stockfish/ # Binary Stockfish JS & WASM
│   │   └── src/
│   │       ├── components/   # Bàn cờ, Lịch sử nước đi, Biểu đồ phân tích
│   │       ├── hooks/        # Socket, Đồng hồ cờ, Live Analysis
│   │       └── services/     # Engine phân tích, tính toán CPL
│   └── backend/              # Máy chủ API & Socket (Express, MongoDB)
│       └── src/modules/      # Match, Tournament, Auth, User
├── docs/                     # Tài liệu thiết kế & Báo cáo
└── README.md
```

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### 1. Yêu cầu hệ thống
- Node.js >= 18.x
- MongoDB (cục bộ hoặc MongoDB Atlas)

### 2. Cài đặt các gói phụ thuộc
```bash
# Cài đặt cho Backend
cd apps/backend
npm install

# Cài đặt cho Frontend
cd ../frontend
npm install
```

### 3. Khởi chạy môi trường phát triển
```bash
# Chạy Backend (cổng 5000)
cd apps/backend
npm run dev

# Chạy Frontend (cổng 3000)
cd apps/frontend
npm run dev
```

---

## 📄 Tài liệu Dự án
- [Tài liệu Đặc tả Yêu cầu Hệ thống (SRS)](docs/SRS_Document.md)
- [Quy chuẩn Phân nhánh Git](docs/GIT_BRANCHING_STRATEGY.md)
- [Cấu hình Jira & User Stories](docs/JIRA_Setup_Guide.md)
