# QUY CHUẨN PHÂN NHÁNH GIT (GIT BRANCHING STRATEGY & COMMIT CONVENTIONS)

## 1. Sơ đồ Cấu trúc Phân nhánh (GitFlow Lite)

```text
main (Production Ready Code - Chỉ chứa code đã bảo vệ / release)
  ▲
  │ (Pull Request via Code Review)
develop (Staging / Development Code - Nhánh làm việc chung chính)
  ▲
  ├── feature/CHESS-3-stockfish-worker (Nhánh làm tính năng riêng)
  ├── feature/CHESS-6-create-room
  └── fix/CHESS-12-socket-disconnect
```

---

## 2. Quy tắc đặt tên Nhánh (Branch Naming)
- **Tính năng mới:** `feature/CHESS-<ticket_number>-<ten_ngan_gon>`  
  *(Ví dụ: `feature/CHESS-3-stockfish-ai`, `feature/CHESS-5-user-auth`)*
- **Sửa lỗi:** `fix/CHESS-<ticket_number>-<ten_ngan_gon>`  
  *(Ví dụ: `fix/CHESS-9-timer-desync`)*
- **Tài liệu / Cấu hình:** `docs/srs-document`, `chore/setup-monorepo`

---

## 3. Quy chuẩn Commit Message (Conventional Commits)
Cấu trúc chuẩn: `<type>(<scope>): <short description> [CHESS-ID]`

### Các loại Type:
- `feat`: Thêm tính năng mới (Feature)
- `fix`: Sửa lỗi (Bug fix)
- `docs`: Cập nhật tài liệu (Documentation)
- `style`: Định dạng code (Formatting, missing semi colons, no code change)
- `refactor`: Tái cấu trúc code (Không thêm feat, không fix bug)
- `test`: Viết unit test / integration test
- `chore`: Cập nhật cấu hình build, package dependencies

### Ví dụ Commit Messages chuẩn:
```bash
feat(pvai): integrate stockfish wasm via web worker [CHESS-3]
fix(pvp): resolve room disconnect sync issue [CHESS-9]
docs(srs): update IEEE 830 functional requirements [CHESS-1]
chore(repo): initialize gitignore and monorepo structure
```

---

## 4. Quy trình Tạo Pull Request (PR) & Code Review
1. Tuyệt đối **KHÔNG** push trực tiếp vào `main` hoặc `develop`.
2. Tạo branch từ `develop`: `git checkout -b feature/CHESS-3-stockfish-ai develop`
3. Làm việc và commit code theo chuẩn.
4. Push nhánh lên GitHub: `git push origin feature/CHESS-3-stockfish-ai`
5. Tạo **Pull Request (PR)** từ `feature/...` vào `develop`.
6. Yêu cầu ít nhất **1 thành viên / Mentor review** trước khi bấm `Merge`.
