import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  Vector3,
} from '@iwsdk/core';

const MOTES = 70;
const CONFETTI = 130;
const CONFETTI_LIFE = 3.2;

const m = new Matrix4();
const p = new Vector3();
const q = new Quaternion();
const e = new Euler();
const s = new Vector3();

/** A soft round glow, drawn once into a small canvas. */
function glowTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d')!;
  const gradient = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.5)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gradient;
  g.fillRect(0, 0, 128, 128);
  return new CanvasTexture(canvas);
}

/**
 * The room's atmosphere, positioned around the player's head (the group's
 * origin is the head position, facing the board):
 *  - a soft halo behind the board that warms up while a shape is held,
 *  - slow drifting motes of light further out,
 *  - a burst of confetti from the board on a win.
 * Three draw calls. Nothing is allocated per frame.
 */
export class Ambience extends Group {
  private haloMaterial = new MeshBasicMaterial({
    map: glowTexture(),
    color: 0x8f7dff,
    transparent: true,
    opacity: 0.3,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  private halo = new Mesh(new PlaneGeometry(2.3, 2.3), this.haloMaterial);
  private rest = new Color(0x8f7dff);
  private warm = new Color(0xf5c542);

  private motes = new InstancedMesh(
    new SphereGeometry(1, 6, 4),
    new MeshBasicMaterial({
      color: 0xcfc4ff,
      transparent: true,
      opacity: 0.55,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
    MOTES,
  );
  private mote = new Float32Array(MOTES * 5); // angle, radius, height, speed, size

  private confetti = new InstancedMesh(
    new BoxGeometry(1, 0.6, 0.05),
    new MeshBasicMaterial({ side: DoubleSide }),
    CONFETTI,
  );
  private bit = new Float32Array(CONFETTI * 9); // pos xyz, vel xyz, spin xyz
  private confettiAge = CONFETTI_LIFE;

  private clock = 0;
  private pulse = 0;
  private level = 0;

  constructor() {
    super();
    this.halo.position.set(0, -0.1, -1.3);

    // Deterministic scatter, so every session looks the same.
    let seed = 7;
    const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    for (let i = 0; i < MOTES; i++) {
      // Keep the arc in front of the player clear, so nothing drifts across the board.
      this.mote[i * 5] = 0.9 + rand() * (Math.PI * 2 - 1.8);
      this.mote[i * 5 + 1] = 1.6 + rand() * 2.2;
      this.mote[i * 5 + 2] = -1.3 + rand() * 2.4;
      this.mote[i * 5 + 3] = 0.015 + rand() * 0.03;
      this.mote[i * 5 + 4] = 0.004 + rand() * 0.006;
    }
    this.motes.frustumCulled = false;

    const colours = [0x2e9d5b, 0xf5c542, 0xffffff, 0x8f7dff];
    const c = new Color();
    for (let i = 0; i < CONFETTI; i++) {
      this.confetti.setColorAt(i, c.setHex(colours[i % colours.length]));
      for (let k = 3; k < 9; k++) this.bit[i * 9 + k] = rand() - 0.5;
    }
    this.confetti.frustumCulled = false;
    this.confetti.visible = false;

    this.add(this.halo, this.motes, this.confetti);
  }

  /** Confetti colours follow the board palette (correct, present). */
  setPalette(correct: string, present: string): void {
    const c = new Color();
    const colours = [c.clone().set(correct), c.clone().set(present), c.clone().set('#ffffff')];
    for (let i = 0; i < CONFETTI; i++) this.confetti.setColorAt(i, colours[i % colours.length]);
    if (this.confetti.instanceColor) this.confetti.instanceColor.needsUpdate = true;
  }

  /** A brief brightening of the halo: a letter was accepted. */
  flash(): void {
    this.pulse = 1;
  }

  /** Confetti from the board: the puzzle was solved. */
  celebrate(): void {
    this.confettiAge = 0;
    this.confetti.visible = true;
    for (let i = 0; i < CONFETTI; i++) {
      const o = i * 9;
      const side = this.bit[o + 6]; // -0.5..0.5, reused as a stable random
      const lift = this.bit[o + 7] + 0.5;
      const depth = this.bit[o + 8] + 0.5;
      this.bit[o] = side * 0.45;
      this.bit[o + 1] = 0.15;
      this.bit[o + 2] = -0.95;
      this.bit[o + 3] = side * 1.7;
      this.bit[o + 4] = 0.9 + lift * 1.3;
      this.bit[o + 5] = 0.15 + depth * 0.55;
    }
    this.pulse = 1.6;
  }

  /** @param hold 0..1 progress of the letter being held (0 when idle). */
  step(delta: number, hold: number): void {
    this.clock += delta;

    // Halo: breathes slowly, warms toward gold as the hold fills, flashes on accept.
    this.level += (hold - this.level) * Math.min(1, delta * 8);
    this.pulse = Math.max(0, this.pulse - delta * 2.2);
    const breathe = 0.5 + 0.5 * Math.sin(this.clock * 0.6);
    this.haloMaterial.color.copy(this.rest).lerp(this.warm, Math.min(1, this.level * 0.8 + this.pulse * 0.6));
    this.haloMaterial.opacity = 0.5 + breathe * 0.08 + this.level * 0.2 + this.pulse * 0.25;
    this.halo.scale.setScalar(1 + this.level * 0.05 + this.pulse * 0.08);

    // Motes: rise slowly and circle, wrapping at the top.
    for (let i = 0; i < MOTES; i++) {
      const o = i * 5;
      let h = this.mote[o + 2] + this.mote[o + 3] * delta;
      if (h > 1.1) h = -1.3;
      this.mote[o + 2] = h;
      const angle = this.mote[o] + Math.sin(this.clock * 0.2 + i) * 0.05;
      const radius = this.mote[o + 1];
      const size = this.mote[o + 4] * (0.75 + 0.25 * Math.sin(this.clock * 1.3 + i));
      p.set(Math.sin(angle) * radius, h, -Math.cos(angle) * radius);
      m.makeScale(size, size, size).setPosition(p);
      this.motes.setMatrixAt(i, m);
    }
    this.motes.instanceMatrix.needsUpdate = true;

    // Confetti: thrown up and toward the player, then drifts down.
    if (this.confettiAge < CONFETTI_LIFE) {
      this.confettiAge += delta;
      const fade = Math.min(1, (CONFETTI_LIFE - this.confettiAge) / 0.6);
      const drag = Math.max(0, 1 - delta * 1.4);
      for (let i = 0; i < CONFETTI; i++) {
        const o = i * 9;
        this.bit[o + 3] *= drag;
        this.bit[o + 5] *= drag;
        this.bit[o + 4] = Math.max(-0.45, this.bit[o + 4] - 2.2 * delta);
        this.bit[o] += this.bit[o + 3] * delta;
        this.bit[o + 1] += this.bit[o + 4] * delta;
        this.bit[o + 2] += this.bit[o + 5] * delta;
        const t = this.confettiAge * 6;
        e.set(this.bit[o + 6] * t, this.bit[o + 7] * t, this.bit[o + 8] * t);
        q.setFromEuler(e);
        const size = 0.022 * Math.max(0, fade);
        m.compose(p.set(this.bit[o], this.bit[o + 1], this.bit[o + 2]), q, s.setScalar(size));
        this.confetti.setMatrixAt(i, m);
      }
      this.confetti.instanceMatrix.needsUpdate = true;
      if (this.confettiAge >= CONFETTI_LIFE) this.confetti.visible = false;
    }
  }
}
