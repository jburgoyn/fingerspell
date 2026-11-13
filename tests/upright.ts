import { J } from '../src/game/hand-model.js';

/**
 * Re-orient captured joints as a player would hold the hand: fingers up and
 * palm facing away (or, with `sideways`, fingers pointing across the body and
 * palm facing the player, as for G and H).
 */
export function uprightHand(raw: ArrayLike<number>, left: boolean, sideways = false): Float32Array {
  const at = (j: number): [number, number, number] => [raw[j * 3], raw[j * 3 + 1], raw[j * 3 + 2]];
  const sub = (a: number[], b: number[]) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a: number[], b: number[]) => [
    a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0],
  ];
  const unit = (a: number[]) => {
    const l = Math.hypot(a[0], a[1], a[2]);
    return [a[0] / l, a[1] / l, a[2] / l];
  };
  const wrist = at(J.wrist);
  const U = unit(sub(at(J.middleProx), wrist));
  let T = sub(at(J.indexProx), at(J.pinkyProx));
  const tu = dot(T, U);
  T = unit([T[0] - tu * U[0], T[1] - tu * U[1], T[2] - tu * U[2]]);
  // Out of the palm: T x U for a right hand, the opposite for a left hand.
  let N = cross(T, U);
  if (left) N = [-N[0], -N[1], -N[2]];

  const out = new Float32Array(75);
  const thumbSide = left ? 1 : -1; // world X of the thumb side when the palm faces away
  for (let j = 0; j < 25; j++) {
    const d = sub(at(j), wrist);
    const t = dot(d, T);
    const u = dot(d, U);
    const n = dot(d, N);
    if (sideways) {
      out[j * 3] = u * thumbSide;
      out[j * 3 + 1] = t;
      out[j * 3 + 2] = n;
    } else {
      out[j * 3] = t * thumbSide;
      out[j * 3 + 1] = u;
      out[j * 3 + 2] = -n;
    }
  }
  return out;
}
