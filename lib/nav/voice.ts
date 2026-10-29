// Spoken directions through the browser's built-in speech (no audio files, no API key).

const synth = () => (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null);

/**
 * iOS and some Android browsers only allow speech that starts from a tap, so
 * call this from the Start button's click handler before navigation begins.
 */
export function unlockSpeech() {
  const s = synth();
  if (!s) return;
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  s.speak(u);
}

export class Voice {
  private muted = false;
  private voice: SpeechSynthesisVoice | null = null;

  constructor() {
    synth()?.addEventListener('voiceschanged', this.pick);
    this.pick();
  }

  private pick = () => {
    const voices = synth()?.getVoices() ?? [];
    const english = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
    this.voice =
      english.find((v) => /natural|enhanced|premium|samantha|google us english/i.test(v.name)) ??
      english.find((v) => v.default) ??
      english[0] ??
      null;
  };

  get isMuted() {
    return this.muted;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) synth()?.cancel();
  }

  // `interrupt`: cut off whatever is being said (urgent instructions), rather than queue.
  say(text: string, interrupt = true) {
    const s = synth();
    if (!s || this.muted || !text) return;
    if (interrupt) s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (this.voice) u.voice = this.voice;
    u.lang = this.voice?.lang ?? 'en-US';
    u.rate = 1.03;
    s.speak(u);
  }

  dispose() {
    synth()?.removeEventListener('voiceschanged', this.pick);
    synth()?.cancel();
  }
}

// "350 meters", "1.5 kilometers", rounded the way people say them.
export function spokenDistance(m: number) {
  if (m >= 950) {
    const km = Math.round(m / 100) / 10;
    return `${km % 1 === 0 ? km.toFixed(0) : km} kilometer${km === 1 ? '' : 's'}`;
  }
  const rounded = m < 100 ? Math.max(10, Math.round(m / 10) * 10) : Math.round(m / 50) * 50;
  return `${rounded} meters`;
}
