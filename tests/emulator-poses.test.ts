import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HandshapeRecognizer } from '../src/game/recognizer.js';
import { uprightHand } from './upright.js';

/**
 * Joint positions captured from the WebXR emulator's built-in hand poses
 * (scripts/capture-iwer.mjs). They were not authored for this game, so they
 * are an independent check on the recogniser. There is no crossed-fingers
 * pose in the emulator, so R is only covered by the synthetic hand.
 */
const poses = JSON.parse(
  readFileSync(new URL('./fixtures/iwer-poses.json', import.meta.url), 'utf8'),
) as Record<string, number[]>;

// pose name, held sideways?, expected letter (null = must not be read as a letter)
const EXPECTED: Array<[string, boolean, string | null]> = [
  ['fist+thumb-keypinch', false, 'A'],
  ['flat', false, 'B'],
  ['four', false, 'B'],
  ['claw', false, 'C'],
  ['point', false, 'D'],
  ['fist+index-flat', false, 'D'],
  ['fist', false, 'E'],
  ['ok', false, 'F'],
  ['point', true, 'G'],
  ['fist+index-middle-flat', true, 'H'],
  ['fist+pinky-open', false, 'I'],
  ['finger-gun', false, 'L'],
  ['tripod', false, 'O'],
  ['tripod+ring-pinky-pinch', false, 'O'],
  ['fist+index-middle-flat', false, 'U'],
  ['peace', false, 'V'],
  ['three', false, 'W'],
  ['fist+index-hook', false, 'X'],
  ['call', false, 'Y'],
  ['default', false, null],
  ['open', false, null],
  ['rock', false, null],
  ['thumbs-up', false, null],
  ['microgesture', false, null],
];

describe('recogniser on emulator hand poses', () => {
  const rec = new HandshapeRecognizer();
  for (const side of ['R', 'L']) {
    for (const [pose, sideways, letter] of EXPECTED) {
      it(`${side} ${pose}${sideways ? ' (sideways)' : ''} -> ${letter ?? 'nothing'}`, () => {
        const left = side === 'L';
        const joints = uprightHand(poses[`${side}:${pose}`], left, sideways);
        expect(rec.classify(joints, left).letter).toBe(letter);
      });
    }
  }
});
