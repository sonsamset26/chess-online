#!/bin/bash

# ==============================================================================
# CHESS ONLINE - PRODUCTION DEPLOYMENT SCRIPT (deploy.sh)
# Tự động hóa quá trình kéo mã nguồn, cài đặt thư viện, build và khởi động PM2
# ==============================================================================

# Dừng script ngay lập tức nếu có lệnh nào bị lỗi
set -e

# Định nghĩa màu sắc cho thông báo trên Terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}       🚀 BẮT ĐẦU QUÁ TRÌNH TRIỂN KHAI CHESS ONLINE   ${NC}"
echo -e "${BLUE}======================================================${NC}"

# Đường dẫn thư mục gốc của dự án
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# ------------------------------------------------------------------------------
# BƯỚC 1: ĐỒNG BỘ MÃ NGUỒN TỪ GITHUB
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}[1/5] Đang kéo mã nguồn mới nhất từ GitHub...${NC}"
git fetch --all
git reset --hard origin/main
CURRENT_COMMIT=$(git log -1 --pretty=format:"%h - %s (%ci)")
echo -e "${GREEN}✓ Đã cập nhật lên commit: ${CURRENT_COMMIT}${NC}"

# ------------------------------------------------------------------------------
# BƯỚC 2: CẤU HÌNH VÀ BUILD BACKEND (Node.js / Express / Socket.io)
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}[2/5] Đang chuẩn bị và Build Backend...${NC}"
cd "$PROJECT_DIR/apps/backend"

# Kiểm tra file .env nếu chưa có thì tạo mẫu
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}  Tạo file cấu hình .env cho Backend...${NC}"
    cat << 'EOF' > .env
PORT=5000
NODE_ENV=production
MONGO_URI=mongodb+srv://chess_admin:sonsamset262002@cluster0.eaowx0c.mongodb.net/chess_online?retryWrites=true&w=majority&appName=Cluster0
JWT_SECRET=chess_super_secret_jwt_key_2026
EOF
fi

echo "  - Đang cài đặt thư viện Backend..."
npm install --silent

echo "  - Đang biên dịch TypeScript (npm run build)..."
npm run build

echo "  - Đang đồng bộ cơ sở dữ liệu Thế cờ & Bài học (npm run seed)..."
npm run seed || echo "  (Bỏ qua seed nếu đã tồn tại dữ liệu)"
echo -e "${GREEN}✓ Backend đã build thành công!${NC}"

# ------------------------------------------------------------------------------
# BƯỚC 3: CẤU HÌNH VÀ BUILD FRONTEND (Next.js 14 / TailwindCSS)
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}[3/5] Đang chuẩn bị và Build Frontend (Next.js 14)...${NC}"
cd "$PROJECT_DIR/apps/frontend"

# Kiểm tra file .env.local nếu chưa có thì tạo mẫu
if [ ! -f ".env.local" ]; then
    echo -e "${YELLOW}  Tạo file cấu hình .env.local cho Frontend...${NC}"
    cat << 'EOF' > .env.local
NEXT_PUBLIC_API_URL=https://chessvn.tech
NEXT_PUBLIC_SOCKET_URL=https://chessvn.tech
NEXT_PUBLIC_GOOGLE_CLIENT_ID=202723471780-lck546jjst7kt5m8jj5r9buokl6i9gjs.apps.googleusercontent.com
EOF
fi

echo "  - Đang cài đặt thư viện Frontend..."
npm install --silent

echo "  - Xóa cache build cũ và tối ưu hóa Next.js..."
rm -rf .next
npm run build
echo -e "${GREEN}✓ Frontend đã build thành công!${NC}"

# ------------------------------------------------------------------------------
# BƯỚC 4: QUẢN LÝ VÀ KHỞI ĐỘNG TIẾN TRÌNH VỚI PM2
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}[4/5] Đang cấu hình và kích hoạt các dịch vụ PM2...${NC}"
cd "$PROJECT_DIR"

# Khởi động lại Backend trong PM2
if pm2 describe chess-backend > /dev/null 2>&1; then
    echo "  - Khởi động lại process: chess-backend"
    pm2 restart chess-backend
else
    echo "  - Tạo mới process: chess-backend"
    cd "$PROJECT_DIR/apps/backend"
    pm2 start dist/server.js --name "chess-backend"
fi

# Khởi động lại Frontend trong PM2
if pm2 describe chess-frontend > /dev/null 2>&1; then
    echo "  - Khởi động lại process: chess-frontend"
    pm2 restart chess-frontend
else
    echo "  - Tạo mới process: chess-frontend"
    cd "$PROJECT_DIR/apps/frontend"
    pm2 start node_modules/next/dist/bin/next --name "chess-frontend" -- start
fi

# Lưu danh sách tiến trình để tự khởi động khi VPS reboot
pm2 save
echo -e "${GREEN}✓ PM2 đã vận hành toàn bộ dịch vụ 24/7!${NC}"

# ------------------------------------------------------------------------------
# BƯỚC 5: KIỂM TRA TRẠNG THÁI HỆ THỐNG
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}[5/5] Kiểm tra tổng thể trạng thái dịch vụ...${NC}"
pm2 status

echo -e "\n${GREEN}======================================================${NC}"
echo -e "${GREEN}  🎉 TRIỂN KHAI THÀNH CÔNG HỆ THỐNG CHESS ONLINE!     ${NC}"
echo -e "${GREEN}  🌐 Website: https://chessvn.tech                    ${NC}"
echo -e "${GREEN}  📡 Backend API: https://chessvn.tech/api             ${NC}"
echo -e "${GREEN}======================================================${NC}\n"
