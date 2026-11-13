import {
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from '@iwsdk/core';
import { BONES, JOINT_COUNT, LETTER_POSES, buildHandWorld } from './game/hand-model.js';

const sphere = new SphereGeometry(1, 12, 8);
const cylinder = new CylinderGeometry(1, 1, 1, 10, 1, true);

const m = new Matrix4();
const q = new Quaternion();
const a = new Vector3();
const b = new Vector3();
const dir = new Vector3();
const scale = new Vector3();
const UP = new Vector3(0, 1, 0);
const joints = new Float32Array(JOINT_COUNT * 3);

/** Bones that make up the palm are drawn thicker so the hand reads as solid. */
const isPalmBone = (i: number, j: number) => i === 0 || (i % 5 === 0 && j === i + 1) || j - i === 5 || (i === 1 && j === 6);

/**
 * A simple jointed hand (balls and rods) showing one handshape, drawn the way
 * the signer sees their own hand. Two draw calls per hand.
 */
export class HandFigure extends Group {
  readonly material = new MeshStandardMaterial({ color: 0xe8d9c5, roughness: 0.65, metalness: 0 });
  private balls = new InstancedMesh(sphere, this.material, JOINT_COUNT);
  private rods = new InstancedMesh(cylinder, this.material, BONES.length);
  private inner = new Group();

  constructor() {
    super();
    this.balls.frustumCulled = false;
    this.rods.frustumCulled = false;
    this.inner.add(this.balls, this.rods);
    this.add(this.inner);
  }

  /** Show a left hand instead of a right hand. */
  setMirrored(mirrored: boolean): void {
    this.inner.scale.x = mirrored ? -1 : 1;
  }

  setLetter(letter: string): void {
    const pose = LETTER_POSES[letter];
    if (!pose) return;
    buildHandWorld(pose, false, joints);
    // Centre the figure on the middle of the hand so it rotates in place.
    const sideways = pose.orient === 'side';
    const cx = sideways ? -0.09 : 0;
    const cy = sideways ? 0.02 : 0.09;

    for (let i = 0; i < JOINT_COUNT; i++) {
      const r = i === 0 ? 0.014 : i % 5 === 1 ? 0.0115 : i % 5 === 4 ? 0.0075 : 0.009;
      m.makeScale(r, r, r).setPosition(joints[i * 3] - cx, joints[i * 3 + 1] - cy, joints[i * 3 + 2]);
      this.balls.setMatrixAt(i, m);
    }
    BONES.forEach(([i, j], n) => {
      a.set(joints[i * 3] - cx, joints[i * 3 + 1] - cy, joints[i * 3 + 2]);
      b.set(joints[j * 3] - cx, joints[j * 3 + 1] - cy, joints[j * 3 + 2]);
      dir.subVectors(b, a);
      const len = dir.length();
      q.setFromUnitVectors(UP, dir.normalize());
      const r = isPalmBone(i, j) ? 0.0105 : 0.0078;
      m.compose(a.add(b).multiplyScalar(0.5), q, scale.set(r, len, r));
      this.rods.setMatrixAt(n, m);
    });
    this.balls.instanceMatrix.needsUpdate = true;
    this.rods.instanceMatrix.needsUpdate = true;
  }
}
