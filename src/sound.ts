/**
 * Tiny synthesised sound effects (no audio files). Every sound has a visual
 * twin on the board, so the game is fully playable muted.
 */
let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, length: number, gain = 0.12, type: OscillatorType = 'sine'): void {
  const ac = context();
  if (!ac) return;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t = ac.currentTime + start;
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(gain, t + 0.015);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(amp).connect(ac.destination);
  osc.start(t);
  osc.stop(t + length + 0.05);
}

export const sound = {
  /** Call from a user gesture (the Enter VR button) so audio is allowed. */
  unlock: () => void context(),
  /** A shape has just been recognised (the hold is starting). */
  seen: () => tone(520, 0, 0.05, 0.035),
  /** A letter was accepted: a short rising pluck. */
  letter: () => {
    tone(660, 0, 0.12, 0.11);
    tone(990, 0.07, 0.18, 0.08);
  },
  press: () => tone(420, 0, 0.08, 0.08, 'triangle'),
  undo: () => tone(300, 0, 0.12, 0.08, 'triangle'),
  reject: () => {
    tone(200, 0, 0.16, 0.1, 'square');
    tone(170, 0.12, 0.2, 0.1, 'square');
  },
  reveal: (index: number, good: boolean) => tone(good ? 620 + index * 40 : 330, index * 0.12, 0.16, 0.09),
  success: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.35, 0.12)),
  fail: () => [392, 330, 262].forEach((f, i) => tone(f, i * 0.16, 0.4, 0.1, 'triangle')),
  step: () => {
    tone(784, 0, 0.18);
    tone(1047, 0.1, 0.25);
  },
};
