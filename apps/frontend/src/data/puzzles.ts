import { Square } from 'chess.js';

export interface PuzzleData {
  id: string;
  title: string;
  description: string;
  difficulty: 'Dễ' | 'Trung bình' | 'Khó';
  rating: number;
  fen: string;
  turn: 'w' | 'b';
  solution: { from: Square; to: Square; promotion?: string }[];
  hint: string;
}

export const PUZZLES_DATA: PuzzleData[] = [
  {
    id: 'puzzle-1',
    title: 'Đòn Chiếu Hết Sau 1 Nước (Mate in 1)',
    description: 'Tận dụng sơ hở ở ô f7 của quân Đen để ra đòn chiếu hết tức thì!',
    difficulty: 'Dễ',
    rating: 800,
    fen: 'r1bqkb1r/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
    turn: 'w',
    solution: [{ from: 'f3', to: 'f7' }],
    hint: 'Hãy chú ý đến sự kết hợp giữa Hậu ở f3 và Tượng ở c4 nhắm vào ô f7!',
  },
  {
    id: 'puzzle-2',
    title: 'Đòn Chiếu Hết Hàng Cuối (Back-rank Mate)',
    description: 'Hàng ngang số 8 của quân Đen đang bị mắc kẹt bởi chính các quân Tốt của mình.',
    difficulty: 'Dễ',
    rating: 1000,
    fen: '6k1/5ppp/8/8/8/8/5PPP/1R4K1 w - - 0 1',
    turn: 'w',
    solution: [{ from: 'b1', to: 'b8' }],
    hint: 'Xe trắng ở b1 có thể lao thẳng xuống hàng 8 để giáng đòn chiếu hết!',
  },
  {
    id: 'puzzle-3',
    title: 'Đòn Đôi Bắt Hậu (Knight Fork)',
    description: 'Tìm nước đi dùng quân Mã tấn công đồng thời cả Vua và Hậu của đối phương!',
    difficulty: 'Trung bình',
    rating: 1400,
    fen: 'r1b1k2r/pppp1ppp/2n5/4p3/4q3/2N5/PPPPPPPP/R2QKBNR w KQkq - 0 5',
    turn: 'w',
    solution: [{ from: 'c3', to: 'e4' }],
    hint: 'Mã ở c3 có thể nhảy vào ăn Hậu đen ở e4!',
  },
  {
    id: 'puzzle-4',
    title: 'Đòn Thí Hậu Chiếu Hết (Queen Sacrifice Mate)',
    description: 'Thí Hậu dũng cảm để mở đường cho Xe giáng đòn chiếu hết tuyệt đẹp!',
    difficulty: 'Khó',
    rating: 1800,
    fen: 'r1b2r1k/ppp2p1p/5N2/4p3/8/6R1/PPP2PPP/3R2K1 w - - 0 1',
    turn: 'w',
    solution: [{ from: 'g3', to: 'g8' }],
    hint: 'Xe ở g3 có thể phi thẳng xuống g8 chiếu hết với sự trợ công của Mã fN6!',
  },
  {
    id: 'puzzle-5',
    title: 'Đòn Xiên Tượng Đỉnh Cao (Bishop Skewer)',
    description: 'Sử dụng Tượng tạo đòn xiên bắt Hậu và Xe trên cùng một đường chéo.',
    difficulty: 'Khó',
    rating: 2000,
    fen: '2r1k3/8/8/8/8/8/2B5/4K2Q w - - 0 1',
    turn: 'w',
    solution: [{ from: 'c2', to: 'a4' }],
    hint: 'Tượng c2 có thể di chuyển ra ô a4 xiên thẳng Vua và Hậu!',
  },
];
