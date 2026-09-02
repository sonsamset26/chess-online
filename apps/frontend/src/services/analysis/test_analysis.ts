import { AnalysisEngine } from './AnalysisEngine';

// Ván cờ mẫu kiểm thử: Scholar's Mate (Chiếu hết kinh điển)
// Trong đó Đen đi 3... Nf6?? là một lỗi Blunder nghiêm trọng dẫn tới bị chiếu hết ở f7
const sampleGameScholar = [
  'e4', 'e5',
  'Bc4', 'Nc6',
  'Qh5', 'Nf6', // Nước Nf6 là Blunder nặng
  'Qxf7#'
];

// Dữ liệu mô phỏng thời gian cho từng nước đi (ms)
const sampleTelemetries = [
  { timeSpentMs: 1200, timeLeftMs: 598800 },
  { timeSpentMs: 2100, timeLeftMs: 597900 },
  { timeSpentMs: 3400, timeLeftMs: 595400 },
  { timeSpentMs: 4000, timeLeftMs: 593900 },
  { timeSpentMs: 2500, timeLeftMs: 592900 },
  { timeSpentMs: 1800, timeLeftMs: 25000 }, // Đi trong áp lực thời gian (< 30s)
  { timeSpentMs: 900, timeLeftMs: 592000 },
];

async function runTests() {
  console.log('🏁 --- BẮT ĐẦU CHẠY KIỂM THỬ MODULE PHÂN TÍCH VÁN ĐẤU (ASYNC & SYNC) ---');

  const report = await AnalysisEngine.analyzeGame(sampleGameScholar, {
    telemetries: sampleTelemetries,
    matchId: 'match_test_001',
    depth: 2,
    onProgress: (percent, status) => {
      console.log(`[Progress ${percent}%] ${status}`);
    }
  });

  console.log('\n📊 1. KẾT QUẢ PHÂN TÍCH TỪNG NƯỚC ĐI:');
  report.moves.forEach((m) => {
    const badge = m.classification === 'BEST' ? '🟢 BEST'
      : m.classification === 'EXCELLENT' ? '🟢 EXCELLENT'
      : m.classification === 'GOOD' ? '🔵 GOOD'
      : m.classification === 'INACCURACY' ? '🟡 INACCURACY'
      : m.classification === 'MISTAKE' ? '🟠 MISTAKE'
      : '🔴 BLUNDER';

    console.log(
      `Nước ${m.moveNumber}${m.color === 'w' ? '.' : '...'}${m.san.padEnd(6)} | ` +
      `Eval: ${m.evalAfter.toString().padStart(6)} cp | ` +
      `CPL: ${m.cpl.toString().padStart(4)} cp | ` +
      `Accuracy: ${m.accuracy.toFixed(1).padStart(5)}% | ` +
      `Giai đoạn: ${m.phase} | ` +
      `${badge} (Nước tối ưu: ${m.bestMoveSan})`
    );
  });

  console.log('\n📈 2. TỔNG HỢP VÁN ĐẤU (SUMMARY):');
  console.log('Trắng (White):', {
    accuracy: `${report.summary.white.accuracy}%`,
    avgCpl: `${report.summary.white.avgCpl} cp`,
    best: report.summary.white.bestCount,
    excellent: report.summary.white.excellentCount,
    good: report.summary.white.goodCount,
    inaccuracies: report.summary.white.inaccuracyCount,
    mistakes: report.summary.white.mistakeCount,
    blunders: report.summary.white.blunderCount,
  });

  console.log('Đen (Black):', {
    accuracy: `${report.summary.black.accuracy}%`,
    avgCpl: `${report.summary.black.avgCpl} cp`,
    best: report.summary.black.bestCount,
    excellent: report.summary.black.excellentCount,
    good: report.summary.black.goodCount,
    inaccuracies: report.summary.black.inaccuracyCount,
    mistakes: report.summary.black.mistakeCount,
    blunders: report.summary.black.blunderCount,
  });

  console.log('\n🧠 3. VECTOR ĐẶC TRƯNG HỒ SƠ KỲ THỦ (FEATURE VECTOR CHO K-MEANS):');
  console.log('White Feature Vector:', report.features.white);
  console.log('Black Feature Vector:', report.features.black);

  console.log(`\n⏱️ Thời gian phân tích toàn bộ ván: ${report.analysisDurationMs} ms`);

  console.log('\n🎯 4. KIỂM THỬ LIVE COACH: ANALYZESINGLEMOVE');
  const singleMateTest = await AnalysisEngine.analyzeSingleMove({
    ply: 7,
    fenBefore: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
    fenAfter: 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4',
    moveSan: 'Qxf7#',
    playerColor: 'w',
  });

  console.log('Kết quả phân tích nước Chiếu Hết (Qxf7#):', {
    classification: singleMateTest.classification,
    cpl: singleMateTest.cpl,
    evalAfter: singleMateTest.evalAfter,
    accuracy: singleMateTest.accuracy,
    status: singleMateTest.status,
  });

  if (singleMateTest.classification !== 'BEST' || singleMateTest.cpl !== 0 || singleMateTest.evalAfter !== 10000) {
    throw new Error('TEST FAILED: Nước chiếu hết không đạt tiêu chuẩn BEST / CPL 0 / evalAfter 10000!');
  }

  console.log('✅ KIỂM THỬ HOÀN THÀNH THÀNH CÔNG 100%!');
}

runTests().catch(console.error);
