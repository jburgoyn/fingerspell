// Prints recogniser measurements for every synthetic letter. Run: npx vite-node scripts/tune.ts
import { LETTER_POSES, REST_POSE, buildHandWorld } from '../src/game/hand-model.js';
import { HandshapeRecognizer, RECOGNISED_LETTERS } from '../src/game/recognizer.js';

const rec = new HandshapeRecognizer();
const f1 = (n: number) => n.toFixed(2).padStart(6);
const row = (name: string, joints: Float32Array, left: boolean) => {
  const r = rec.classify(joints, left);
  const f = rec.features;
  console.log(
    name.padEnd(5),
    (r.letter ?? '-').padEnd(2),
    `${r.best}${f1(r.confidence)} ${r.second}${f1(r.secondScore)}`,
    '| pip', [...f.pip].map((v) => v.toFixed(0).padStart(4)).join(''),
    '| mcp', [...f.mcp].map((v) => v.toFixed(0).padStart(4)).join(''),
    '| ext', [...f.extended].map((v) => v.toFixed(1)).join(' '),
    '| tip', [...f.thumbToTip].map(f1).join(''),
    '| reach', f1(f.thumbReach), 'T', f1(f.thumbT), 'N', f1(f.thumbN),
    'ang', f.thumbIndexAngle.toFixed(0).padStart(4),
    'gap', f1(f.indexMiddleGap), 'up', f1(f.indexUp),
  );
};
for (const [letter, pose] of Object.entries(LETTER_POSES)) {
  row(letter, buildHandWorld(pose, false), false);
  row(letter + '(L)', buildHandWorld(pose, true), true);
}
row('rest', buildHandWorld(REST_POSE), false);
void RECOGNISED_LETTERS;
