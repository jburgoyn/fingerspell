import { MAX_GUESSES, WORD_LENGTH } from './words.js';

export type Mark = 'correct' | 'present' | 'absent';

/** Standard word-guessing feedback, handling repeated letters properly. */
export function evaluateGuess(guess: string, answer: string): Mark[] {
  const marks: Mark[] = new Array(guess.length).fill('absent');
  const left: Record<string, number> = {};
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) marks[i] = 'correct';
    else left[answer[i]] = (left[answer[i]] ?? 0) + 1;
  }
  for (let i = 0; i < guess.length; i++) {
    if (marks[i] === 'correct') continue;
    if (left[guess[i]] > 0) {
      marks[i] = 'present';
      left[guess[i]]--;
    }
  }
  return marks;
}

export type RoundStatus = 'playing' | 'won' | 'lost';

export class Round {
  guesses: string[] = [];
  marks: Mark[][] = [];
  current = '';
  status: RoundStatus = 'playing';

  constructor(
    readonly answer: string,
    saved?: { guesses: string[] },
  ) {
    for (const g of saved?.guesses ?? []) {
      this.current = g;
      this.submit();
    }
  }

  addLetter(letter: string): boolean {
    if (this.status !== 'playing' || this.current.length >= WORD_LENGTH) return false;
    this.current += letter;
    return true;
  }

  undo(): boolean {
    if (this.status !== 'playing' || this.current.length === 0) return false;
    this.current = this.current.slice(0, -1);
    return true;
  }

  canSubmit(): boolean {
    return this.status === 'playing' && this.current.length === WORD_LENGTH;
  }

  submit(): Mark[] | null {
    if (!this.canSubmit()) return null;
    const marks = evaluateGuess(this.current, this.answer);
    this.guesses.push(this.current);
    this.marks.push(marks);
    if (this.current === this.answer) this.status = 'won';
    else if (this.guesses.length >= MAX_GUESSES) this.status = 'lost';
    this.current = '';
    return marks;
  }

  /** Best known state of each letter, for the handshape chart. */
  letterStates(): Record<string, Mark> {
    const rank: Record<Mark, number> = { absent: 0, present: 1, correct: 2 };
    const out: Record<string, Mark> = {};
    this.guesses.forEach((guess, g) => {
      [...guess].forEach((letter, i) => {
        const mark = this.marks[g][i];
        if (out[letter] === undefined || rank[mark] > rank[out[letter]]) out[letter] = mark;
      });
    });
    return out;
  }
}

/**
 * Turns a stream of per-frame recognitions into deliberate letter entries.
 * A letter is entered only after it has been held steadily for `holdMs`. The
 * same letter cannot fire twice until the hand has changed shape, so resting
 * in a pose never types a run of letters.
 */
export class HoldDetector {
  holdMs = 900;
  /** A dropout shorter than this does not reset the hold. */
  graceMs = 150;
  /** How long the shape must be gone before the same letter can be entered again. */
  rearmMs = 250;

  candidate: string | null = null;
  progress = 0;
  /** True while a pointing shape left over from a button press is being ignored. */
  needsRelax = false;
  /** True while the shape being held has already been entered (awaiting a change). */
  entered = false;

  private heldMs = 0;
  private missingMs = 0;
  private locked: string | null = null;
  private awayMs = 0;
  private lockNeedsHand = false;

  reset(): void {
    this.candidate = null;
    this.progress = 0;
    this.heldMs = 0;
    this.missingMs = 0;
    this.locked = null;
    this.awayMs = 0;
    this.lockNeedsHand = false;
  }

  /**
   * Refuse these letters until a raised hand has visibly changed shape. Used
   * after a button press: the finger that poked the button is still pointing
   * (D when upright, G when sideways) as it comes back up, and must not type
   * a letter by itself.
   */
  lockLetters(letters: string): void {
    this.reset();
    this.locked = letters;
    this.lockNeedsHand = true;
  }

  /** @returns the letter entered on this frame, or null. */
  update(letter: string | null, dtMs: number, handRaised = true): string | null {
    this.needsRelax = false;
    this.entered = false;
    if (this.locked !== null) {
      // A hand that is down at the buttons tells us nothing: keep waiting.
      if (this.lockNeedsHand && !handRaised) return null;
      if (letter !== null && this.locked.includes(letter)) {
        this.awayMs = 0;
        this.needsRelax = this.lockNeedsHand;
        this.candidate = this.lockNeedsHand ? null : letter;
        this.progress = this.lockNeedsHand ? 0 : 1;
        this.entered = !this.lockNeedsHand;
        return null;
      }
      this.awayMs += dtMs;
      if (letter === null && this.awayMs < this.rearmMs) return null;
      this.locked = null;
      this.lockNeedsHand = false;
      this.candidate = null;
      this.heldMs = 0;
      this.progress = 0;
    }

    if (letter !== null && letter === this.candidate) {
      this.heldMs += dtMs;
      this.missingMs = 0;
    } else if (letter === null) {
      this.missingMs += dtMs;
      if (this.missingMs > this.graceMs) {
        this.candidate = null;
        this.heldMs = 0;
      }
    } else {
      this.candidate = letter;
      this.heldMs = 0;
      this.missingMs = 0;
    }

    this.progress = this.candidate ? Math.min(1, this.heldMs / this.holdMs) : 0;
    if (this.candidate && this.heldMs >= this.holdMs) {
      this.locked = this.candidate;
      this.awayMs = 0;
      return this.candidate;
    }
    return null;
  }
}
