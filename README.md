# ♟️ Chess Online - Nền tảng Đánh Cờ Vua Trực tuyến Realtime tích hợp AI

Dự án Đồ án tốt nghiệp / Thực tập tốt nghiệp ngành Công nghệ Thông tin.

## 📌 Tổng quan Hệ thống
Hệ thống đánh cờ vua trực tuyến chuẩn quốc tế với 2 chế độ chính:
- **Player vs AI (PvAI):** Tích hợp engine mã nguồn mở Stockfish (chạy WebAssembly trên Client Web Worker) với 3 cấp độ (Dễ, Trung bình, Khó).
- **Player vs Player (PvP Realtime):** Kết nối trực tuyến qua WebSocket (Socket.io), tạo phòng, mời bạn bè, đồng bộ FEN & quản lý đếm ngược thời gian đấu.
- **Mở rộng (Đồ án):** Giải đấu loại trực tiếp (Tournament System) & Bài tập cờ thế (Chess Puzzles).

---

## 📁 Cấu trúc Thư mục (Monorepo Layout)

```text
Chess/
├── apps/
│   ├── frontend/             # Application Web (Next.js 14, React, TypeScript, TailwindCSS)
│   └── backend/              # Application Server (Node.js/NestJS, Socket.io, PostgreSQL, Redis)
├── docs/                     # Tài liệu thiết kế & Báo cáo
│   ├── SRS_Document.md       # Tài liệu đặc tả SRS chuẩn IEEE 830
│   ├── JIRA_Setup_Guide.md   # Hướng dẫn khởi tạo Jira Backlog & User Stories
│   └── GIT_BRANCHING_STRATEGY.md # Quy chuẩn phân nhánh & commit Git
├── .gitignore
└── README.md
```

---

## 🚀 Hướng dẫn Bắt đầu (Quick Start)

### 1. Kiểm tra Yêu cầu Môi trường
- Node.js >= v18.x
- Git >= 2.x
- PostgreSQL >= 14
- Redis Server (Optionally via Docker)

### 2. Đọc Quy chuẩn Phân nhánh Git
Trước khi đẩy bất kỳ mã nguồn nào, thành viên bắt buộc đọc tài liệu [`GIT_BRANCHING_STRATEGY.md`](file:///c:/Document/TTTN/Chess/docs/GIT_BRANCHING_STRATEGY.md).

---

## 📄 Tài liệu Dự án
- [Tài liệu SRS chuẩn IEEE 830](file:///c:/Document/TTTN/Chess/docs/SRS_Document.md)
- [Cấu hình Jira & User Stories](file:///c:/Document/TTTN/Chess/docs/JIRA_Setup_Guide.md)
