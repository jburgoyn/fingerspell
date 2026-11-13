// Runs the recogniser over the captured emulator poses. Each pose is turned
// upright (fingers up, palm away) first, as a player would hold it.
import { readFileSync } from 'node:fs';
import { HandshapeRecognizer } from '../src/game/recognizer.js';
import { uprightHand } from '../tests/upright.js';

const poses = JSON.parse(readFileSync('tests/fixtures/iwer-poses.json', 'utf8')) as Record<string, number[]>;
const rec = new HandshapeRecognizer();
const f1 = (n: number) => n.toFixed(2).padStart(6);
for (const [name, raw] of Object.entries(poses)) {
  const left = name.startsWith('L:');
  for (const side of [false, true]) {
    const r = rec.classify(uprightHand(raw, left, side), left);
    const f = rec.features;
    console.log(
      (name + (side ? ' >' : '')).padEnd(28), (r.letter ?? '-').padEnd(2),
      `${r.best}${f1(r.confidence)} ${r.second}${f1(r.secondScore)}`,
      '| pip', [...f.pip].map((v) => v.toFixed(0).padStart(4)).join(''),
      '| mcp', [...f.mcp].map((v) => v.toFixed(0).padStart(4)).join(''),
      '| tip', [...f.thumbToTip].map(f1).join(''),
      '| T', f1(f.thumbT), 'N', f1(f.thumbN), 'ang', f.thumbIndexAngle.toFixed(0).padStart(4),
      'gap', f1(f.indexMiddleGap), 'up', f1(f.indexUp),
    );
  }
}
