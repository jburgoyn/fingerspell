import {
  AdditiveBlending,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  SphereGeometry,
  Vector3,
} from '@iwsdk/core';

const DOTS = 24;
const RING_RADIUS = 0.095;
const DOT_SIZE = 0.0055;
const FLIGHT_S = 0.2;
const BURST_S = 0.3;

const m = new Matrix4();
const p = new Vector3();
const s = new Vector3();
const mid = new Vector3();

/**
 * Feedback drawn at the player's hand, where they are already looking:
 *  - a ring of dots around the hand that lights up as a shape is held,
 *  - a burst of that ring when the letter is accepted,
 *  - a spark that flies from the hand to where the letter lands.
 * Three draw calls, nothing allocated per frame. Positions are world space.
 */
export class LetterFx extends Group {
  private ringMaterial = new MeshBasicMaterial({ color: 0xf5c542, transparent: true, opacity: 0.95 });
  private sparkMaterial = new MeshBasicMaterial({
    color: 0xffe9a8,
    transparent: true,
    opacity: 1,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  private ring = new InstancedMesh(new SphereGeometry(1, 8, 6), this.ringMaterial, DOTS);
  private ringPivot = new Group();
  private spark = new Mesh(new SphereGeometry(1, 10, 8), this.sparkMaterial);
  private glow = new Mesh(new SphereGeometry(1, 10, 8), this.sparkMaterial);

  private shownProgress = -1;
  private burst = 0; // seconds left of the accept burst
  private flight = 0; // seconds left of the spark's flight
  private from = new Vector3();
  private to = new Vector3();
  private onArrive: (() => void) | null = null;

  constructor() {
    super();
    this.ring.frustumCulled = false;
    this.ringPivot.add(this.ring);
    this.ringPivot.visible = false;
    this.spark.visible = false;
    this.glow.visible = false;
    this.add(this.ringPivot, this.spark, this.glow);
  }

  setColor(hex: number): void {
    this.ringMaterial.color.setHex(hex);
  }

  /** Start the accept burst at the hand and send a spark to `to`. */
  accept(hand: Vector3, to: Vector3, onArrive: () => void): void {
    this.finish();
    this.burst = BURST_S;
    this.flight = FLIGHT_S;
    this.from.copy(hand);
    this.to.copy(to);
    this.onArrive = onArrive;
  }

  /** Complete any pending arrival now (screen change, undo). */
  finish(): void {
    const arrive = this.onArrive;
    this.onArrive = null;
    this.flight = 0;
    this.spark.visible = false;
    arrive?.();
  }

  /**
   * @param hand where the signing hand is, or null when no shape is being held
   * @param facing an object the ring should face (the player's head)
   * @param progress 0..1 hold progress
   */
  step(delta: number, hand: Vector3 | null, facing: Object3D, progress: number): void {
    // Ring: follows the hand while a shape is held, bursts outward on accept.
    const bursting = this.burst > 0;
    if (bursting) this.burst = Math.max(0, this.burst - delta);
    const showRing = bursting || (hand !== null && progress > 0);
    this.ringPivot.visible = showRing;
    if (showRing) {
      if (bursting) this.ringPivot.position.copy(this.from);
      else if (hand) this.ringPivot.position.copy(hand);
      facing.getWorldPosition(p);
      this.ringPivot.lookAt(p);
      const k = bursting ? 1 - this.burst / BURST_S : 0; // 0 -> 1 through the burst
      const shown = bursting ? 1 : progress;
      if (bursting || Math.abs(shown - this.shownProgress) > 0.004) {
        this.shownProgress = bursting ? -1 : shown;
        const radius = RING_RADIUS * (1 + k * 0.55);
        const lit = shown * DOTS;
        for (let i = 0; i < DOTS; i++) {
          // Fill clockwise from the top, as the player sees it.
          const a = Math.PI / 2 - (i / DOTS) * Math.PI * 2;
          const on = Math.min(1, Math.max(0, lit - i));
          const size = DOT_SIZE * (0.4 + on * 0.9) * (1 - k * 0.6);
          p.set(Math.cos(a) * radius, Math.sin(a) * radius, 0);
          m.makeScale(size, size, size).setPosition(p);
          this.ring.setMatrixAt(i, m);
        }
        this.ring.instanceMatrix.needsUpdate = true;
      }
      this.ringMaterial.opacity = bursting ? 0.95 * (1 - k) : 0.95;
    }

    // Spark: eases from the hand to the landing spot on a slight arc.
    if (this.flight > 0) {
      this.flight = Math.max(0, this.flight - delta);
      const t = 1 - this.flight / FLIGHT_S;
      const e = t * t * (3 - 2 * t);
      mid.lerpVectors(this.from, this.to, e);
      mid.y += Math.sin(e * Math.PI) * 0.05;
      this.spark.visible = true;
      this.spark.position.copy(mid);
      this.spark.scale.setScalar(0.012 * (1 - e * 0.35));
      if (this.flight === 0) {
        this.spark.visible = false;
        this.glowAt = 0.22;
        this.glow.position.copy(this.to);
        const arrive = this.onArrive;
        this.onArrive = null;
        arrive?.();
      }
    }

    // A soft flash where the spark landed.
    if (this.glowAt > 0) {
      this.glowAt = Math.max(0, this.glowAt - delta);
      const g = this.glowAt / 0.22;
      this.glow.visible = this.glowAt > 0;
      s.setScalar(0.05 * (1.2 - g));
      this.glow.scale.set(s.x, s.y, s.x * 0.15);
      this.sparkMaterial.opacity = this.flight > 0 ? 1 : 0.55 * g;
    } else if (this.flight > 0) {
      this.sparkMaterial.opacity = 1;
    }
  }

  private glowAt = 0;
}
