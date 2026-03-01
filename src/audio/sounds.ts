export class SoundManager {
  private ctx: AudioContext | null = null;
  private volume = 0.15;

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    return this.ctx;
  }

  private ensureResumed(): void {
    const c = this.getCtx();
    if (c.state === 'suspended') {
      c.resume().catch(() => {});
    }
  }

  playCollect(): void {
    this.ensureResumed();
    const c = this.getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, c.currentTime);
    osc.frequency.linearRampToValueAtTime(1200, c.currentTime + 0.08);
    gain.gain.setValueAtTime(this.volume, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1);

    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.1);
  }

  playHit(): void {
    this.ensureResumed();
    const c = this.getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, c.currentTime);
    osc.frequency.linearRampToValueAtTime(50, c.currentTime + 0.15);
    gain.gain.setValueAtTime(this.volume * 1.5, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2);

    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.2);
  }

  playLaunch(): void {
    this.ensureResumed();
    const c = this.getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, c.currentTime);
    osc.frequency.linearRampToValueAtTime(800, c.currentTime + 0.12);
    gain.gain.setValueAtTime(this.volume * 0.8, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15);

    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.15);
  }

  playExplode(): void {
    this.ensureResumed();
    const c = this.getCtx();
    const bufferSize = c.sampleRate * 0.3;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const source = c.createBufferSource();
    source.buffer = buffer;
    const gain = c.createGain();
    source.connect(gain);
    gain.connect(c.destination);
    gain.gain.setValueAtTime(this.volume * 1.2, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.3);
    source.start(c.currentTime);
  }
}
