import { describe, expect, it } from 'vitest';
import { LETTER_POSES, REST_POSE, SUPPORTED_LETTERS, buildHandWorld } from '../src/game/hand-model.js';
import { HoldDetector, Round, evaluateGuess } from '../src/game/logic.js';
import { HandshapeRecognizer, RECOGNISED_LETTERS } from '../src/game/recognizer.js';
import { currentStreak, defaultSave, recordDaily } from '../src/game/save.js';
import { WORDS, dailyWord } from '../src/game/words.js';

describe('recogniser on the synthetic reference hand', () => {
  const rec = new HandshapeRecognizer();

  it('supports exactly the documented letters', () => {
    expect([...RECOGNISED_LETTERS].sort()).toEqual(SUPPORTED_LETTERS);
  });

  for (const letter of SUPPORTED_LETTERS) {
    it(`reads ${letter} on a right and a left hand`, () => {
      expect(rec.classify(buildHandWorld(LETTER_POSES[letter], false), false).letter).toBe(letter);
      expect(rec.classify(buildHandWorld(LETTER_POSES[letter], true), true).letter).toBe(letter);
    });

    it(`still reads ${letter} with tracking jitter and a tilted hand`, () => {
      let seed = letter.charCodeAt(0);
      const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32) - 0.5;
      let hits = 0;
      const trials = 40;
      for (let t = 0; t < trials; t++) {
        const joints = buildHandWorld(LETTER_POSES[letter], false);
        // Tilt up to ~12 degrees about the forward axis, add 2 mm of noise.
        const a = rand() * 0.42;
        const c = Math.cos(a);
        const s = Math.sin(a);
        for (let i = 0; i < 75; i += 3) {
          const x = joints[i];
          const y = joints[i + 1];
          joints[i] = c * x - s * y + rand() * 0.004;
          joints[i + 1] = s * x + c * y + rand() * 0.004;
          joints[i + 2] += rand() * 0.004;
        }
        if (rec.classify(joints, false).letter === letter) hits++;
      }
      expect(hits / trials).toBeGreaterThanOrEqual(0.9);
    });
  }

  it('reports nothing for a relaxed open hand', () => {
    expect(rec.classify(buildHandWorld(REST_POSE), false).letter).toBeNull();
  });
});

describe('word list', () => {
  it('has plenty of words, all five supported letters long', () => {
    const ok = new Set<string>(RECOGNISED_LETTERS);
    expect(WORDS.length).toBeGreaterThan(200);
    for (const w of WORDS) {
      expect(w).toHaveLength(5);
      expect([...w].every((c) => ok.has(c))).toBe(true);
    }
  });

  it('gives a stable daily word and does not repeat within the list length', () => {
    expect(dailyWord(320)).toBe(dailyWord(320));
    const seen = new Set<string>();
    for (let d = 0; d < WORDS.length; d++) seen.add(dailyWord(d));
    expect(seen.size).toBe(WORDS.length);
  });
});

describe('guess feedback', () => {
  it('marks correct, present and absent', () => {
    expect(evaluateGuess('CLOUD', 'COULD')).toEqual([
      'correct', 'present', 'present', 'present', 'correct',
    ]);
  });
  it('does not over-count repeated letters', () => {
    expect(evaluateGuess('HELLO', 'WORLD')).toEqual([
      'absent', 'absent', 'absent', 'correct', 'present',
    ]);
    expect(evaluateGuess('LEVEL', 'HELLO')).toEqual([
      'present', 'correct', 'absent', 'absent', 'present',
    ]);
  });
});

describe('round', () => {
  it('plays to a win', () => {
    const r = new Round('WORLD');
    for (const c of 'HELLO') r.addLetter(c);
    expect(r.addLetter('X')).toBe(false);
    r.undo();
    r.addLetter('O');
    r.submit();
    expect(r.status).toBe('playing');
    expect(r.letterStates()).toMatchObject({ H: 'absent', L: 'correct', O: 'present' });
    for (const c of 'WORLD') r.addLetter(c);
    r.submit();
    expect(r.status).toBe('won');
  });
  it('is lost after six wrong guesses and restores from a save', () => {
    const r = new Round('WORLD', { guesses: Array(6).fill('HELLO') });
    expect(r.status).toBe('lost');
    expect(r.guesses).toHaveLength(6);
  });
});

describe('hold to confirm', () => {
  const run = (h: HoldDetector, letter: string | null, ms: number) => {
    const fired: string[] = [];
    for (let t = 0; t < ms; t += 10) {
      const f = h.update(letter, 10);
      if (f) fired.push(f);
    }
    return fired;
  };

  it('does not enter a letter that is only flashed', () => {
    const h = new HoldDetector();
    expect(run(h, 'L', 500)).toEqual([]);
    expect(run(h, null, 400)).toEqual([]);
    expect(run(h, 'L', 500)).toEqual([]);
  });
  it('enters a held letter exactly once', () => {
    const h = new HoldDetector();
    expect(run(h, 'L', 3000)).toEqual(['L']);
  });
  it('survives a brief tracking dropout', () => {
    const h = new HoldDetector();
    run(h, 'L', 500);
    run(h, null, 100);
    expect(run(h, 'L', 450)).toEqual(['L']);
  });
  it('needs the hand to relax before a double letter', () => {
    const h = new HoldDetector();
    expect(run(h, 'L', 1000)).toEqual(['L']);
    expect(run(h, null, 300)).toEqual([]);
    expect(run(h, 'L', 1000)).toEqual(['L']);
  });
  it('ignores a shape carried over from a button press until the hand relaxes', () => {
    const h = new HoldDetector();
    h.lockLetters('DG');
    // Hand still down at the buttons: nothing counts, however long it takes.
    for (let t = 0; t < 2000; t += 10) expect(h.update(null, 10, false)).toBeNull();
    // It comes back up still pointing, upright or sideways: no letter.
    expect(run(h, 'D', 1500)).toEqual([]);
    expect(run(h, 'G', 1500)).toEqual([]);
    // Relax, then a deliberate D works.
    expect(run(h, null, 300)).toEqual([]);
    expect(run(h, 'D', 1000)).toEqual(['D']);
    // And a different letter straight after a press works immediately.
    h.lockLetters('DG');
    expect(run(h, 'L', 1000)).toEqual(['L']);
  });
  it('moves straight on to a different letter', () => {
    const h = new HoldDetector();
    run(h, 'L', 1000);
    expect(run(h, 'O', 1000)).toEqual(['O']);
  });
});

describe('streak', () => {
  it('grows on consecutive days and lapses after a miss', () => {
    const s = defaultSave();
    recordDaily(s, 10, true);
    recordDaily(s, 11, true);
    expect(currentStreak(s, 11)).toBe(2);
    expect(currentStreak(s, 12)).toBe(2);
    expect(currentStreak(s, 13)).toBe(0);
    recordDaily(s, 14, true);
    expect(s.streak).toBe(1);
    recordDaily(s, 15, false);
    expect(s.streak).toBe(0);
    expect(s.bestStreak).toBe(2);
  });
});
