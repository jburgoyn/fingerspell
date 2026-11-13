/**
 * Handshape recogniser.
 *
 * Input: the 25 WebXR hand-joint positions of one hand, in a frame where +Y is
 * up. Output: the best-matching fingerspelling letter, or null.
 *
 * It is rule-based, not learned. Each letter is described by a handful of
 * measurements (which fingers are straight, where the thumb sits, whether two
 * fingertips touch, which way the hand points) and scored 0..1. That keeps it
 * small, fast (no allocation per frame) and easy to tune on a headset.
 *
 * Static letters only. See SUPPORTED_LETTERS in hand-model.ts for the set.
 */

import { J } from './hand-model.js';

export interface HandFeatures {
  /** PIP (middle knuckle) bend per finger, degrees. index..pinky */
  pip: Float32Array;
  /** How far each finger's first bone leans into the palm, degrees. */
  mcp: Float32Array;
  /** 0..1: how "straight out" each finger is. */
  extended: Float32Array;
  /** 0..1: how "folded into a fist" each finger is. */
  folded: Float32Array;
  /** Thumb tip to each fingertip, in hand-lengths. */
  thumbToTip: Float32Array;
  /** Thumb tip to the index knuckle, in hand-lengths. Large = thumb sticking out. */
  thumbReach: number;
  /** Thumb tip offset from the index knuckle: toward thumb side / up / out of palm. */
  thumbT: number;
  thumbU: number;
  thumbN: number;
  /** Angle between the thumb and the index finger, degrees. */
  thumbIndexAngle: number;
  /** Sideways gap between index and middle fingertips (negative = crossed). */
  indexMiddleGap: number;
  /** Up component of the index finger's direction (1 = straight up). */
  indexUp: number;
  /** Up component of the whole hand's direction. */
  handUp: number;
}

export interface Recognition {
  letter: string | null;
  /** Score of the winning letter, 0..1. */
  confidence: number;
  /** The best-scoring letter even if it was not confident enough to report. */
  best: string;
  second: string;
  secondScore: number;
}

export const RECOGNISED_LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'L', 'O', 'R', 'U', 'V', 'W', 'X', 'Y',
] as const;

const MIN_SCORE = 0.55;
const MIN_MARGIN = 0.12;

const up = (x: number, a: number, b: number) =>
  x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a);
const down = (x: number, a: number, b: number) => 1 - up(x, a, b);
const DEG = 180 / Math.PI;

export function createFeatures(): HandFeatures {
  return {
    pip: new Float32Array(4),
    mcp: new Float32Array(4),
    extended: new Float32Array(4),
    folded: new Float32Array(4),
    thumbToTip: new Float32Array(4),
    thumbReach: 0,
    thumbT: 0,
    thumbU: 0,
    thumbN: 0,
    thumbIndexAngle: 0,
    indexMiddleGap: 0,
    indexUp: 0,
    handUp: 0,
  };
}

export class HandshapeRecognizer {
  readonly features = createFeatures();
  readonly scores = new Float32Array(RECOGNISED_LETTERS.length);
  readonly result: Recognition = {
    letter: null,
    confidence: 0,
    best: 'A',
    second: 'A',
    secondScore: 0,
  };

  private p = new Float32Array(75);
  // scratch vectors: T (toward thumb), U (toward fingers), N (out of palm)
  private T = new Float32Array(3);
  private U = new Float32Array(3);
  private N = new Float32Array(3);
  private a = new Float32Array(3);
  private b = new Float32Array(3);

  /**
   * @param joints 75 floats: x,y,z for each of the 25 joints.
   * @param leftHand mirror a left hand so one set of rules covers both.
   */
  classify(joints: ArrayLike<number>, leftHand: boolean): Recognition {
    const p = this.p;
    for (let i = 0; i < 75; i += 3) {
      p[i] = leftHand ? -joints[i] : joints[i];
      p[i + 1] = joints[i + 1];
      p[i + 2] = joints[i + 2];
    }
    this.measure();
    return this.score();
  }

  private sub(out: Float32Array, i: number, j: number): Float32Array {
    const p = this.p;
    out[0] = p[i * 3] - p[j * 3];
    out[1] = p[i * 3 + 1] - p[j * 3 + 1];
    out[2] = p[i * 3 + 2] - p[j * 3 + 2];
    return out;
  }

  private dist(i: number, j: number): number {
    const p = this.p;
    return Math.hypot(
      p[i * 3] - p[j * 3],
      p[i * 3 + 1] - p[j * 3 + 1],
      p[i * 3 + 2] - p[j * 3 + 2],
    );
  }

  private measure(): void {
    const f = this.features;
    const { T, U, N, a, b } = this;
    const size = this.dist(J.middleProx, J.wrist) || 0.09;

    // Hand frame.
    norm(this.sub(U, J.middleProx, J.wrist));
    this.sub(T, J.indexProx, J.pinkyProx);
    const tu = dot(T, U);
    T[0] -= tu * U[0];
    T[1] -= tu * U[1];
    T[2] -= tu * U[2];
    norm(T);
    cross(N, T, U);

    for (let k = 0; k < 4; k++) {
      const prox = J.indexProx + k * 5;
      norm(this.sub(a, prox + 1, prox));
      norm(this.sub(b, prox + 2, prox + 1));
      const lean = Math.asin(Math.max(-1, Math.min(1, dot(a, N)))) * DEG;
      // Past 90 degrees the bone points back toward the wrist.
      f.mcp[k] = dot(a, U) < 0 ? 180 - lean : lean;
      f.pip[k] = Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) * DEG;
      f.extended[k] = down(f.pip[k], 25, 55) * down(f.mcp[k], 40, 70);
      f.folded[k] = up(f.pip[k], 55, 85);
      f.thumbToTip[k] = this.dist(J.thumbTip, prox + 3) / size;
    }

    this.sub(a, J.thumbTip, J.indexProx);
    f.thumbReach = Math.hypot(a[0], a[1], a[2]) / size;
    f.thumbT = dot(a, T) / size;
    f.thumbU = dot(a, U) / size;
    f.thumbN = dot(a, N) / size;

    norm(this.sub(a, J.thumbTip, J.thumbProx));
    norm(this.sub(b, J.indexTip, J.indexProx));
    f.thumbIndexAngle = Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) * DEG;
    f.indexUp = b[1];
    f.handUp = U[1];

    this.sub(a, J.indexTip, J.middleTip);
    f.indexMiddleGap = dot(a, T) / size;
  }

  private score(): Recognition {
    const f = this.features;
    const s = this.scores;
    const [eI, eM, eR, eP] = f.extended;
    const [fI, fM, fR, fP] = f.folded;
    const notI = 1 - eI;
    const notM = 1 - eM;
    const notR = 1 - eR;
    const notP = 1 - eP;

    const thumbOut = up(f.thumbT, 0.4, 0.65);
    const thumbIn = 1 - thumbOut;
    // Thumb out AND at a wide angle to the index finger: the L shape.
    const thumbL = thumbOut * up(f.thumbIndexAngle, 46, 60);
    const notThumbL = 1 - thumbL;
    // Thumb tip has moved across the front of the fingers, toward the middle.
    const thumbAcross = down(f.thumbT, -0.12, 0.08);
    const thumbBeside = 1 - thumbAcross;
    const touchIndex = down(f.thumbToTip[0], 0.28, 0.45);
    const touchMiddle = down(f.thumbToTip[1], 0.32, 0.5);

    // Fingers bent at the first knuckle, as in a fist (not just hooked).
    const fistI = fI * up(f.mcp[0], 30, 55);
    const fistM = fM * up(f.mcp[1], 30, 55);
    const fistR = fR * up(f.mcp[2], 30, 55);
    const fistP = fP * up(f.mcp[3], 30, 55);
    const fist4 = Math.min(fistI, fistM, fistR, fistP);

    // Curved (not straight, not a tight fist): C and O.
    const curved = (k: number) => up(f.pip[k], 25, 45) * down(f.pip[k], 85, 105);
    const curved4 = Math.min(curved(0), curved(1), curved(2), curved(3));

    const upright = up(f.indexUp, 0.35, 0.6);
    const sideways = down(Math.abs(f.indexUp), 0.35, 0.6);
    const handUpright = up(f.handUp, 0.35, 0.6);

    const together = up(f.indexMiddleGap, 0, 0.07) * down(f.indexMiddleGap, 0.36, 0.5);
    const spread = up(f.indexMiddleGap, 0.36, 0.5);
    const crossed = down(f.indexMiddleGap, -0.02, 0.05);

    let i = 0;
    // A: fist, thumb upright against the side of the index finger.
    s[i++] = Math.min(fist4, thumbIn, thumbBeside);
    // B: four fingers straight up, thumb folded in.
    s[i++] = Math.min(eI, eM, eR, eP, thumbIn, handUpright);
    // C: fingers and thumb curved with a gap between them.
    s[i++] = Math.min(
      curved4,
      up(f.thumbToTip[0], 0.45, 0.58),
      down(f.thumbToTip[0], 1.25, 1.5),
      up(f.thumbN, 0.2, 0.45),
    );
    // D: index up, the other fingers curled down to the thumb.
    s[i++] = Math.min(eI, notM, notR, notP, up(f.pip[1], 40, 65), notThumbL, upright);
    // E: fingers folded down, thumb tucked across in front.
    s[i++] = Math.min(fist4, thumbIn, thumbAcross);
    // F: thumb and index touch, the other three straight.
    s[i++] = Math.min(touchIndex, eM, eR, eP, notI);
    // G: index pointing sideways, other fingers closed.
    s[i++] = Math.min(eI, fistM, fistR, fistP, sideways, notThumbL);
    // H: index and middle pointing sideways together.
    s[i++] = Math.min(eI, eM, fistR, fistP, sideways, down(f.indexMiddleGap, 0.36, 0.5));
    // I: pinky up, thumb in.
    s[i++] = Math.min(fistI, fistM, fistR, eP, thumbIn);
    // L: index up, thumb out at a right angle.
    s[i++] = Math.min(eI, fistM, fistR, fistP, thumbL);
    // O: every fingertip meets the thumb.
    s[i++] = Math.min(
      touchIndex, touchMiddle, notI, notM, notR, notP,
      down(f.pip[0], 85, 105), down(f.pip[1], 85, 105),
    );
    // R: index and middle crossed.
    s[i++] = Math.min(eI, eM, notR, notP, crossed, upright, thumbIn);
    // U: index and middle up, together.
    s[i++] = Math.min(eI, eM, fistR, fistP, together, upright, thumbIn);
    // V: index and middle up, apart.
    s[i++] = Math.min(eI, eM, fistR, fistP, spread, upright, thumbIn);
    // W: index, middle and ring up.
    s[i++] = Math.min(eI, eM, eR, notP, up(f.pip[3], 40, 65), thumbIn);
    // X: index hooked, the rest a fist.
    s[i++] = Math.min(fI, down(f.mcp[0], 30, 50), fistM, fistR, fistP, thumbIn);
    // Y: thumb and pinky out.
    s[i++] = Math.min(fistI, fistM, fistR, eP, thumbOut);

    let best = 0;
    let second = -1;
    for (let k = 1; k < s.length; k++) {
      if (s[k] > s[best]) {
        second = best;
        best = k;
      } else if (second < 0 || s[k] > s[second]) {
        second = k;
      }
    }
    if (second < 0) second = best === 0 ? 1 : 0;
    const r = this.result;
    r.best = RECOGNISED_LETTERS[best];
    r.second = RECOGNISED_LETTERS[second];
    r.confidence = s[best];
    r.secondScore = s[second];
    r.letter =
      s[best] >= MIN_SCORE && s[best] - s[second] >= MIN_MARGIN ? r.best : null;
    return r;
  }
}

function dot(a: Float32Array, b: Float32Array): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function norm(a: Float32Array): Float32Array {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  a[0] /= l;
  a[1] /= l;
  a[2] /= l;
  return a;
}
function cross(out: Float32Array, a: Float32Array, b: Float32Array): Float32Array {
  out[0] = a[1] * b[2] - a[2] * b[1];
  out[1] = a[2] * b[0] - a[0] * b[2];
  out[2] = a[0] * b[1] - a[1] * b[0];
  return out;
}
