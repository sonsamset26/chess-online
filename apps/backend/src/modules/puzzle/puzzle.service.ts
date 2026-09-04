import { PuzzleModel, IPuzzle } from './puzzle.model';

export const INITIAL_PUZZLES = [
  {
    "puzzleId": "puzzle-1",
    "title": "Phối Hợp Hậu & Tượng Bắn Phá",
    "description": "Hậu phối hợp cùng Tượng kiểm soát đường chéo giáng đòn quyết định.",
    "difficulty": "Trung bình",
    "rating": 1000,
    "fen": "6k1/5ppp/8/7Q/8/3B4/8/6K1 w - - 0 1",
    "turn": "w",
    "solution": [
      {
        "from": "h5",
        "to": "h7"
      }
    ],
    "hint": "Hậu h5 được Tượng d3 hỗ trợ phi thẳng vào h7 chiếu hết!"
  },
  {
    "puzzleId": "puzzle-2",
    "title": "Chiếu Hết Anastasia",
    "description": "Mã khống chế ô thoát, Xe dũng mãnh lao sang cột h kết liễu trận đấu.",
    "difficulty": "Trung bình",
    "rating": 1020,
    "fen": "7k/4N1p1/8/R7/8/8/8/6K1 w - - 0 1",
    "turn": "w",
    "solution": [
      {
        "from": "a5",
        "to": "h5"
      }
    ],
    "hint": "Xe a5 lao sang h5 giáng đòn sấm sét với sự che chở của Mã e7!"
  },
  {
    "puzzleId": "puzzle-3",
    "title": "Đòn Phối Hợp Xe & Mã (Arabian Mate)",
    "description": "Đòn phối hợp kinh điển ép Vua đối phương vào góc không lối thoát.",
    "difficulty": "Trung bình",
    "rating": 1050,
    "fen": "7k/R7/5N2/8/8/8/8/6K1 w - - 0 1",
    "turn": "w",
    "solution": [
      {
        "from": "a7",
        "to": "h7"
      }
    ],
    "hint": "Xe a7 phi sang h7 chiếu với sự bảo vệ vững chắc của Mã f6."
  },
  {
    "puzzleId": "puzzle-4",
    "title": "Đánh Lạc Hướng Hàng Cuối",
    "description": "Thí Hậu dụ quân phòng thủ hàng ngang đáy để mở toang đường chiếu hết.",
    "difficulty": "Trung bình",
    "rating": 1080,
    "fen": "3r2k1/5ppp/8/8/8/8/1Q6/4R1K1 w - - 0 1",
    "turn": "w",
    "solution": [
      {
        "from": "b2",
        "to": "b8"
      }
    ],
    "hint": "Hậu b2 lao xuống b8 buộc Xe đối phương phải rời vị trí phòng thủ!"
  },
  {
    "puzzleId": "puzzle-5",
    "title": "Ghim Tượng Tuyệt Đối Bắt Xe",
    "description": "Tượng ghim chặt Xe vào Vua, tạo thế bắt quân không thể tháo gỡ.",
    "difficulty": "Trung bình",
    "rating": 1100,
    "fen": "4k3/3r4/8/8/B7/8/8/6K1 w - - 0 1",
    "turn": "w",
    "solution": [
      {
        "from": "a4",
        "to": "d7"
      }
    ],
    "hint": "Tượng a4 có thể ăn ngay Xe d7 giành chiến thắng!"
  },
  {
    "puzzleId": "puzzle-6",
    "title": "Chĩa Đôi Vua & Xe",
    "description": "Nước nhảy Mã hiểm hóc vừa chiếu Vua vừa bắt gọn quân Xe đối phương.",
    "difficulty": "Trung bình",
    "rating": 1130,
    "fen": "2r1k3/8/8/8/4N3/8/8/4K3 w - - 0 1",
    "turn": "w",
    "solution": [
      {
        "from": "e4",
        "to": "d6"
      }
    ],
    "hint": "Mã e4 nhảy vào d6 chiếu Vua và tấn công Xe c8!"
  },
  {
    "puzzleId": "puzzle-7",
    "title": "Đòn Xiên Hậu Bắt Xe",
    "description": "Hậu chiếu Vua trên đường thẳng, đồng thời xiên bắt quân Xe phía sau.",
    "difficulty": "Trung bình",
    "rating": 1160,
    "fen": "4k2r/8/8/8/8/8/8/Q3K3 w - - 0 1",
    "turn": "w",
    "solution": [
      {
        "from": "a1",
        "to": "h8"
      }
    ],
    "hint": "Hậu a1 có thể ăn thẳng Xe h8 giành ưu thế áp đảo!"
  },
  {
    "puzzleId": "puzzle-8",
    "title": "Chiếu Thắt Bóp Của Mã",
    "description": "Vua đối phương bị bao vây chặt bởi chính quân của mình và bị Mã chiếu hết.",
    "difficulty": "Trung bình",
    "rating": 1200,
    "fen": "6rk/6pp/7N/8/8/8/8/6K1 w - - 0 1",
    "turn": "w",
    "solution": [
      {
        "from": "h6",
        "to": "f7"
      }
    ],
    "hint": "Mã h6 nhảy vào f7 tạo đòn ngạt thở kết liễu trận đấu!"
  },
  {
    "puzzleId": "puzzle-9",
    "title": "Chiếu Mở Bắt Hậu",
    "description": "Di chuyển Tượng chiếu Vua, đồng thời mở đường cho Xe ăn Hậu đối phương.",
    "difficulty": "Trung bình",
    "rating": 1220,
    "fen": "r3k3/8/8/q7/4B3/8/8/4R1K1 w - - 0 1",
    "turn": "w",
    "solution": [
      {
        "from": "e4",
        "to": "c6"
      }
    ],
    "hint": "Tượng e4 nhảy sang c6 chiếu mở cho Xe kiểm soát cột e!"
  },
  {
    "puzzleId": "puzzle-10",
    "title": "Hậu & Mã Phối Hợp Sát Thủ",
    "description": "Mã khống chế ô hiểm, Hậu áp sát đè bẹp hệ thống phòng ngự.",
    "difficulty": "Trung bình",
    "rating": 1250,
    "fen": "5rk1/5ppp/5N2/8/8/8/5PPP/4Q1K1 w - - 0 1",
    "turn": "w",
    "solution": [
      {
        "from": "e1",
        "to": "e8"
      }
    ],
    "hint": "Hậu e1 lao thẳng xuống e8 phối hợp cùng Mã f6!"
  },
  {
    "puzzleId": "puzzle-11",
    "title": "Chiếu Hết Đuôi Chim Én",
    "description": "Hậu áp sát Vua khi các ô chạy trốn bị chặn kín hoàn toàn.",
    "difficulty": "Trung bình",
    "rating": 1300,
    "fen": "8/6pk/7p/7Q/8/8/8/6K1 w - - 0 1",
    "turn": "w",
    "solution": [
      {
        "from": "h5",
        "to": "g6"
      }
    ],
    "hint": "Hậu h5 lao vào g6 giáng đòn quyết định!"
  },
  {
    "puzzleId": "puzzle-12",
    "title": "Triệt Hạ Quân Phòng Thủ",
    "description": "Tiêu diệt quân Mã phòng ngự then chốt để mở toang đợt công phá.",
    "difficulty": "Trung bình",
    "rating": 1330,
    "fen": "r1bq1rk1/ppp2ppp/5n2/4p3/1bB1P2Q/2N5/PPP2PPP/R1B2RK1 w - - 0 1",
    "turn": "w",
    "solution": [
      {
        "from": "c1",
        "to": "g5"
      }
    ],
    "hint": "Tượng c1 phi lên g5 ghim và triệt hạ Mã f6!"
  },
  {
    "puzzleId": "puzzle-13",
    "title": "Chiếu Kép Sấm Sét",
    "description": "Xe và Mã đồng thời chiếu Vua, đối phương không thể che chắn hay cản phá.",
    "difficulty": "Trung bình",
    "rating": 1360,
    "fen": "4k3/8/8/8/4N3/8/8/4R1K1 w - - 0 1",
    "turn": "w",
    "solution": [
      {
        "from": "e4",
        "to": "f6"
      }
    ],
    "hint": "Mã e4 nhảy vào f6 tạo thế chiếu kép cùng Xe e1!"
  },
  {
    "puzzleId": "puzzle-14",
    "title": "Đột Phá Bắt Đôi Tốt f7",
    "description": "Khai thác điểm yếu cố hữu ở cánh Vua để giành lợi thế quân số áp đảo.",
    "difficulty": "Trung bình",
    "rating": 1400,
    "fen": "r1bqk2r/pppp1ppp/2n5/4p3/2B1n3/2P2N2/PPP2PPP/R1BQK2R w KQkq - 0 1",
    "turn": "w",
    "solution": [
      {
        "from": "d1",
        "to": "d5"
      }
    ],
    "hint": "Hậu d1 phi lên d5 đe dọa chiếu hết ở f7 đồng thời bắt Mã e4!"
  },
  {
    "puzzleId": "puzzle-15",
    "title": "Chiếu Hết Hai Tượng Bắt Chéo (Boden Mate)",
    "description": "Cặp Tượng đan chéo hiểm hóc bịt kín mọi ngả đường thoát của Vua.",
    "difficulty": "Trung bình",
    "rating": 1430,
    "fen": "2kr4/ppp2ppp/8/8/1B6/8/2B5/4K3 w - - 0 1",
    "turn": "w",
    "solution": [
      {
        "from": "c2",
        "to": "f5"
      }
    ],
    "hint": "Tượng c2 di chuyển lên f5 chiếu Vua đen!"
  },
  {
    "puzzleId": "puzzle-16",
    "title": "Ghim Hậu Vào Vua Trực Diện",
    "description": "Sử dụng Xe chiếm lĩnh cột mở để khóa chặt Hậu đối phương.",
    "difficulty": "Trung bình",
    "rating": 1460,
    "fen": "4k3/4q3/8/8/8/8/8/4R1K1 w - - 0 1",
    "turn": "w",
    "solution": [
      {
        "from": "e1",
        "to": "e7"
      }
    ],
    "hint": "Xe e1 ăn thẳng Hậu e7 khi Hậu bị ghim chặt vào Vua!"
  },
  {
    "puzzleId": "puzzle-17",
    "title": "Đòn Chĩa Ba Hậu Trung Tâm",
    "description": "Hậu kiểm soát trung tâm tấn công đồng thời 3 điểm yếu trên bàn cờ.",
    "difficulty": "Trung bình",
    "rating": 1500,
    "fen": "r1b1k2r/pp3ppp/2p5/4q3/1Q6/8/PPP2PPP/R1B1K2R w KQkq - 0 1",
    "turn": "w",
    "solution": [
      {
        "from": "c1",
        "to": "e3"
      }
    ],
    "hint": "Tượng c1 phát triển lên e3 hóa giải nước chiếu và củng cố thế trận!"
  },
  {
    "puzzleId": "puzzle-18",
    "title": "Chặn Đường Tiếp Tế Hàng Cuối",
    "description": "Chặn đứng đường cứu viện của đối phương để thực hiện đòn kết liễu.",
    "difficulty": "Trung bình",
    "rating": 1520,
    "fen": "3r2k1/ppp2ppp/8/8/8/8/1P3PPP/3RR1K1 w - - 0 1",
    "turn": "w",
    "solution": [
      {
        "from": "d1",
        "to": "d8"
      }
    ],
    "hint": "Xe d1 đổi Xe d8 ép đối phương vào thế chiếu hết hàng cuối!"
  },
  {
    "puzzleId": "puzzle-19",
    "title": "Tấn Công Xuyên Thấu (X-Ray)",
    "description": "Sức mạnh xuyên thấu của Hậu và Xe xuyên qua tuyến phòng thủ đối phương.",
    "difficulty": "Trung bình",
    "rating": 1540,
    "fen": "4r1k1/5ppp/8/8/8/8/1Q3PPP/4R1K1 w - - 0 1",
    "turn": "w",
    "solution": [
      {
        "from": "e1",
        "to": "e8"
      }
    ],
    "hint": "Xe e1 lao xuống e8 ăn Xe đen và chiếu hết!"
  },
  {
    "puzzleId": "puzzle-20",
    "title": "Bẫy Hậu Trong Không Gian Hẹp",
    "description": "Dồn ép Hậu đối phương vào góc chết không còn ô cờ an toàn để rút lui.",
    "difficulty": "Trung bình",
    "rating": 1550,
    "fen": "r1b1k2r/pppp1ppp/8/8/1b2q3/2P5/PP1B1PPP/R2QKB1R w KQkq - 0 1",
    "turn": "w",
    "solution": [
      {
        "from": "d1",
        "to": "e2"
      }
    ],
    "hint": "Hậu d1 lên e2 ghim thẳng vào Hậu đối phương!"
  },
  {
    "puzzleId": "puzzle-21",
    "title": "Thí Xe Mở Đường Chiếu Hết",
    "description": "Dũng cảm thí Xe vào g8 để phá toang cánh Vua và dứt điểm ván cờ.",
    "difficulty": "Khó",
    "rating": 1600,
    "fen": "r1b2r1k/ppp2p1p/5N2/4p3/8/6R1/PPP2PPP/3R2K1 w - - 0 1",
    "turn": "w",
    "solution": [
      {
        "from": "g3",
        "to": "g8"
      }
    ],
    "hint": "Xe g3 phi thẳng vào g8 chiếu với sự hỗ trợ của Mã f6!"
  },
  {
    "puzzleId": "puzzle-22",
    "title": "Thí Tượng Phá Thành Hy Lạp",
    "description": "Đòn thí Tượng kinh điển phá tan thành lũy che chắn Vua đối phương.",
    "difficulty": "Khó",
    "rating": 1650,
    "fen": "r1bq1rk1/pppn1ppp/4p3/3pP3/1b1P4/2NB1N2/PPP2PPP/R2QK2R w KQ - 0 8",
    "turn": "w",
    "solution": [
      {
        "from": "d3",
        "to": "h7"
      }
    ],
    "hint": "Tượng d3 ăn thẳng vào h7 chiếu Vua phá vỡ thế phòng ngự!"
  },
  {
    "puzzleId": "puzzle-23",
    "title": "Phong Cấp Tốt Quyết Định",
    "description": "Đẩy Tốt xuống hàng cuối phong cấp giành thắng lợi quyết định ở cuối trận.",
    "difficulty": "Khó",
    "rating": 1700,
    "fen": "8/4P1k1/8/8/8/8/8/4K3 w - - 0 1",
    "turn": "w",
    "solution": [
      {
        "from": "e7",
        "to": "e8",
        "promotion": "q"
      }
    ],
    "hint": "Đẩy Tốt e7 lên e8 phong Hậu chiến thắng!"
  },
  {
    "puzzleId": "puzzle-24",
    "title": "Đòn Móc Lưỡi Câu (Hook Mate)",
    "description": "Xe, Mã và Tốt tạo thành vòng vây hình chiếc móc siết chặt bắt Vua.",
    "difficulty": "Khó",
    "rating": 1750,
    "fen": "5r1k/6pp/5Np1/6P1/8/8/8/6KR w - - 0 1",
    "turn": "w",
    "solution": [
      {
        "from": "h1",
        "to": "h7"
      }
    ],
    "hint": "Xe h1 ăn Tốt h7 chiếu hết với sự bảo vệ của Mã f6!"
  },
  {
    "puzzleId": "puzzle-25",
    "title": "Song Xe Hàng 7 Tàn Phá",
    "description": "Cặp Xe chiếm lĩnh hàng ngang số 7 quét sạch toàn bộ hệ thống phòng thủ.",
    "difficulty": "Khó",
    "rating": 1800,
    "fen": "5rk1/1R4p1/7p/8/8/8/1R6/6K1 w - - 0 1",
    "turn": "w",
    "solution": [
      {
        "from": "b7",
        "to": "g7"
      }
    ],
    "hint": "Xe b7 ăn Tốt g7 mở đòn phối hợp Song Xe!"
  },
  {
    "puzzleId": "puzzle-26",
    "title": "Xiên Tượng Đỉnh Cao",
    "description": "Sử dụng Tượng tạo đòn xiên bắt Hậu và Xe trên cùng một đường chéo.",
    "difficulty": "Khó",
    "rating": 1850,
    "fen": "2r1k3/8/8/8/8/8/2B5/4K2Q w - - 0 1",
    "turn": "w",
    "solution": [
      {
        "from": "c2",
        "to": "a4"
      }
    ],
    "hint": "Tượng c2 di chuyển ra a4 xiên thẳng Vua và Xe!"
  },
  {
    "puzzleId": "puzzle-27",
    "title": "Đòn Phong Tỏa Giao Điểm",
    "description": "Cắt đứt liên lạc giữa các quân phòng ngự đối phương bằng nước đi hiểm hóc.",
    "difficulty": "Khó",
    "rating": 1900,
    "fen": "2r3k1/5ppp/8/8/4B3/8/1Q3PPP/6K1 w - - 0 1",
    "turn": "w",
    "solution": [
      {
        "from": "b2",
        "to": "b7"
      }
    ],
    "hint": "Hậu b2 tiến lên b7 ghim và đe dọa bắt Xe c8!"
  },
  {
    "puzzleId": "puzzle-28",
    "title": "Giải Phóng Ô Trọng Yếu",
    "description": "Thí quân dũng cảm để mở đường cho quân mạnh hơn tiến vào dứt điểm.",
    "difficulty": "Khó",
    "rating": 1950,
    "fen": "4r1k1/ppp2ppp/8/8/8/2B5/1Q3PPP/3R2K1 w - - 0 1",
    "turn": "w",
    "solution": [
      {
        "from": "c3",
        "to": "g7"
      }
    ],
    "hint": "Tượng c3 ăn g7 phá vỡ cấu trúc phòng thủ cánh Vua!"
  },
  {
    "puzzleId": "puzzle-29",
    "title": "Chiếu Mở Cối Xay Gió",
    "description": "Nước đi rút quân liên hoàn vừa chiếu vừa cướp đoạt lợi thế vật chất.",
    "difficulty": "Khó",
    "rating": 2000,
    "fen": "5rk1/6pp/8/8/8/8/1R3BPP/6K1 w - - 0 1",
    "turn": "w",
    "solution": [
      {
        "from": "f2",
        "to": "c5"
      }
    ],
    "hint": "Tượng f2 nhảy lên c5 mở đường cho Xe b2 kiểm soát thế trận!"
  },
  {
    "puzzleId": "puzzle-30",
    "title": "Thí Hậu Tuyệt Tác Dứt Điểm",
    "description": "Thí Hậu ngoạn mục phá vỡ phòng tuyến cuối cùng đưa ván cờ tới chiến thắng.",
    "difficulty": "Khó",
    "rating": 2050,
    "fen": "5rk1/5ppp/8/8/8/2B5/1Q3PPP/4R1K1 w - - 0 1",
    "turn": "w",
    "solution": [
      {
        "from": "c3",
        "to": "g7"
      }
    ],
    "hint": "Tượng c3 ăn Tốt g7 phá tung hàng phòng ngự đối phương!"
  }
];

export class PuzzleService {
  // Lấy toàn bộ bài tập cờ thế từ CSDL Cloud MongoDB
  async getAllPuzzles(): Promise<IPuzzle[]> {
    let puzzles = await PuzzleModel.find().sort({ rating: 1 });

    // Nếu CSDL MongoDB Atlas chưa có bài tập nào -> Tự động nạp dữ liệu ban đầu!
    if (puzzles.length === 0) {
      console.log('🌱 [MongoDB Cloud] Khởi tạo dữ liệu cờ thế ban đầu vào Atlas...');
      puzzles = await PuzzleModel.insertMany(INITIAL_PUZZLES) as any;
    }

    return puzzles;
  }

  // Khởi tạo/Nạp lại bài tập cờ thế vào MongoDB Atlas
  async seedPuzzles(): Promise<void> {
    await PuzzleModel.deleteMany({});
    await PuzzleModel.insertMany(INITIAL_PUZZLES);
    console.log('✅ [MongoDB Cloud] Đã nạp thành công bộ cờ thế vào MongoDB Atlas!');
  }
}

export const puzzleService = new PuzzleService();
