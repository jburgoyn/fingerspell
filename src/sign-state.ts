import { Vector3 } from '@iwsdk/core';
import { HoldDetector } from './game/logic.js';

/**
 * What the player's hands are doing right now. Written by HandSignSystem,
 * read by GameSystem. A plain shared object keeps the two systems decoupled
 * without per-frame allocation.
 */
export const sign = {
  /** At least one hand is being tracked. */
  tracked: false,
  /** A tracked hand is raised into the signing zone. */
  raised: false,
  /** The letter currently being held (not yet entered), or null. */
  candidate: null as string | null,
  /** 0..1 progress of the hold. */
  progress: 0,
  /** True when the active hand is the left hand. */
  left: false,
  /** Set false to ignore handshapes (menus). */
  listening: false,
  /** Hands near this point are pressing buttons, not signing. */
  controlsCenter: new Vector3(0, 0.74, -0.38),
  hold: new HoldDetector(),
  /** Called once each time a letter is entered. */
  onLetter: null as ((letter: string, left: boolean) => void) | null,
};
