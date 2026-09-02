# TÀI LIỆU ĐẶC TẢ YÊU CẦU PHẦN MỀM (SRS - SOFTWARE REQUIREMENTS SPECIFICATION)
## Dự án: Chess Online - Nền tảng Đánh Cờ Vua Trực tuyến Thời gian thực tích hợp AI
**Cấu trúc tài liệu:** Theo mẫu IEEE 830  
**Phiên bản:** 1.0  
**Tác giả thực hiện:** Phan Hồng Sơn (MSV: 174765 - Lớp: 65PM-CNVLVH)  
**Đơn vị thực tập:** Công ty Cổ phần VTI  
**Cán bộ hướng dẫn tại ĐVHD:** Đinh Văn Đông (Tech Lead)  
**Giảng viên hướng dẫn:** ThS. Nguyễn Hải Dương  

---

## 1. GIỚI THIỆU (INTRODUCTION)

### 1.1 Mục đích (Purpose)
Tài liệu SRS này mô tả chi tiết các yêu cầu chức năng (Functional Requirements) và yêu cầu phi chức năng (Non-functional Requirements) cho hệ thống **Nền tảng Đánh Cờ Vua Trực tuyến Thời gian thực (Chess Online Platform)**. Tài liệu đóng vai trò là căn cứ kỹ thuật phục vụ quá trình thiết kế, phát triển phần mềm, kiểm thử và báo cáo học phần Thực tập tốt nghiệp.

### 1.2 Phạm vi hệ thống (Scope)
Hệ thống là một giải pháp hoàn chỉnh cung cấp môi trường thi đấu cờ vua tương tác cao, học tập và giải trí trên nền tảng Web:
- **Chế độ Đánh với Máy (Player vs AI - PvAI):** Tích hợp Stockfish Engine (WebAssembly) chạy trên luồng Web Worker với 3 cấp độ (Dễ, Trung bình, Khó).
- **Chế độ Đấu 2 người Trực tuyến (PvP Realtime):** Ghép trận ngẫu nhiên (Rated Matchmaking có tính điểm Elo FIDE) và Đấu tạo mã phòng bạn bè (Custom Friend Room Unrated) với cơ chế đồng bộ nước đi qua WebSocket (Socket.io).
- **Giải thuật Đồng hồ Thi đấu Hướng Sự kiện (Event-Driven Clock Engine):** Tính toán và trừ giờ chính xác theo mốc Server Timestamp, tiết kiệm tài nguyên CPU và giảm độ trễ mạng.
- **Cơ chế Khôi phục Kết nối (45s Reconnect Grace Period):** Tự động khôi phục trạng thái ván cờ khi người chơi tải lại trang web hoặc gặp sự cố đường truyền mạng tạm thời.
- **Hệ thống Giải đấu (Tournament System):** Tổ chức các nhánh đấu loại trực tiếp (Single-Elimination Knockout) dành cho các kỳ thủ tranh tài.
- **Học tập & Giải đố Thế cờ (Chess Lessons & Tactical Puzzles):** Kho bài tập cờ thế phân loại theo các đòn chiến thuật phổ biến giúp người chơi nâng cao kỹ năng.
- **Quản lý Tài khoản & Xếp hạng:** Xác thực bảo mật hai lớp (Dual-Token JWT), lưu trữ hồ sơ người chơi, thống kê tỷ lệ thắng/thua và Bảng xếp hạng Elo.

### 1.3 Thuật ngữ & Định nghĩa (Definitions & Acronyms)
- **FIDE:** Fédération Internationale des Échecs – Liên đoàn Cờ vua Quốc tế.
- **FEN (Forsyth–Edwards Notation):** Chuỗi ký tự biểu diễn vị trí các quân cờ tại một trạng thái cụ thể.
- **PGN (Portable Game Notation):** Định dạng lưu trữ chuỗi nước đi của một ván cờ.
- **UCI (Universal Chess Interface):** Giao thức truyền thông giữa giao diện người dùng và Engine cờ vua.
- **WASM (WebAssembly):** Định dạng mã nhị phân hiệu năng cao chạy trực tiếp trên trình duyệt Web.
- **CPL (Centipawn Loss):** Độ mất mát ưu thế của nước cờ đo bằng một phần trăm giá trị quân Tốt.
- **PvAI:** Player versus AI (Người thi đấu với Trí tuệ nhân tạo).
- **PvP:** Player versus Player (Người thi đấu trực tiếp với Người).

---

## 2. MÔ TẢ TỔNG QUAN HỆ THỐNG (OVERALL DESCRIPTION)

### 2.1 Kiến trúc tổng thể (System Architecture)
Hệ thống được tổ chức theo mô hình Monorepo phân tách giữa Frontend và Backend:
- **Frontend (`apps/frontend`):** Next.js 14 (React, App Router, TypeScript), Tailwind CSS, Lucide Icons, Chessboard 2D Renderer, Web Worker WASM cho Stockfish.
- **Backend (`apps/backend`):** Node.js, Express, TypeScript, Socket.io Realtime Gateway, kiểm tra luật FIDE với `chess.js`.
- **Cơ sở dữ liệu:** MongoDB Atlas Cloud Database lưu trữ User, Match History, Puzzles, Lessons.
- **Hạ tầng triển khai:** Nginx Reverse Proxy (SSL/HTTPS Let's Encrypt), PM2 Process Manager trên máy chủ Cloud Server Linux (Ubuntu).

```
[ Client Web / Mobile ] <=== WebSocket (Socket.io) / HTTPS ===> [ Nginx Reverse Proxy ]
                                                                       │
                                              ┌────────────────────────┴────────────────────────┐
                                              ▼                                                 ▼
                                    [ Next.js 14 Frontend ]                           [ Node.js Backend API ]
                                    (Port 3000 / Web Worker)                          (Port 5000 / WebSocket)
                                                                                                │
                                                                                                ▼
                                                                                    [ MongoDB Atlas Database ]
```

### 2.2 Các nhóm Người dùng (User Roles)
1. **Khách (Guest User):** Không cần đăng nhập, có thể chơi luyện tập với AI Stockfish, giải các bài tập thế cờ cơ bản hoặc xem bảng xếp hạng.
2. **Kỳ thủ Đã Đăng ký (Registered Player):** Đăng nhập tài khoản, tham gia hàng chờ tìm trận tính Elo, tạo phòng bạn bè, lưu lịch sử ván cờ, tham gia giải đấu và theo dõi thứ hạng.
3. **Quản trị viên (Admin):** Quản trị hệ thống, quản lý tài khoản người dùng, giám sát các phòng đấu và cập nhật ngân hàng bài học, thế cờ.

---

## 3. YÊU CẦU CHỨC NĂNG (FUNCTIONAL REQUIREMENTS)

### 3.1 Module Quản lý Tài khoản & Xác thực (Auth & User Management)
- **FR-1.1 Đăng ký / Đăng nhập:** Xác thực người dùng bằng Email/Password (mật khẩu băm an toàn với Bcrypt cost 10) hoặc tài khoản Google OAuth 2.0.
- **FR-1.2 Cơ chế Bảo mật Dual-Token JWT:**
  - AccessToken ngắn hạn (15 phút) lưu trong bộ nhớ RAM ứng dụng (React State / Zustand), gửi qua Header `Authorization: Bearer <token>` để hạn chế nguy cơ XSS.
  - RefreshToken dài hạn (7 - 30 ngày) lưu trong `httpOnly Cookie` kèm các cờ `Secure`, `SameSite=Strict` để hạn chế nguy cơ CSRF.
  - Hỗ trợ làm mới token (Silent Refresh) tại endpoint `/api/v1/auth/refresh` khi AccessToken hết hạn.
- **FR-1.3 Hồ sơ Kỳ thủ (Profile):** Quản lý ảnh đại diện, tên người dùng, điểm Elo (mặc định 1200), tỷ lệ thắng/hòa/thua và tổng số trận đã đấu.
- **FR-1.4 Bảng Xếp hạng (Leaderboard):** Bảng xếp hạng các kỳ thủ có điểm Elo cao trong hệ thống.

### 3.2 Module Đấu với Máy (Player vs AI - PvAI)
- **FR-2.1 Chọn Cấp độ AI:** Cung cấp 3 mức độ thích ứng:
  - *Dễ (~800 Elo):* Thích hợp cho người mới bắt đầu làm quen thế trận.
  - *Trung bình (~1300 Elo):* Cân bằng giữa tấn công và phòng thủ.
  - *Khó (~2000 Elo):* Nước đi chặt chẽ, hạn chế sơ hở.
- **FR-2.2 Chọn Bên Cầm Quân:** Cho phép người chơi chọn cầm quân Trắng, quân Đen hoặc Ngẫu nhiên.
- **FR-2.3 Xử lý AI Độc lập (Web Worker):** Engine Stockfish WASM chạy trên luồng ngầm Web Worker, giao tiếp qua UCI protocol, không gây ảnh hưởng đến giao diện người dùng (UI non-blocking).

### 3.3 Module Đấu Realtime Người với Người (PvP Realtime)
- **FR-3.1 Ghép trận Xếp hạng Ngẫu nhiên (Rated Matchmaking):**
  - Ghép nối 2 kỳ thủ trong hàng chờ `waitingQueue`.
  - Phân định ngẫu nhiên bên cầm quân Trắng/Đen.
  - Tính toán và cập nhật điểm xếp hạng Elo FIDE vào MongoDB Atlas khi trận đấu kết thúc.
- **FR-3.2 Đấu Tạo Phòng Bạn Bè (Custom Friend Room - Unrated):**
  - Chủ phòng tạo phòng và nhận Mã phòng 6 số ngẫu nhiên.
  - Khách nhập mã phòng để tham gia thi đấu giao hữu (không thay đổi điểm Elo xếp hạng).
- **FR-3.3 Kiểm soát Luật cờ FIDE Phía Server (Zero-Trust Validation):** Mọi nước đi đều được máy chủ kiểm tra tính hợp lệ qua `chess.js` (hợp lệ luật đi, không tự chiếu Vua, bắt tốt qua đường, phong cấp hợp lệ).
- **FR-3.4 Giải thuật Đồng hồ Thi đấu Hướng Sự kiện (Event-Driven Clock Engine):**
  - Quản lý đồng hồ dựa trên mốc Server Timestamp `turnStartedAt` và quỹ thời gian `whiteTimeMs`, `blackTimeMs`.
  - Tự động trừ giờ khi nhận nước đi; có Watchdog Timer xử thua do hết giờ (Flag Fall).
- **FR-3.5 Cơ chế Reconnect Grace Period 45s:**
  - Khi một bên rớt mạng hoặc tải lại trang, máy chủ giữ trạng thái phòng trong 45 giây.
  - Hiển thị thông báo đếm ngược thời gian thực trên màn hình đối thủ.
  - Khôi phục ván đấu khi kỳ thủ kết nối lại. Sau 45s không vào lại mới xử thua do bỏ cuộc.

### 3.4 Module Lưu trữ & Xem lại Trận đấu (Match History & Replay)
- **FR-4.1 Lưu trữ Lịch sử:** Lưu chuỗi nước đi (PGN), FEN cuối cùng, kết quả và điểm Elo biến thiên vào MongoDB.
- **FR-4.2 Xem lại Bàn cờ (Review Mode):** Cho phép quan sát lại thế cờ khi kết thúc trận và duyệt lại từng nước cờ đã thực hiện.

### 3.5 Module Hệ thống Giải đấu (Tournament System)
- **FR-5.1 Cấu trúc Nhánh đấu Loại trực tiếp (Single-Elimination Knockout):** Phân chia nhánh đấu cho 4 hoặc 8 người chơi.
- **FR-5.2 Cập nhật Kết quả:** Người thắng trận tiến vào vòng tiếp theo, người thua dừng bước.
- **FR-5.3 Bảng Thi đấu:** Hiển thị sơ đồ thi đấu (Bracket Tree) và người chiến thắng giải đấu.

### 3.6 Module Học tập & Giải đố Cờ vua (Chess Lessons & Tactical Puzzles)
- **FR-6.1 Thư viện Bài học Cờ vua:** Các bài hướng dẫn tương tác từ luật cơ bản, nước đi đặc biệt đến chiến lược khai cuộc.
- **FR-6.2 Ngân hàng Thế cờ Chiến thuật (Puzzles):** Các bài tập thực hành nhận diện đòn ghim quân, đòn xiên, chiếu rút và chiếu hết trong 1-3 nước.

---

## 4. YÊU CẦU PHI CHỨC NĂNG (NON-FUNCTIONAL REQUIREMENTS)

- **NFR-1 Độ trễ & Hiệu năng (Performance):** Độ trễ gửi nhận nước cờ qua Socket.io đạt dưới 100ms trong điều kiện mạng thông thường. Giao diện bàn cờ chuyển động mượt mà.
- **NFR-2 Khả năng Tiết kiệm Tài nguyên (Efficiency):** Sử dụng Event-Driven Clock Engine thay thế việc phát xung định kỳ, giảm tải CPU máy chủ khi có nhiều phòng đấu cùng lúc.
- **NFR-3 Tính Ổn định & Sẵn sàng (Reliability & Availability):** Hệ thống có khả năng tự khởi chạy lại tiến trình qua PM2. Cơ chế Reconnect 45s hạn chế việc mất ván cờ do mạng không ổn định.
- **NFR-4 Bảo mật & An toàn Dữ liệu (Security):** Lưu lượng mạng được mã hóa qua HTTPS/WSS (TLS 1.3). Mật khẩu người dùng băm một chiều với Bcrypt. Khóa API và chuỗi kết nối cơ sở dữ liệu được lưu trong biến môi trường `.env`, cẩn thận không đưa lên kho mã nguồn.
- **NFR-5 Tương thích & Trải nghiệm Người dùng (Usability & Responsiveness):** Hoạt động tốt trên các trình duyệt phổ biến (Chrome, Edge, Safari, Firefox), tự động điều chỉnh giao diện hiển thị phù hợp trên cả Desktop và Mobile.

---

## 5. MA TRẬN YÊU CẦU CHỨC NĂNG VÀ MỨC ĐỘ HOÀN THÀNH

| Mã Yêu cầu | Nhóm Chức năng | Chi tiết Tính năng | Mức độ Hoàn thành |
| :--- | :--- | :--- | :---: |
| **FR-1** | Quản lý Tài khoản & Elo | Đăng ký, Đăng nhập, Dual-Token JWT, Leaderboard | **100% (Hoàn thành)** |
| **FR-2** | Đánh với AI (PvAI) | Stockfish WASM Web Worker 3 cấp độ, không đơ UI | **100% (Hoàn thành)** |
| **FR-3.1** | Ghép trận Xếp hạng (PvP) | Matchmaking hàng chờ ngẫu nhiên, tự động tính điểm Elo | **100% (Hoàn thành)** |
| **FR-3.2** | Đấu Bạn bè (Custom Room) | Tạo mã phòng 6 số, vào phòng giao hữu Unrated | **100% (Hoàn thành)** |
| **FR-3.3** | Zero-Trust Validation | Máy chủ kiểm tra luật FIDE qua `chess.js` | **100% (Hoàn thành)** |
| **FR-3.4** | Event-Driven Clock Engine | Đồng hồ tính giờ theo mốc Server Timestamp | **100% (Hoàn thành)** |
| **FR-3.5** | Reconnect Grace Period 45s | Khôi phục ván đấu khi F5/rớt mạng kèm đếm lùi | **100% (Hoàn thành)** |
| **FR-4** | Lịch sử & Xem lại Bàn cờ | Lưu trữ ván cờ, xem lại thế trận sau kết thúc | **100% (Hoàn thành)** |
| **FR-5** | Hệ thống Giải đấu | Nhánh đấu loại trực tiếp Knockout, cập nhật vòng đấu | **100% (Hoàn thành)** |
| **FR-6** | Học tập & Giải đố Puzzles | Kho thế cờ tương tác và giáo trình bài học cờ | **100% (Hoàn thành)** |
| **NFR-ALL**| Triển khai Cloud Server | Nginx Reverse Proxy, SSL Let's Encrypt, PM2 | **100% (Hoàn thành)** |
