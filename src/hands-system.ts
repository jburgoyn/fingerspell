import { createSystem, Vector3 } from '@iwsdk/core';
import { JOINT_COUNT, J } from './game/hand-model.js';
import { HandshapeRecognizer } from './game/recognizer.js';
import { sign } from './sign-state.js';

/** A hand counts as "raised" when its wrist is no more than this far below the eyes. */
const ZONE_BELOW_HEAD = 0.4;
/** ...and within this distance of the head. */
const ZONE_REACH = 0.85;
/** A fingertip this close to the button bar is pressing, not signing. */
const CONTROLS_RADIUS = 0.3;

type FillPoses = (spaces: XRSpace[], base: XRSpace, out: Float32Array) => boolean;

interface TrackedHand {
  left: boolean;
  spaces: XRJointSpace[];
  source: XRInputSource | null;
  poses: Float32Array;
  joints: Float32Array;
  valid: boolean;
  raised: boolean;
  /** Last two raw results, used to ignore one-frame flickers. */
  previous: string | null;
  stable: string | null;
}

const makeHand = (left: boolean): TrackedHand => ({
  left,
  spaces: [],
  source: null,
  poses: new Float32Array(JOINT_COUNT * 16),
  joints: new Float32Array(JOINT_COUNT * 3),
  valid: false,
  raised: false,
  previous: null,
  stable: null,
});

/**
 * Reads raw WebXR hand joints every frame, classifies each raised hand's
 * shape, and feeds the result through the hold-to-confirm detector.
 */
export class HandSignSystem extends createSystem({}) {
  private recognizer = new HandshapeRecognizer();
  private hands = [makeHand(true), makeHand(false)];
  private head = new Vector3();
  private tip = new Vector3();
  private lastLeft = false;

  init(): void {
    // Desktop-only developer aid: with ?keys in the URL, typing a letter enters
    // it as if it had been signed. It is never active on a headset by default.
    if (new URLSearchParams(location.search).has('keys')) {
      const onKey = (e: KeyboardEvent) => {
        if (/^[a-zA-Z]$/.test(e.key) && sign.listening) sign.onLetter?.(e.key.toUpperCase(), false);
      };
      window.addEventListener('keydown', onKey);
      this.cleanupFuncs.push(() => window.removeEventListener('keydown', onKey));
    }
  }

  update(delta: number): void {
    const frame = this.world.xrFrame;
    const space = this.world.xrReferenceSpace;
    const session = this.world.session;
    if (!frame || !space || !session) {
      sign.tracked = false;
      sign.raised = false;
      sign.candidate = null;
      sign.progress = 0;
      return;
    }

    this.player.head.getWorldPosition(this.head);
    for (const hand of this.hands) {
      hand.valid = false;
      hand.raised = false;
    }

    for (const source of session.inputSources) {
      if (!source.hand || (source.handedness !== 'left' && source.handedness !== 'right')) continue;
      const hand = this.hands[source.handedness === 'left' ? 0 : 1];
      if (hand.source !== source || hand.spaces.length !== JOINT_COUNT) {
        hand.source = source;
        hand.spaces = Array.from(source.hand.values());
      }
      const fill: FillPoses | undefined = (frame as unknown as { fillPoses?: FillPoses }).fillPoses;
      if (hand.spaces.length !== JOINT_COUNT) continue;
      if (fill) {
        // One call for all 25 joints.
        if (!fill.call(frame, hand.spaces, space, hand.poses)) continue;
        for (let i = 0; i < JOINT_COUNT; i++) {
          hand.joints[i * 3] = hand.poses[i * 16 + 12];
          hand.joints[i * 3 + 1] = hand.poses[i * 16 + 13];
          hand.joints[i * 3 + 2] = hand.poses[i * 16 + 14];
        }
      } else if (frame.getJointPose) {
        // Older browsers: ask for each joint in turn.
        let complete = true;
        for (let i = 0; i < JOINT_COUNT; i++) {
          const pose = frame.getJointPose(hand.spaces[i], space);
          if (!pose) {
            complete = false;
            break;
          }
          hand.joints[i * 3] = pose.transform.position.x;
          hand.joints[i * 3 + 1] = pose.transform.position.y;
          hand.joints[i * 3 + 2] = pose.transform.position.z;
        }
        if (!complete) continue;
      } else {
        continue;
      }
      hand.valid = true;

      const j = hand.joints;
      const wristY = j[J.wrist * 3 + 1];
      const dx = j[0] - this.head.x;
      const dz = j[2] - this.head.z;
      this.tip.set(j[J.indexTip * 3], j[J.indexTip * 3 + 1], j[J.indexTip * 3 + 2]);
      hand.raised =
        wristY > this.head.y - ZONE_BELOW_HEAD &&
        Math.hypot(dx, dz) < ZONE_REACH &&
        this.tip.distanceTo(sign.controlsCenter) > CONTROLS_RADIUS;
    }

    let active: TrackedHand | null = null;
    let tracked = false;
    let raised = false;
    for (const hand of this.hands) {
      if (!hand.valid) {
        hand.previous = hand.stable = null;
        continue;
      }
      tracked = true;
      if (!hand.raised) {
        hand.previous = hand.stable = null;
        continue;
      }
      raised = true;
      const raw = this.recognizer.classify(hand.joints, hand.left).letter;
      // Accept a change only once two frames in a row agree.
      if (raw === hand.previous) hand.stable = raw;
      hand.previous = raw;
      if (hand.stable && (!active || hand.left === this.lastLeft)) active = hand;
    }

    sign.tracked = tracked;
    sign.raised = raised;
    if (!sign.listening) {
      // Leave the hold detector alone: it may be holding a post-press lock.
      sign.candidate = null;
      sign.progress = 0;
      return;
    }

    if (active) this.lastLeft = active.left;
    const entered = sign.hold.update(active ? active.stable : null, delta * 1000, raised);
    sign.candidate = sign.hold.candidate;
    sign.progress = sign.hold.progress;
    sign.left = this.lastLeft;
    if (entered) sign.onLetter?.(entered, this.lastLeft);
  }
}
