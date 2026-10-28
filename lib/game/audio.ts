// Synthesised engine, boost and crash sounds (Web Audio, no audio files).
export class EngineAudio {
  private ctx: AudioContext;
  private master: GainNode;
  private engineGain: GainNode;
  private low: OscillatorNode;
  private high: OscillatorNode;
  private filter: BiquadFilterNode;
  private whooshGain: GainNode;
  private noise: AudioBuffer;
  private muted = false;

  constructor() {
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);

    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 900;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.filter.connect(this.engineGain).connect(this.master);

    this.low = this.ctx.createOscillator();
    this.low.type = 'sawtooth';
    this.high = this.ctx.createOscillator();
    this.high.type = 'square';
    const highGain = this.ctx.createGain();
    highGain.gain.value = 0.25;
    this.low.connect(this.filter);
    this.high.connect(highGain).connect(this.filter);
    this.low.start();
    this.high.start();

    // White noise, shared by the boost whoosh and crashes.
    this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const whoosh = this.ctx.createBufferSource();
    whoosh.buffer = this.noise;
    whoosh.loop = true;
    const band = this.ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1400;
    this.whooshGain = this.ctx.createGain();
    this.whooshGain.gain.value = 0;
    whoosh.connect(band).connect(this.whooshGain).connect(this.master);
    whoosh.start();
  }

  resume() {
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  // Fake gearbox: revs climb within each "gear" band of speed.
  update(speed: number, throttle: number, boosting: boolean) {
    const t = this.ctx.currentTime;
    const s = Math.abs(speed);
    const gear = Math.min(5, Math.floor(s / 9));
    const rev = (s - gear * 9) / 9;
    const freq = 48 + gear * 10 + rev * 70 + Math.max(0, throttle) * 12;
    this.low.frequency.setTargetAtTime(freq, t, 0.05);
    this.high.frequency.setTargetAtTime(freq * 2.01, t, 0.05);
    this.filter.frequency.setTargetAtTime(500 + rev * 900 + Math.max(0, throttle) * 600, t, 0.08);
    this.engineGain.gain.setTargetAtTime(0.07 + Math.max(0, throttle) * 0.06 + Math.min(s, 30) * 0.002, t, 0.1);
    this.whooshGain.gain.setTargetAtTime(boosting ? 0.18 : 0, t, 0.12);
  }

  crash(intensity: number) {
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(Math.min(0.9, 0.2 + intensity * 0.03), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    src.connect(lp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.5);
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.master.gain.setTargetAtTime(muted ? 0 : 0.55, this.ctx.currentTime, 0.05);
  }

  get isMuted() {
    return this.muted;
  }

  dispose() {
    void this.ctx.close();
  }
}
