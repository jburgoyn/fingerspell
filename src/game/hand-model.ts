/**
 * A small synthetic right hand, posed with forward kinematics.
 *
 * It has two jobs:
 *  1. it draws the reference handshapes the player copies (see hand-display.ts);
 *  2. it gives the recogniser a known set of handshapes to be tested against.
 *
 * The shapes are hand-authored approximations of ASL fingerspelling handshapes.
 * They have not been reviewed by Deaf signers.
 *
 * Joint order matches the WebXR Hand Input spec (25 joints, wrist first).
 * Model frame: +X toward the thumb side, +Y toward the fingertips, +Z out of
 * the palm. Units are metres.
 */

export type Vec3 = [number, number, number];

export const JOINT_COUNT = 25;

export const J = {
  wrist: 0,
  thumbMeta: 1,
  thumbProx: 2,
  thumbDist: 3,
  thumbTip: 4,
  indexMeta: 5,
  indexProx: 6,
  indexInter: 7,
  indexDist: 8,
  indexTip: 9,
  middleMeta: 10,
  middleProx: 11,
  middleInter: 12,
  middleDist: 13,
  middleTip: 14,
  ringMeta: 15,
  ringProx: 16,
  ringInter: 17,
  ringDist: 18,
  ringTip: 19,
  pinkyMeta: 20,
  pinkyProx: 21,
  pinkyInter: 22,
  pinkyDist: 23,
  pinkyTip: 24,
} as const;

/** Pairs of joints joined by a bone, for drawing. */
export const BONES: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8], [8, 9],
  [0, 10], [10, 11], [11, 12], [12, 13], [13, 14],
  [0, 15], [15, 16], [16, 17], [17, 18], [18, 19],
  [0, 20], [20, 21], [21, 22], [22, 23], [23, 24],
  [6, 11], [11, 16], [16, 21], [1, 6],
];

/** Finger angles in degrees. `spread` is positive toward the thumb side. */
export interface FingerPose {
  mcp: number;
  pip: number;
  dip: number;
  spread?: number;
}

export interface ThumbPose {
  /** Direction of the thumb's first bone, in the model frame. */
  dir: Vec3;
  /** Direction the thumb bends toward. */
  toward: Vec3;
  mcp: number;
  ip: number;
}

export interface HandPose {
  thumb: ThumbPose;
  index: FingerPose;
  middle: FingerPose;
  ring: FingerPose;
  pinky: FingerPose;
  /** 'up' = fingers up, palm away from the signer. 'side' = fingers pointing
   *  sideways, palm toward the signer (G and H). */
  orient?: 'up' | 'side';
}

const KNUCKLE: Record<'index' | 'middle' | 'ring' | 'pinky', Vec3> = {
  index: [0.025, 0.09, 0],
  middle: [0.003, 0.093, 0],
  ring: [-0.017, 0.087, 0],
  pinky: [-0.035, 0.077, 0],
};
const SEGMENTS: Record<'index' | 'middle' | 'ring' | 'pinky', Vec3> = {
  index: [0.04, 0.024, 0.022],
  middle: [0.045, 0.028, 0.023],
  ring: [0.041, 0.027, 0.022],
  pinky: [0.032, 0.019, 0.02],
};
const THUMB_BASE: Vec3 = [0.024, 0.022, 0.012];
const THUMB_SEGMENTS: Vec3 = [0.042, 0.032, 0.027];
const FINGER_FIRST_JOINT = { index: 5, middle: 10, ring: 15, pinky: 20 } as const;

const rad = (deg: number) => (deg * Math.PI) / 180;

function normalize(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

/** Rotate unit vector `d` by `deg` toward `toward` (within their plane). */
function bendToward(d: Vec3, toward: Vec3, deg: number): Vec3 {
  const dot = d[0] * toward[0] + d[1] * toward[1] + d[2] * toward[2];
  const w = normalize([
    toward[0] - dot * d[0],
    toward[1] - dot * d[1],
    toward[2] - dot * d[2],
  ]);
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return [c * d[0] + s * w[0], c * d[1] + s * w[1], c * d[2] + s * w[2]];
}

function put(out: Float32Array, joint: number, p: Vec3): void {
  out[joint * 3] = p[0];
  out[joint * 3 + 1] = p[1];
  out[joint * 3 + 2] = p[2];
}

/** Build 25 joint positions (x,y,z triples) in the model frame. */
export function buildHandLocal(pose: HandPose, out = new Float32Array(75)): Float32Array {
  put(out, J.wrist, [0, 0, 0]);

  // Thumb: three bones from the base of the thumb.
  let d = normalize(pose.thumb.dir);
  const toward = normalize(pose.thumb.toward);
  let p: Vec3 = [...THUMB_BASE];
  put(out, J.thumbMeta, p);
  const bends = [0, pose.thumb.mcp, pose.thumb.ip];
  for (let i = 0; i < 3; i++) {
    if (bends[i] !== 0) d = bendToward(d, toward, bends[i]);
    p = [
      p[0] + d[0] * THUMB_SEGMENTS[i],
      p[1] + d[1] * THUMB_SEGMENTS[i],
      p[2] + d[2] * THUMB_SEGMENTS[i],
    ];
    put(out, J.thumbProx + i, p);
  }

  // Fingers: bend toward the palm (+Z), spread within the palm plane.
  for (const name of ['index', 'middle', 'ring', 'pinky'] as const) {
    const f = pose[name];
    const knuckle = KNUCKLE[name];
    const first = FINGER_FIRST_JOINT[name];
    put(out, first, [knuckle[0] * 0.3, knuckle[1] * 0.3, 0]);
    put(out, first + 1, knuckle);
    const spread = rad(f.spread ?? 0);
    const ux = Math.sin(spread);
    const uy = Math.cos(spread);
    let angle = 0;
    let q: Vec3 = [...knuckle];
    const flex = [f.mcp, f.pip, f.dip];
    for (let i = 0; i < 3; i++) {
      angle += rad(flex[i]);
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const len = SEGMENTS[name][i];
      q = [q[0] + ux * c * len, q[1] + uy * c * len, q[2] + s * len];
      put(out, first + 2 + i, q);
    }
  }
  return out;
}

/**
 * Joint positions as the signer sees their own right hand, in a frame where
 * +Y is up and -Z is away from the signer (the same convention as WebXR).
 * Pass `mirror` for a left hand.
 */
export function buildHandWorld(
  pose: HandPose,
  mirror = false,
  out = new Float32Array(75),
): Float32Array {
  buildHandLocal(pose, out);
  for (let i = 0; i < JOINT_COUNT; i++) {
    const x = out[i * 3];
    const y = out[i * 3 + 1];
    const z = out[i * 3 + 2];
    let wx: number;
    let wy: number;
    let wz: number;
    if (pose.orient === 'side') {
      // Fingers point to the signer's left, palm faces the signer.
      wx = -y;
      wy = x;
      wz = z;
    } else {
      // Fingers up, palm away from the signer.
      wx = -x;
      wy = y;
      wz = -z;
    }
    out[i * 3] = mirror ? -wx : wx;
    out[i * 3 + 1] = wy;
    out[i * 3 + 2] = wz;
  }
  return out;
}

const EXT: FingerPose = { mcp: 0, pip: 0, dip: 0 };
const FIST: FingerPose = { mcp: 80, pip: 100, dip: 65 };
const TUCK: FingerPose = { mcp: 55, pip: 105, dip: 75 };
const HOOK: FingerPose = { mcp: 8, pip: 95, dip: 60 };

/** Thumb folded across the front of a fist. */
const THUMB_ACROSS: ThumbPose = {
  dir: [0.35, 0.5, 0.8],
  toward: [-1, 0.25, 0.1],
  mcp: 55,
  ip: 35,
};
/** Thumb resting along the side of the index finger. */
const THUMB_SIDE: ThumbPose = {
  dir: [0.22, 0.9, 0.38],
  toward: [-1, 0, 0],
  mcp: 0,
  ip: 0,
};
/** Thumb sticking straight out to the side. */
const THUMB_OUT: ThumbPose = {
  dir: [1, 0.25, 0.1],
  toward: [0, 1, 0],
  mcp: 0,
  ip: 0,
};
/** Thumb folded flat across the palm. */
const THUMB_PALM: ThumbPose = {
  dir: [0.2, 0.6, 0.75],
  toward: [-1, 0.3, -0.2],
  mcp: 60,
  ip: 30,
};

/**
 * The letters the game supports. J and Z need movement, and M, N, S and T are
 * fists that differ only by where the thumb is tucked, which headset hand
 * tracking cannot tell apart reliably. K, P and Q are left out for the same
 * reason (thumb tucked between fingers, or the hand pointing down).
 */
export const LETTER_POSES: Record<string, HandPose> = {
  A: { thumb: THUMB_SIDE, index: FIST, middle: FIST, ring: FIST, pinky: FIST },
  B: { thumb: THUMB_PALM, index: EXT, middle: EXT, ring: EXT, pinky: EXT },
  C: {
    thumb: { dir: [0.5, 0.45, 0.75], toward: [-0.6, 0.6, 0.5], mcp: 5, ip: 15 },
    index: { mcp: 35, pip: 60, dip: 35 },
    middle: { mcp: 35, pip: 60, dip: 35 },
    ring: { mcp: 35, pip: 60, dip: 35 },
    pinky: { mcp: 35, pip: 60, dip: 35 },
  },
  D: {
    thumb: { dir: [0.3, 0.55, 0.8], toward: [-1, 0.5, 0.2], mcp: 35, ip: 25 },
    index: EXT,
    middle: { mcp: 60, pip: 75, dip: 40 },
    ring: { mcp: 62, pip: 78, dip: 42 },
    pinky: { mcp: 64, pip: 80, dip: 45 },
  },
  E: {
    thumb: { dir: [0.25, 0.45, 0.85], toward: [-1, 0.2, -0.1], mcp: 60, ip: 40 },
    index: TUCK,
    middle: TUCK,
    ring: TUCK,
    pinky: TUCK,
  },
  F: {
    thumb: { dir: [0.4, 0.6, 0.7], toward: [-0.6, 0.7, 0.3], mcp: 20, ip: 25 },
    index: { mcp: 50, pip: 62, dip: 35 },
    middle: { ...EXT, spread: -2 },
    ring: { ...EXT, spread: -10 },
    pinky: { ...EXT, spread: -20 },
  },
  G: {
    thumb: { dir: [0.3, 0.85, 0.42], toward: [-1, 0, 0], mcp: 0, ip: 0 },
    index: EXT,
    middle: FIST,
    ring: FIST,
    pinky: FIST,
    orient: 'side',
  },
  H: {
    thumb: THUMB_ACROSS,
    index: EXT,
    middle: EXT,
    ring: FIST,
    pinky: FIST,
    orient: 'side',
  },
  I: { thumb: THUMB_ACROSS, index: FIST, middle: FIST, ring: FIST, pinky: EXT },
  L: { thumb: THUMB_OUT, index: EXT, middle: FIST, ring: FIST, pinky: FIST },
  O: {
    thumb: { dir: [0.4, 0.55, 0.75], toward: [-0.6, 0.7, 0.3], mcp: 25, ip: 25 },
    index: { mcp: 50, pip: 62, dip: 35 },
    middle: { mcp: 50, pip: 60, dip: 35 },
    ring: { mcp: 52, pip: 60, dip: 35 },
    pinky: { mcp: 55, pip: 58, dip: 35 },
  },
  R: {
    thumb: THUMB_ACROSS,
    index: { mcp: 0, pip: 0, dip: 0, spread: -14 },
    middle: { mcp: 12, pip: 0, dip: 0, spread: 8 },
    ring: FIST,
    pinky: FIST,
  },
  U: { thumb: THUMB_ACROSS, index: EXT, middle: EXT, ring: FIST, pinky: FIST },
  V: {
    thumb: THUMB_ACROSS,
    index: { ...EXT, spread: 12 },
    middle: { ...EXT, spread: -12 },
    ring: FIST,
    pinky: FIST,
  },
  W: {
    thumb: { dir: [0.15, 0.5, 0.85], toward: [-1, 0.2, 0], mcp: 65, ip: 40 },
    index: { ...EXT, spread: 12 },
    middle: EXT,
    ring: { ...EXT, spread: -12 },
    pinky: FIST,
  },
  X: { thumb: THUMB_ACROSS, index: HOOK, middle: FIST, ring: FIST, pinky: FIST },
  Y: { thumb: THUMB_OUT, index: FIST, middle: FIST, ring: FIST, pinky: { ...EXT, spread: -18 } },
};

/** Every letter the recogniser can report, in alphabetical order. */
export const SUPPORTED_LETTERS = Object.keys(LETTER_POSES).sort();

/** A relaxed open hand: not a letter. Used as a negative test and as a rest pose. */
export const REST_POSE: HandPose = {
  thumb: { dir: [0.8, 0.55, 0.3], toward: [0, 1, 0], mcp: 10, ip: 10 },
  index: { mcp: 15, pip: 20, dip: 10, spread: 8 },
  middle: { mcp: 18, pip: 22, dip: 10 },
  ring: { mcp: 20, pip: 24, dip: 12, spread: -8 },
  pinky: { mcp: 22, pip: 26, dip: 12, spread: -16 },
};
