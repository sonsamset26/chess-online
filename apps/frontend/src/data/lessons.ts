import { Square } from 'chess.js';

export interface LessonStep {
  stepNumber: number;
  title: string;
  instruction: string;
  initialFen: string;
  playerColor: 'w' | 'b';
  targetMove: { from: Square; to: Square; promotion?: string };
  hint: string;
  explanation: string;
}

export interface LessonData {
  id: string;
  chapter: string;
  title: string;
  badge: string;
  summary: string;
  steps: LessonStep[];
}

export const LESSONS_DATA: LessonData[] = [
  // CHƯƠNG 1: NHẬP MÔN & NƯỚC ĐI CÁC QUÂN CỜ
  {
    id: 'lesson-pawn',
    chapter: 'Chương 1: Nhập môn & Nước đi',
    title: '1. Quân Tốt (Pawn)',
    badge: 'Cơ bản',
    summary: 'Quân Tốt là lá chắn tiên phong. Tốt đi thẳng 1-2 ô ở nước đầu, ăn chéo và phong cấp ở hàng cuối.',
    steps: [
      {
        stepNumber: 1,
        title: 'Nước đi đầu tiên của Tốt',
        instruction: 'Ở vị trí xuất phát, quân Tốt có thể tiến 2 ô về phía trước. Hãy di chuyển Tốt từ e2 lên e4!',
        initialFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        playerColor: 'w',
        targetMove: { from: 'e2', to: 'e4' },
        hint: 'Kéo hoặc click quân Tốt ở ô e2 và đưa tới ô e4.',
        explanation: 'Tuyệt vời! Nước cờ e2-e4 là một trong những nước khai cuộc phổ biến nhất, giúp chiếm lĩnh trung tâm bàn cờ.',
      },
      {
        stepNumber: 2,
        title: 'Cách Tốt ăn quân',
        instruction: 'Quân Tốt không ăn thẳng mà ăn chéo 1 ô phía trước. Hãy dùng Tốt e4 ăn quân Tốt đen ở ô d5!',
        initialFen: 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
        playerColor: 'w',
        targetMove: { from: 'e4', to: 'd5' },
        hint: 'Tốt e4 có thể ăn chéo sang ô d5.',
        explanation: 'Chính xác! Quân Tốt đi thẳng nhưng luôn ăn chéo 1 ô về phía trước.',
      },
      {
        stepNumber: 3,
        title: 'Phong Cấp Cho Tốt (Pawn Promotion)',
        instruction: 'Khi quân Tốt tiến tới hàng cuối cùng (hàng 8 với Trắng), nó sẽ được hóa thân thành Hậu, Xe, Tượng hoặc Mã. Hãy đẩy Tốt từ e7 lên e8!',
        initialFen: '8/4P3/8/8/8/8/8/4K2k w - - 0 1',
        playerColor: 'w',
        targetMove: { from: 'e7', to: 'e8', promotion: 'q' },
        hint: 'Đẩy Tốt e7 lên ô e8.',
        explanation: 'Xuất sắc! Quân Tốt đã phong Hậu thành công! Đây là mục tiêu chiến lược tối thượng trong cờ tàn.',
      },
    ],
  },
  {
    id: 'lesson-rook',
    chapter: 'Chương 1: Nhập môn & Nước đi',
    title: '2. Quân Xe (Rook)',
    badge: 'Cơ bản',
    summary: 'Quân Xe là quân cờ hạng nặng kiểm soát các hàng ngang và hàng dọc không giới hạn khoảng cách.',
    steps: [
      {
        stepNumber: 1,
        title: 'Di chuyển theo Hàng dọc',
        instruction: 'Quân Xe có thể lướt thẳng dọc theo cột mở. Hãy di chuyển Xe từ a1 lên a7!',
        initialFen: '8/8/8/8/8/8/8/R3K2k w - - 0 1',
        playerColor: 'w',
        targetMove: { from: 'a1', to: 'a7' },
        hint: 'Kéo Xe từ ô a1 thẳng lên ô a7.',
        explanation: 'Rất tốt! Chiếm lĩnh hàng ngang thứ 7 bằng Xe là một ưu thế chiến lược cực lớn.',
      },
      {
        stepNumber: 2,
        title: 'Ăn quân theo Hàng ngang',
        instruction: 'Xe ăn quân theo đường thẳng mà nó di chuyển. Hãy dùng Xe a7 ăn quân Mã đen ở h7!',
        initialFen: '8/R6n/8/8/8/8/8/4K2k w - - 0 1',
        playerColor: 'w',
        targetMove: { from: 'a7', to: 'h7' },
        hint: 'Kéo Xe a7 lướt ngang sang ô h7 để ăn quân Mã.',
        explanation: 'Chính xác! Quân Xe quét sạch các chướng ngại vật trên đường thẳng của nó.',
      },
    ],
  },
  {
    id: 'lesson-bishop',
    chapter: 'Chương 1: Nhập môn & Nước đi',
    title: '3. Quân Tượng (Bishop)',
    badge: 'Cơ bản',
    summary: 'Quân Tượng di chuyển và ăn quân theo các đường chéo cùng màu ô xuất phát.',
    steps: [
      {
        stepNumber: 1,
        title: 'Kiểm soát Đường chéo lớn',
        instruction: 'Tượng ô sáng di chuyển trên các ô màu trắng. Hãy đưa Tượng từ c1 lên ô f4!',
        initialFen: '8/8/8/8/8/8/8/2B1K2k w - - 0 1',
        playerColor: 'w',
        targetMove: { from: 'c1', to: 'f4' },
        hint: 'Kéo Tượng từ c1 theo đường chéo tới f4.',
        explanation: 'Tuyệt vời! Tượng ở ô trung tâm f4 kiểm soát một dải đường chéo vô cùng rộng lớn.',
      },
      {
        stepNumber: 2,
        title: 'Đòn Tượng ăn quân từ xa',
        instruction: 'Hãy dùng Tượng ở f4 ăn quân Xe đen ở ô c7 theo đường chéo!',
        initialFen: '8/2r5/8/8/5B2/8/8/4K2k w - - 0 1',
        playerColor: 'w',
        targetMove: { from: 'f4', to: 'c7' },
        hint: 'Di chuyển Tượng f4 theo đường chéo lên ô c7.',
        explanation: 'Xuất sắc! Đòn bắn tỉa từ xa của Tượng luôn là nỗi khiếp sợ của đối phương.',
      },
    ],
  },
  {
    id: 'lesson-knight',
    chapter: 'Chương 1: Nhập môn & Nước đi',
    title: '4. Quân Mã (Knight)',
    badge: 'Cơ bản',
    summary: 'Quân Mã là quân duy nhất có thể nhảy qua đầu quân khác theo quỹ đạo chữ L đặc biệt.',
    steps: [
      {
        stepNumber: 1,
        title: 'Bước nhảy chữ L của Mã',
        instruction: 'Quân Mã đi 2 ô thẳng và 1 ô rẽ ngang. Hãy đưa Mã từ g1 nhảy vào ô trung tâm f3!',
        initialFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        playerColor: 'w',
        targetMove: { from: 'g1', to: 'f3' },
        hint: 'Kéo Mã g1 nhảy lên ô f3 vượt qua hàng Tốt.',
        explanation: 'Chính xác! Mã f3 vừa phát triển quân vừa kiểm soát 2 ô trung tâm quan trọng là d4 và e5.',
      },
      {
        stepNumber: 2,
        title: 'Đòn Chĩa Đôi (Knight Fork)',
        instruction: 'Quân Mã có khả năng tấn công 2 mục tiêu cùng lúc. Hãy đưa Mã từ c3 nhảy lên d5 để chĩa đôi cả Vua và Hậu đen!',
        initialFen: 'r1bqk2r/pppp1ppp/8/8/8/2N5/PPPPPPPP/R1BQKBNR w KQkq - 0 1',
        playerColor: 'w',
        targetMove: { from: 'c3', to: 'd5' },
        hint: 'Đưa Mã c3 nhảy vào ô d5.',
        explanation: 'Đòn chiến thuật siêu đẳng! Đòn đôi bằng Mã là vũ khí bắt quân lợi hại nhất trong cờ vua.',
      },
    ],
  },
  {
    id: 'lesson-queen-king',
    chapter: 'Chương 1: Nhập môn & Nước đi',
    title: '5. Hậu, Vua & Nhập Thành',
    badge: 'Quan trọng',
    summary: 'Hậu là quân cờ mạnh nhất. Vua là linh hồn ván cờ cần được bảo vệ bằng phép Nhập thành.',
    steps: [
      {
        stepNumber: 1,
        title: 'Quyền năng của Hậu',
        instruction: 'Hậu kết hợp nước đi của cả Xe và Tượng. Hãy đưa Hậu từ d1 lên ô h5 để đe dọa chiếu hết!',
        initialFen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
        playerColor: 'w',
        targetMove: { from: 'd1', to: 'h5' },
        hint: 'Kéo Hậu d1 theo đường chéo lên ô h5.',
        explanation: 'Rất tốt! Hậu ở h5 đang nhắm thẳng vào điểm yếu f7 và quân Tốt e5 của đối phương.',
      },
      {
        stepNumber: 2,
        title: 'Luật Nhập Thành (Castling)',
        instruction: 'Nhập thành đưa Vua vào nơi an toàn và đưa Xe ra tham chiến. Hãy nhập thành cánh Vua bằng cách kéo Vua từ e1 sang g1!',
        initialFen: 'rnbqk2r/pppp1ppp/5n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
        playerColor: 'w',
        targetMove: { from: 'e1', to: 'g1' },
        hint: 'Kéo Vua e1 sang ô g1 (Xe h1 sẽ tự động nhảy qua ô f1).',
        explanation: 'Hoàn hảo! Vua Trắng giờ đây đã an toàn sau bức tường Tốt và Xe f1 đã sẵn sàng kiểm soát cột mở!',
      },
    ],
  },

  // CHƯƠNG 2: NGUYÊN TẮC KHAI CUỘC & CHIẾN THUẬT
  {
    id: 'lesson-opening',
    chapter: 'Chương 2: Chiến thuật Khai cuộc',
    title: '6. Chiếm Tâm & Phát Triển Quân',
    badge: 'Chiến lược',
    summary: '3 nguyên tắc vàng khai cuộc: Chiếm trung tâm, phát triển quân nhẹ (Mã, Tượng) và Nhập thành sớm.',
    steps: [
      {
        stepNumber: 1,
        title: 'Kiểm soát 4 ô trung tâm',
        instruction: '4 ô e4, d4, e5, d5 là chiến địa quan trọng nhất. Hãy đẩy Tốt d2 lên d4 để tạo cặp Tốt trung tâm hùng mạnh!',
        initialFen: 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
        playerColor: 'w',
        targetMove: { from: 'd2', to: 'd4' },
        hint: 'Đẩy Tốt d2 lên ô d4.',
        explanation: 'Chính xác! Kiểm soát trung tâm giúp các quân cờ của bạn cơ động và dễ dàng tấn công hơn đối thủ.',
      },
    ],
  },
];
