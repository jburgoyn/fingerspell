// Captures joint positions for the emulator's built-in hand poses (and a few
// finger mixes) into tests/fixtures/iwer-poses.json. Needs a running dev
// session that is in XR with hand input.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const NAMES = ['wrist',
  'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip',
  ...['index-finger', 'middle-finger', 'ring-finger', 'pinky-finger'].flatMap((f) => [
    `${f}-metacarpal`, `${f}-phalanx-proximal`, `${f}-phalanx-intermediate`, `${f}-phalanx-distal`, `${f}-tip`,
  ])];
const run = (action, input) =>
  JSON.parse(execFileSync('npx', ['@iwsdk/cli', 'xr', action, '--input-json', JSON.stringify(input)], { encoding: 'utf8' }));

const base = ['default', 'pinch', 'point', 'open', 'flat', 'fist', 'thumbs-up', 'finger-gun', 'peace',
  'three', 'four', 'ok', 'rock', 'call', 'pinch-middle', 'tripod', 'key-pinch', 'microgesture',
  'grip', 'claw', 'hook', 'cup'].map((poseId) => ({ name: poseId, poseId }));
const mixes = [
  { name: 'fist+thumb-keypinch', poseId: 'fist', fingers: { thumb: 'key-pinch' } },
  { name: 'fist+pinky-open', poseId: 'fist', fingers: { pinky: 'open' } },
  { name: 'fist+index-middle-flat', poseId: 'fist', fingers: { index: 'flat', middle: 'flat' } },
  { name: 'fist+index-hook', poseId: 'fist', fingers: { index: 'hook' } },
  { name: 'tripod+ring-pinky-pinch', poseId: 'tripod', fingers: { ring: 'pinch-ring', pinky: 'pinch-pinky' } },
  { name: 'fist+index-flat', poseId: 'fist', fingers: { index: 'flat' } },
];
const out = {};
for (const hand of ['hand-right', 'hand-left']) {
  for (const p of [...base, ...mixes]) {
    run('set-hand-pose', { device: hand, poseId: p.poseId, ...(p.fingers ? { fingers: p.fingers } : {}) });
    const state = run('get-hand-state', { device: hand, joints: 'all' }).data.result;
    out[`${hand === 'hand-left' ? 'L' : 'R'}:${p.name}`] = NAMES.flatMap((n) => {
      const q = state.joints[n].position;
      return [+q.x.toFixed(5), +q.y.toFixed(5), +q.z.toFixed(5)];
    });
    process.stdout.write('.');
  }
}
writeFileSync('tests/fixtures/iwer-poses.json', JSON.stringify(out));
console.log('\nwrote', Object.keys(out).length, 'poses');
