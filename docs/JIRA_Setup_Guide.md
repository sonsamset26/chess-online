# HƯỚNG DẪN TẠO & QUẢN LÝ DỰ ÁN TRÊN JIRA (JIRA PROJECT SETUP GUIDE)

## 1. Cấu hình Dự án Jira
- **Loại dự án (Project Type):** Scrum Project (hoặc Kanban if preferred).
- **Project Name:** Chess Online Platform
- **Project Key:** `CHESS`

---

## 2. Danh sách Epics (Mục tiêu lớn)

| Key Epic | Tên Epic | Mô tả |
| :--- | :--- | :--- |
| `CHESS-E1` | **Authentication & User Profile** | Đăng ký, Đăng nhập JWT, Profile, Elo rating. |
| `CHESS-E2` | **Player vs AI (Stockfish WASM)** | Tích hợp Web Worker Stockfish, 3 độ khó. |
| `CHESS-E3` | **Realtime PvP & Room Manager** | WebSocket Gateway, Room Code, Matching, Đồng bộ bàn cờ. |
| `CHESS-E4` | **Match History & PGN Replay** | Ghi log trận đấu vào DB, Replay nước đi. |
| `CHESS-E5` | **Tournament System (Phase 2)** | Đấu loại trực tiếp 4-8 người chơi. |

---

## 3. Danh sách User Stories chi tiết (Nhập vào Backlog)

### Sprint 1: Setup & PvAI Mode (Tuần 1 - Tuần 2)
- **`CHESS-1` (Story):** *As a Developer, I want to initialize the Monorepo project layout so that Frontend and Backend can be developed smoothly.* (Est: 3 pts)
- **`CHESS-2` (Story):** *As a User, I want to see an interactive Chess Board on the web so that I can drag and drop pieces.* (Est: 5 pts)
- **`CHESS-3` (Story):** *As a Guest, I want to play against AI with 3 difficulty levels (Easy, Medium, Hard) so that I can practice offline.* (Est: 8 pts)
- **`CHESS-4` (Story):** *As a Developer, I want to run Stockfish in a Web Worker so that the UI never lags.* (Est: 5 pts)

### Sprint 2: User Auth & Realtime PvP (Tuần 3 - Tuần 4)
- **`CHESS-5` (Story):** *As a User, I want to register and login to save my match records and Elo rating.* (Est: 5 pts)
- **`CHESS-6` (Story):** *As a User, I want to create a private room and get a shareable link/code to invite my friend.* (Est: 5 pts)
- **`CHESS-7` (Story):** *As a Player, I want my moves to sync instantly via WebSocket (<100ms) with move validation.* (Est: 8 pts)
- **`CHESS-8` (Story):** *As a Player, I want match timer countdowns (e.g. 5 mins) so that the game is fair.* (Est: 5 pts)

---

## 4. Quy trình Cập nhật Jira hàng ngày (Scrum Flow)
- Trạng thái Ticket: `To Do` $\rightarrow$ `In Progress` $\rightarrow$ `In Review (PR)` $\rightarrow$ `Done`.
- Đặt tên Git Branch khớp với Jira Ticket Key (e.g., `feature/CHESS-3-stockfish-worker`).
