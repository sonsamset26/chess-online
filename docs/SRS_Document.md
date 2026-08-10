# TÀI LIỆU ĐẶC TẢ YÊU CẦU PHẦN MỀM (SRS - SOFTWARE REQUIREMENTS SPECIFICATION)
## Dự án: Chess Online - Nền tảng Đánh Cờ Vua Trực tuyến Realtime tích hợp AI
**Chuẩn cấu trúc:** IEEE 830  
**Phiên bản:** 1.0  
**Giai đoạn:** Thực tập tốt nghiệp (Phase 1) & Đồ án tốt nghiệp (Phase 2)

---

## 1. GIỚI THIỆU (INTRODUCTION)

### 1.1 Mục đích (Purpose)
Tài liệu SRS này mô tả chi tiết các yêu cầu chức năng (Functional Requirements) và phi chức năng (Non-functional Requirements) cho hệ thống **Nền tảng Đánh Cờ Vua Trực tuyến Realtime tích hợp AI**. Tài liệu phục vụ làm căn cứ phát triển phần mềm, kiểm thử và báo cáo trước Hội đồng Bảo vệ Tốt nghiệp.

### 1.2 Phạm vi hệ thống (Scope)
Hệ thống được chia làm 2 giai đoạn phát triển:
- **Phase 1 (Thực tập tốt nghiệp):**
  - Chế độ đánh với máy (Player vs AI - PvAI) với 3 độ khó (Dễ, Trung bình, Khó) sử dụng Stockfish WASM.
  - Chế độ đánh giữa 2 người chơi realtime (Player vs Player - PvP) qua WebSocket (Socket.io).
  - Hệ thống Tài khoản (Đăng ký, Đăng nhập, Profile, Elo score cơ bản).
  - Quản lý Phòng đấu (Tạo phòng, Tham gia phòng qua Room Code/Link chia sẻ).
  - Lưu lịch sử trận đấu và Replay nước đi theo chuẩn PGN.
- **Phase 2 (Đồ án tốt nghiệp - Mở rộng):**
  - Hệ thống Giải đấu (Tournament System) loại trực tiếp (Single Elimination) cho 4-8+ người chơi.
  - Chế độ Học tập & Giải đố cờ vua (Interactive Tutorials & Chess Puzzles).

### 1.3 Thuật ngữ & Định nghĩa (Definitions & Acronyms)
- **FEN (Forsyth–Edwards Notation):** Chuỗi ký tự chuẩn biểu diễn trạng thái vị trí các quân cờ trên bàn cờ tại một thời điểm.
- **PGN (Portable Game Notation):** Định dạng file chuẩn lưu trữ toàn bộ chuỗi nước đi và thông tin của một trận cờ vua.
- **UCI (Universal Chess Interface):** Giao thức chuẩn giao tiếp với các Chess Engine (như Stockfish).
- **WASM (WebAssembly):** Định dạng mã nhị phân cho phép chạy mã C/C++ (Stockfish Engine) trên trình duyệt với tốc độ tiệm cận native.
- **PvAI:** Player versus AI (Người đấu với Máy).
- **PvP:** Player versus Player (Người đấu với Người).

---

## 2. MÔ TẢ TỔNG QUAN (OVERALL DESCRIPTION)

### 2.1 Kiến trúc tổng quan (Product Perspective)
Hệ thống thiết kế theo kiến trúc Client-Server tách biệt:
- **Client (Frontend):** Next.js (React + TypeScript) + `react-chessboard` + `chess.js` + Stockfish Engine (Web Worker WASM).
- **Server (Backend):** Node.js (NestJS/Express) + WebSocket Gateway (Socket.io) + PostgreSQL (DB) + Redis (In-memory Session & Room Cache).

```
[ Client Browser ] <--- WebSocket (Socket.io) ---> [ Backend Gateway ] <---> [ Redis Cache ]
        |                                                     |
  Web Worker (Stockfish WASM)                           PostgreSQL DB
```

### 2.2 Các lớp Người dùng (User Classes & Characteristics)
1. **Khách (Guest):** Không cần đăng nhập, có thể chơi PvAI hoặc giải cờ thế cơ bản.
2. **Người dùng Đã đăng ký (Registered User):** Đăng nhập tài khoản, chơi PvP realtime, tạo phòng, tích lũy Elo, xem lịch sử trận đấu, tham gia giải đấu.
3. **Quản trị viên (Admin):** Quản lý người dùng, tạo giải đấu, cập nhật kho bài tập Puzzles.

---

## 3. YÊU CẦU CHỨC NĂNG (FUNCTIONAL REQUIREMENTS)

### 3.1 Module Quản lý Tài khoản (Auth & User Management)
- **FR-1.1 Đăng ký / Đăng nhập:** Cho phép đăng ký bằng Email/Password hoặc OAuth2 (Google). Trả về JWT Token.
- **FR-1.2 Quản lý Profile:** Hiển thị Avatar, Tên người dùng, Điểm Elo (Mặc định 1200), Thống kê Thắng/Thua/Hòa.
- **FR-1.3 Xếp hạng (Leaderboard):** Bảng xếp hạng Top người chơi theo điểm Elo.

### 3.2 Module Đánh với Máy (Player vs AI - PvAI)
- **FR-2.1 Chọn độ khó:** Cho phép người chơi chọn 3 cấp độ:
  - *Dễ (Easy):* Skill Level 1, Depth 2.
  - *Trung bình (Medium):* Skill Level 8, Depth 5.
  - *Khó (Hard):* Skill Level 20, Depth 10.
- **FR-2.2 Chọn bên:** Người chơi chọn cầm quân Trắng, Đen hoặc Ngẫu nhiên.
- **FR-2.3 Xử lý AI ngầm:** Engine Stockfish chạy trong Web Worker, giao tiếp qua UCI Protocol, trả về `bestmove` mà không làm đơ UI bàn cờ.

### 3.3 Module Đánh 2 người Trực tuyến (PvP Realtime)
- **FR-3.1 Tạo phòng (Create Room):** Hệ thống sinh Room Code ngẫu nhiên (6 ký tự) và Link chia sẻ duy nhất.
- **FR-3.2 Tham gia phòng (Join Room):** Người chơi 2 tham gia phòng qua Room Code hoặc click Link.
- **FR-3.3 Đồng bộ nước đi (Realtime Move Sync):** Mỗi nước đi đi qua `chess.js` validate ở cả Client & Server, truyền qua Socket.io event `make_move` trong < 100ms.
- **FR-3.4 Quản lý Thời gian (Match Clock):** Server/Redis đếm ngược thời gian đấu (e.g. 5 phút, 10 phút / bên). Hết giờ tự động xử Thua.
- **FR-3.5 Xử lý Mất kết nối (Disconnect Recovery):** Nếu bị ngắt kết nối trong 30s, người chơi reconnect lại sẽ tự động nhận lại trạng thái FEN hiện tại từ Redis.

### 3.4 Module Lưu trữ & Replay Trận đấu (Match History & Replay)
- **FR-4.1 Lưu trận đấu:** Khi trận đấu kết thúc (Chiếu hết, Hòa, Hết giờ, Đầu hàng), kết quả và chuỗi PGN được lưu vào PostgreSQL.
- **FR-4.2 Xem lại (Replay):** Cho phép xem lại từng nước đi (First, Previous, Next, Last) của các trận đấu cũ.

---

## 4. YÊU CẦU PHI CHỨC NĂNG (NON-FUNCTIONAL REQUIREMENTS)

- **NFR-1 Hiệu năng (Performance):** Độ trễ truyền nước đi PvP qua WebSocket < 150ms. Trình duyệt render bàn cờ 60 FPS.
- **NFR-2 Khả năng mở rộng (Scalability):** Chế độ PvAI tải 0% CPU Server. Server xử lý đồng thời ít nhất 500 kết nối PvP WebSocket song song nhờ Redis Adapter.
- **NFR-3 Bảo mật (Security):** Mật khẩu mã hóa BCrypt. Xác thực WebSocket handshake bằng JWT Header. Validate mọi nước đi phía Server để chống gian lận (Anti-cheat/Hack move).
- **NFR-4 Giao diện & Trải nghiệm (Usability):** Responsive trên màn hình di động & máy tính, hỗ trợ Kéo-Thả (Drag & Drop) quân cờ mượt mà.

---

## 5. MA TRẬN PHÂN CHIA TIẾN ĐỘ (PHASING MATRIX)

| Mã Yêu cầu | Tên Chức năng | Thực tập Tốt nghiệp (Phase 1) | Đồ án Tốt nghiệp (Phase 2) |
| :--- | :--- | :---: | :---: |
| FR-1 | Quản lý Tài khoản & Elo | **X** | **X** |
| FR-2 | Đánh với AI (Stockfish WASM) | **X** | **X** |
| FR-3 | PvP Realtime + Room Manager | **X** | **X** |
| FR-4 | Lưu Lịch sử & Replay PGN | **X** | **X** |
| FR-5 | Giải đấu (Tournament System) | | **X** |
| FR-6 | Học tập & Giải đố (Puzzles) | | **X** |
