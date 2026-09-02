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
  // 1. Scholar's Mate (Dễ - 800)
  {
    id: 'puzzle-1',
    title: 'Đòn Chiếu Hết Điểm f7 (Scholar\'s Mate)',
    description: 'Tận dụng sơ hở ở ô f7 của quân Đen để giáng đòn chiếu hết tức thì!',
    difficulty: 'Dễ',
    rating: 800,
    fen: 'r1bqkb1r/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
    turn: 'w',
    solution: [{ from: 'f3', to: 'f7' }],
    hint: 'Kết hợp Hậu f3 và Tượng c4 nhắm thẳng vào ô f7!',
  },
  // 2. Back-Rank Mate (Dễ - 850)
  {
    id: 'puzzle-2',
    title: 'Đòn Chiếu Hết Hàng Cuối (Back-rank Mate)',
    description: 'Hàng ngang số 8 của quân Đen bị phong tỏa bởi chính các quân Tốt của mình.',
    difficulty: 'Dễ',
    rating: 850,
    fen: '6k1/5ppp/8/8/8/8/5PPP/1R4K1 w - - 0 1',
    turn: 'w',
    solution: [{ from: 'b1', to: 'b8' }],
    hint: 'Xe trắng ở b1 có thể phi thẳng xuống hàng 8 chiếu hết!',
  },
  // 3. Knight Fork Vua & Hậu (Dễ - 900)
  {
    id: 'puzzle-3',
    title: 'Đòn Chĩa Đôi Bắt Hậu (Knight Fork)',
    description: 'Tìm nước nhảy Mã tấn công bắt gọn Hậu đối phương đang sơ hở!',
    difficulty: 'Dễ',
    rating: 900,
    fen: 'r1b1k2r/pppp1ppp/2n5/4p3/4q3/2N5/PPPPPPPP/R2QKBNR w KQkq - 0 5',
    turn: 'w',
    solution: [{ from: 'c3', to: 'e4' }],
    hint: 'Mã ở c3 có thể nhảy vào ăn ngay quân Hậu đen ở e4.',
  },
  // 4. Arabian Mate (Dễ - 950)
  {
    id: 'puzzle-4',
    title: 'Đòn Chiếu Hết Arabian Mate (Xe & Mã)',
    description: 'Đòn phối hợp kinh điển giữa Xe và Mã ép Vua vào góc bàn cờ.',
    difficulty: 'Dễ',
    rating: 950,
    fen: '7k/R7/5N2/8/8/8/8/6K1 w - - 0 1',
    turn: 'w',
    solution: [{ from: 'a7', to: 'h7' }],
    hint: 'Xe trắng ở a7 có thể lao sang cột h để chiếu hết với sự bảo vệ của Mã f6.',
  },
  // 5. Queen Battery Mate (Dễ - 1000)
  {
    id: 'puzzle-5',
    title: 'Đòn Hậu & Tượng Bắn Phá (Battery Mate)',
    description: 'Hậu phối hợp Tượng kiểm soát đường chéo b1-h7 giáng đòn chiếu hết.',
    difficulty: 'Dễ',
    rating: 1000,
    fen: '6k1/5ppp/8/7Q/8/3B4/8/6K1 w - - 0 1',
    turn: 'w',
    solution: [{ from: 'h5', to: 'h7' }],
    hint: 'Hậu h5 được Tượng d3 bảo kê phi thẳng vào h7 chiếu hết.',
  },
  // 6. Anastasia's Mate (Dễ - 1050)
  {
    id: 'puzzle-6',
    title: 'Đòn Chiếu Hết Anastasia (Xe & Mã Cột h)',
    description: 'Mã chặn các ô thoát và Xe dũng mãnh lao xuống chiếu hết ở hàng cuối.',
    difficulty: 'Dễ',
    rating: 1050,
    fen: '7k/4N1p1/8/R7/8/8/8/6K1 w - - 0 1',
    turn: 'w',
    solution: [{ from: 'a5', to: 'h5' }],
    hint: 'Xe a5 phi sang h5 giáng đòn sấm sét với sự che chở của Mã e7!',
  },
  // 7. Bishop Pin bắt Xe (Dễ - 1100)
  {
    id: 'puzzle-7',
    title: 'Đòn Ghim Tượng Bắt Xe (Bishop Pin)',
    description: 'Tượng trắng ghim Xe đen vào Vua đen, tạo thế bắt quân không thể chống đỡ.',
    difficulty: 'Dễ',
    rating: 1100,
    fen: '4k3/3r4/8/8/B7/8/8/6K1 w - - 0 1',
    turn: 'w',
    solution: [{ from: 'a4', to: 'd7' }],
    hint: 'Tượng a4 có thể ăn ngay Xe đen ở d7!',
  },
  // 8. Đòn Xiên Skewer Bắt Xe (Trung bình - 1200)
  {
    id: 'puzzle-8',
    title: 'Đòn Xiên Hậu Bắt Xe (Queen Skewer)',
    description: 'Hậu chiếu Vua đồng thời xiên bắt Xe phía sau trên cùng đường thẳng.',
    difficulty: 'Trung bình',
    rating: 1200,
    fen: '4k2r/8/8/8/8/8/8/Q3K3 w - - 0 1',
    turn: 'w',
    solution: [{ from: 'a1', to: 'h8' }],
    hint: 'Hậu a1 có thể ăn thẳng Xe đen ở h8!',
  },
  // 9. Smothered Mate (Trung bình - 1250)
  {
    id: 'puzzle-9',
    title: 'Chiếu Thắt Bóp Của Mã (Smothered Mate)',
    description: 'Vua đen bị bao vây chặt bởi chính quân của mình và bị Mã chiếu hết.',
    difficulty: 'Trung bình',
    rating: 1250,
    fen: '6rk/6pp/7N/8/8/8/8/6K1 w - - 0 1',
    turn: 'w',
    solution: [{ from: 'h6', to: 'f7' }],
    hint: 'Mã ở h6 nhảy vào ô f7 tạo đòn thắt bóp ngạt thở!',
  },
  // 10. Discovered Check (Trung bình - 1300)
  {
    id: 'puzzle-10',
    title: 'Đòn Chiếu Mở Bắt Hậu (Discovered Check)',
    description: 'Di chuyển Tượng chiếu Vua, đồng thời mở đường cho Xe ăn Hậu đối phương.',
    difficulty: 'Trung bình',
    rating: 1300,
    fen: 'r3k3/8/8/q7/4B3/8/8/4R1K1 w - - 0 1',
    turn: 'w',
    solution: [{ from: 'e4', to: 'c6' }],
    hint: 'Tượng c6 vừa chiếu Vua đen vừa mở đường cột e cho Xe!',
  },
  // 11. Deflection - Đòn Đánh Lạc Hướng (Trung bình - 1350)
  {
    id: 'puzzle-11',
    title: 'Đòn Đánh Lạc Hướng Xe Đáy (Deflection)',
    description: 'Dụ quân Xe bảo vệ rời khỏi hàng cuối để giáng đòn chiếu hết.',
    difficulty: 'Trung bình',
    rating: 1350,
    fen: '3r2k1/5ppp/8/8/8/8/1Q6/4R1K1 w - - 0 1',
    turn: 'w',
    solution: [{ from: 'b2', to: 'b8' }],
    hint: 'Thí Hậu vào b8 dụ Xe d8 rời vị trí phòng thủ!',
  },
  // 12. Removing the Defender (Trung bình - 1400)
  {
    id: 'puzzle-12',
    title: 'Triệt Hạ Quân Phòng Thủ (Remove Defender)',
    description: 'Tiêu diệt quân Mã bảo vệ ô quan trọng để mở toang đợt tấn công.',
    difficulty: 'Trung bình',
    rating: 1400,
    fen: 'r1bq1rk1/ppp2ppp/5n2/4p3/1bB1P2Q/2N5/PPP2PPP/R1B2RK1 w - - 0 1',
    turn: 'w',
    solution: [{ from: 'c1', to: 'g5' }],
    hint: 'Tượng c1 phi lên g5 ghim và triệt hạ Mã f6.',
  },
  // 13. Double Check Chiếu Kép (Trung bình - 1450)
  {
    id: 'puzzle-13',
    title: 'Đòn Chiếu Kép Sấm Sét (Double Check)',
    description: 'Cả Xe và Mã đồng thời chiếu Vua, buộc đối phương không thể che chắn.',
    difficulty: 'Trung bình',
    rating: 1450,
    fen: '4k3/8/8/8/4N3/8/8/4R1K1 w - - 0 1',
    turn: 'w',
    solution: [{ from: 'e4', to: 'f6' }],
    hint: 'Mã f6 chiếu kép cùng Xe e1!',
  },
  // 14. Dovetail Mate (Trung bình - 1500)
  {
    id: 'puzzle-14',
    title: 'Đòn Chiếu Hết Đuôi Chim Én (Dovetail Mate)',
    description: 'Hậu áp sát Vua đen chiếu hết khi các ô chạy trốn bị chặn kín.',
    difficulty: 'Trung bình',
    rating: 1500,
    fen: '8/6pk/7p/7Q/8/8/8/6K1 w - - 0 1',
    turn: 'w',
    solution: [{ from: 'h5', to: 'g6' }],
    hint: 'Hậu lao vào g6 giáng đòn chiếu hết tuyệt đẹp!',
  },
  // 15. Queen Sacrifice Mate (Khó - 1600)
  {
    id: 'puzzle-15',
    title: 'Đòn Thí Hậu Mở Đường Chiếu Hết',
    description: 'Dũng cảm thí quân Hậu vào g8 để mở đường cho Xe giáng đòn chiếu hết!',
    difficulty: 'Khó',
    rating: 1600,
    fen: 'r1b2r1k/ppp2p1p/5N2/4p3/8/6R1/PPP2PPP/3R2K1 w - - 0 1',
    turn: 'w',
    solution: [{ from: 'g3', to: 'g8' }],
    hint: 'Xe g3 phi thẳng xuống g8 chiếu với sự hỗ trợ của Mã f6!',
  },
  // 16. Greek Gift Sacrifice (Khó - 1700)
  {
    id: 'puzzle-16',
    title: 'Đòn Thí Tượng Hy Lạp (Greek Gift Bxh7+)',
    description: 'Thí Tượng tại h7 phá tan thành lũy che chắn Vua đối phương.',
    difficulty: 'Khó',
    rating: 1700,
    fen: 'r1bq1rk1/pppn1ppp/4p3/3pP3/1b1P4/2NB1N2/PPP2PPP/R2QK2R w KQ - 0 8',
    turn: 'w',
    solution: [{ from: 'd3', to: 'h7' }],
    hint: 'Tượng d3 có thể ăn thẳng vào h7 chiếu Vua phá vỡ thế trận!',
  },
  // 17. Pawn Promotion Tactics (Khó - 1800)
  {
    id: 'puzzle-17',
    title: 'Tàn Cuộc Phong Cấp Tốt Quyết Định (Promotion)',
    description: 'Đẩy Tốt xuống hàng 8 phong Hậu quyết định thắng bại của ván đấu.',
    difficulty: 'Khó',
    rating: 1800,
    fen: '8/4P1k1/8/8/8/8/8/4K3 w - - 0 1',
    turn: 'w',
    solution: [{ from: 'e7', to: 'e8', promotion: 'q' }],
    hint: 'Đẩy Tốt e7 lên e8 phong Hậu chiến thắng!',
  },
  // 18. Hook Mate (Khó - 1850)
  {
    id: 'puzzle-18',
    title: 'Đòn Chiếu Móc Lưỡi Câu (Hook Mate)',
    description: 'Xe, Mã và Tốt tạo thành chiếc móc câu siết chặt vòng vây bắt Vua.',
    difficulty: 'Khó',
    rating: 1850,
    fen: '5r1k/6pp/5Np1/6P1/8/8/8/6KR w - - 0 1',
    turn: 'w',
    solution: [{ from: 'h1', to: 'h7' }],
    hint: 'Xe h1 ăn Tốt h7 chiếu hết với sự bảo vệ của Mã f6!',
  },
  // 19. Blind Swine Mate (Khó - 1900)
  {
    id: 'puzzle-19',
    title: 'Song Xe Hàng 7 Tàn Phá (Blind Swine Mate)',
    description: 'Cặp Xe chiếm lĩnh hàng ngang số 7 hủy diệt toàn bộ hệ thống phòng thủ.',
    difficulty: 'Khó',
    rating: 1900,
    fen: '5rk1/1R4p1/7p/8/8/8/1R6/6K1 w - - 0 1',
    turn: 'w',
    solution: [{ from: 'b7', to: 'g7' }],
    hint: 'Xe b7 ăn Tốt g7 mở đòn phối hợp Song Xe!',
  },
  // 20. Skewer Tượng Xiên Hậu & Xe (Khó - 2000)
  {
    id: 'puzzle-20',
    title: 'Đòn Xiên Tượng Đỉnh Cao (Bishop Skewer)',
    description: 'Sử dụng Tượng tạo đòn xiên bắt Hậu và Xe trên cùng một đường chéo.',
    difficulty: 'Khó',
    rating: 2000,
    fen: '2r1k3/8/8/8/8/8/2B5/4K2Q w - - 0 1',
    turn: 'w',
    solution: [{ from: 'c2', to: 'a4' }],
    hint: 'Tượng c2 di chuyển ra a4 xiên thẳng Vua và Xe!',
  },
];
