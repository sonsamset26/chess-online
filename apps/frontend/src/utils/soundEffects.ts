// Web Audio API Synthesizer cho Âm thanh Cờ Vua (Tích hợp Trận đấu Bắt đầu, Kết thúc, Chiếu tướng, Ăn quân, Nước đi không hợp lệ)

class SoundManager {
  private audioCtx: AudioContext | null = null;

  private isMuted: boolean = false;

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('chess_sound_muted', muted ? 'true' : 'false');
      } catch {}
    }
  }

  public getMuted(): boolean {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('chess_sound_muted');
        if (stored !== null) {
          this.isMuted = stored === 'true';
        }
      } catch {}
    }
    return this.isMuted;
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined' || this.getMuted()) return null;
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  // 1. Âm thanh NƯỚC ĐI KHÔNG HỢP LỆ (Invalid Move Sound - Tiếng Buzz từ chối đanh)
  public playInvalid() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.linearRampToValueAtTime(110, now + 0.12);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {
      console.error(e);
    }
  }

  // 2. Âm thanh BẮT ĐẦU TRẬN ĐẤU (Game Start Fanfare)
  public playGameStart() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5];

      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + index * 0.08);

        gain.gain.setValueAtTime(0.3, now + index * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.01, now + index * 0.08 + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + index * 0.08);
        osc.stop(now + index * 0.08 + 0.25);
      });
    } catch (e) {
      console.error(e);
    }
  }

  // 3. Âm thanh CHIẾN THẮNG (Victory Fanfare)
  public playGameEndWin() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];

      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + index * 0.1);

        gain.gain.setValueAtTime(0.4, now + index * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, now + index * 0.1 + 0.4);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + index * 0.1);
        osc.stop(now + index * 0.1 + 0.4);
      });
    } catch (e) {
      console.error(e);
    }
  }

  // 4. Âm thanh THẤT BẠI (Defeat Sound)
  public playGameEndLose() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const notes = [400, 350, 300, 250];

      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + index * 0.12);

        gain.gain.setValueAtTime(0.3, now + index * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.01, now + index * 0.12 + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + index * 0.12);
        osc.stop(now + index * 0.12 + 0.35);
      });
    } catch (e) {
      console.error(e);
    }
  }

  // 5. Âm thanh HÒA CỜ (Draw Sound)
  public playGameEndDraw() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const notes = [440, 440];

      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + index * 0.15);

        gain.gain.setValueAtTime(0.3, now + index * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.01, now + index * 0.15 + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + index * 0.15);
        osc.stop(now + index * 0.15 + 0.25);
      });
    } catch (e) {
      console.error(e);
    }
  }

  // 6. Âm thanh Nước đi bình thường
  public playMove() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch (e) {
      console.error(e);
    }
  }

  // 7. Âm thanh CẢNH BÁO CHIẾU TƯỚNG
  public playCheck() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'triangle';
      osc2.type = 'sine';

      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.exponentialRampToValueAtTime(440, now + 0.25);

      osc2.frequency.setValueAtTime(1760, now);
      osc2.frequency.exponentialRampToValueAtTime(880, now + 0.25);

      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.3);
      osc2.stop(now + 0.3);
    } catch (e) {
      console.error(e);
    }
  }

  // 8. Âm thanh Ăn quân
  public playCapture() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.1);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch (e) {
      console.error(e);
    }
  }
}

export const sounds = new SoundManager();
