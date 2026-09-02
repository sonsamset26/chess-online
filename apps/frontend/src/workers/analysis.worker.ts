/**
 * Analysis Web Worker - Stockfish 10 WASM/JS Wrapper
 * Chuyên trách phân tích ván đấu độc lập cho GameReportView / AnalysisEngine.
 */

// Đặt cấu hình locateFile cho Emscripten trước khi nạp
(self as any).Module = (self as any).Module || {};
(self as any).Module.locateFile = function (file: string) {
  return '/stockfish/' + file;
};

// Nạp stockfish.js
try {
  (self as any).importScripts('/stockfish/stockfish.js');
} catch (e) {
  // Khi không ở môi trường web worker (ví dụ Node/SSR), bỏ qua
  console.warn('Analysis worker: importScripts failed or not supported in this environment', e);
}
