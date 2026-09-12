/**
 * Web Audio API based Synthesizer for Warehouse Scanning Sound Alerts
 * No external audio files needed! Works dynamically in the browser.
 */

class AudioSynth {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;

  constructor() {
    // Lazy initialized when first played to conform to browser auto-play policies
  }

  public setEnabled(val: boolean) {
    this.enabled = val;
  }

  private init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * Short high-pitch beep for a successful barcode scan
   */
  public playSuccessBeep() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1000, this.ctx.currentTime); // 1000Hz (High-pitched clear beep)

      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15); // fade out quickly

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.15);
    } catch (e) {
      console.warn("Lỗi phát âm thanh success:", e);
    }
  }

  /**
   * Double-beep warning / error (low pitched) for missing or invalid items
   */
  public playErrorBeep() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;

      const playBeep = (timeOffset: number, freq: number) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth'; // Buzzier sound
        osc.frequency.setValueAtTime(220, this.ctx.currentTime + timeOffset); // 220Hz (Low buzz)

        gain.gain.setValueAtTime(0.12, this.ctx.currentTime + timeOffset);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + timeOffset + 0.18);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(this.ctx.currentTime + timeOffset);
        osc.stop(this.ctx.currentTime + timeOffset + 0.18);
      };

      // Play double buzz
      playBeep(0, 220);
      playBeep(0.25, 200);
    } catch (e) {
      console.warn("Lỗi phát âm thanh error:", e);
    }
  }

  /**
   * Beautiful notification chime for a newly discovered status transition or alert
   */
  public playNotificationChime() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;

      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 (Arpeggio)
      notes.forEach((freq, index) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle'; // Mellower sound
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + (index * 0.08));

        gain.gain.setValueAtTime(0.08, this.ctx.currentTime + (index * 0.08));
        gain.gain.exponentialRampToValueAtTime(0.005, this.ctx.currentTime + (index * 0.08) + 0.3);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(this.ctx.currentTime + (index * 0.08));
        osc.stop(this.ctx.currentTime + (index * 0.08) + 0.3);
      });
    } catch (e) {
      console.warn("Lỗi phát âm thanh chime:", e);
    }
  }
}

export const audioSynth = new AudioSynth();
