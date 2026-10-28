import type { Input } from './vehicle';

// Merges keyboard and on-screen (touch) controls into one Input.
export class Controls {
  private keys = new Set<string>();
  // Set by the on-screen joystick and buttons.
  touch = { x: 0, y: 0, boost: false, drift: false };

  constructor(private onKey: (key: string) => void) {
    window.addEventListener('keydown', this.down);
    window.addEventListener('keyup', this.up);
    window.addEventListener('blur', this.clear);
  }

  private down = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if (!this.keys.has(k)) this.onKey(k);
    this.keys.add(k);
  };

  private up = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };

  private clear = () => this.keys.clear();

  private any(...k: string[]) {
    return k.some((key) => this.keys.has(key));
  }

  read(): Input {
    const kThrottle = (this.any('w', 'arrowup') ? 1 : 0) - (this.any('s', 'arrowdown') ? 1 : 0);
    const kSteer = (this.any('d', 'arrowright') ? 1 : 0) - (this.any('a', 'arrowleft') ? 1 : 0);
    return {
      throttle: kThrottle || -this.touch.y,
      steer: kSteer || this.touch.x,
      boost: this.any('shift') || this.touch.boost,
      drift: this.any(' ') || this.touch.drift,
    };
  }

  dispose() {
    window.removeEventListener('keydown', this.down);
    window.removeEventListener('keyup', this.up);
    window.removeEventListener('blur', this.clear);
  }
}
