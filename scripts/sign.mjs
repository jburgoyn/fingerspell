// Signs a word with the emulator's right hand, one letter at a time.
// Usage: node scripts/sign.mjs CLOUD        (R has no emulator pose)
import { execFileSync } from 'node:child_process';

const POSES = {
  A: ['fist', { thumb: 'key-pinch' }], B: ['four'], C: ['claw'], D: ['point'], E: ['fist'],
  F: ['ok'], G: ['point'], H: ['fist', { index: 'flat', middle: 'flat' }],
  I: ['fist', { pinky: 'open' }], L: ['finger-gun'], O: ['tripod'],
  U: ['fist', { index: 'flat', middle: 'flat' }], V: ['peace'], W: ['three'],
  X: ['fist', { index: 'hook' }], Y: ['call'],
};
const xr = (action, input) =>
  execFileSync('npx', ['@iwsdk/cli', 'xr', action, '--input-json', JSON.stringify(input)], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const device = 'hand-right';
const place = (sideways) =>
  xr('set-transform', {
    device,
    position: { x: sideways ? 0.24 : 0.18, y: 1.42, z: -0.35 },
    anchor: 'wrist',
    orientation: sideways ? { fingers: 'left', palm: "toward-head" } : { fingers: 'up', palm: 'forward' },
  });

for (const letter of process.argv[2].toUpperCase()) {
  const pose = POSES[letter];
  if (!pose) throw new Error(`no emulator pose for ${letter}`);
  place(letter === 'G' || letter === 'H');
  xr('set-hand-pose', { device, poseId: pose[0], fingers: pose[1] ?? {} });
  await sleep(Number(process.argv[3] ?? 1500));
  xr('set-hand-pose', { device, poseId: 'default' });
  await sleep(450);
}
