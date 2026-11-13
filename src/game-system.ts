import {
  createSystem,
  Euler,
  Group,
  Object3D,
  Quaternion,
  RayInteractable,
  UIKitMLAsset,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { SUPPORTED_LETTERS } from './game/hand-model.js';
import { DUO_MAX_GUESSES, DuoRound, Mark, Round } from './game/logic.js';
import {
  HOLD_OPTIONS,
  MASTERY_COUNT,
  SaveData,
  currentStreak,
  lettersLearned,
  loadSave,
  recordDaily,
  storeSave,
} from './game/save.js';
import { MAX_GUESSES, WORD_LENGTH, dailyWord, dayNumber, randomWord } from './game/words.js';
import { HandFigure } from './hand-display.js';
import { LetterFx } from './letter-fx.js';
import { sign } from './sign-state.js';
import { sound } from './sound.js';

type Screen = 'home' | 'tutorial' | 'round' | 'result' | 'practice' | 'options';
type Element = {
  setProperties(props: Record<string, unknown>): void;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
};

interface Palette {
  correct: string;
  present: string;
  absent: string;
  onColor: string;
  hand: { correct: number; present: number; absent: number; unknown: number };
}
const NORMAL: Palette = {
  correct: '#2e9d5b',
  present: '#c9981a',
  absent: '#23262f',
  onColor: '#ffffff',
  hand: { correct: 0xffffff, present: 0xfff3d6, absent: 0x5a6070, unknown: 0xe8d9c5 },
};
/** Orange/blue pair that stays distinct for the common forms of colour blindness. */
const HIGH_CONTRAST: Palette = {
  correct: '#f5793a',
  present: '#85c0f9',
  absent: '#000000',
  onColor: '#000000',
  hand: { correct: 0x000000, present: 0x000000, absent: 0x555555, unknown: 0xffffff },
};

const TUTORIAL_WORD = 'YOU';
/** Shapes a finger makes while pressing a button. */
const POINTING_LETTERS = 'DG';
const LEFT_CHART = 'ABCDEFGHI';
const RIGHT_CHART = 'LORUVWXY';

/** Where everything sits relative to the player's head: x, y (from eye height), z. */
const LAYOUT = {
  board: { pos: [0, -0.12, -1.0], rot: [0, 0, 0] },
  chartLeft: { pos: [-0.44, -0.12, -0.95], rot: [0, 22, 0] },
  chartRight: { pos: [0.44, -0.12, -0.95], rot: [0, -22, 0] },
  controls: { pos: [0, -0.46, -0.38], rot: [-40, 0, 0] },
  focus: { pos: [0, -0.2, -0.92], rot: [0, 0, 0] },
} as const;

export class GameSystem extends createSystem({}) {
  private save!: SaveData;
  private screen: Screen = 'home';
  private round: Round | null = null;
  /** The two-board bonus game; null while a single-word round is showing. */
  private duo: DuoRound | null = null;
  private roundIsDaily = false;
  private day = 0;

  private board!: UIKitMLAsset;
  private controls!: UIKitMLAsset;
  private el = new Map<string, Element>();
  private actions: Array<(() => void) | null> = [null, null, null, null];
  private lastPress = 0;

  private focus = new HandFigure();
  private chartGroups = { left: new Group(), right: new Group() };
  private chartHands = new Map<string, HandFigure>();
  private placed = new Map<Object3D, { pos: readonly number[]; rot: readonly number[] }>();
  private rigPlaced = false;

  private tutorialStep = 0;
  private raisedFor = 0;
  private practiceTarget = 'L';
  private practiceRun = 0;

  private reveal: {
    row: number;
    marks: Mark[];
    duo: Array<Mark[] | null> | null;
    shown: number;
    timer: number;
  } | null = null;
  private msgTimer = 0;
  private clock = 0;
  private shown = { letter: '', status: '', fill: -1 };

  // Letter feedback: effects at the hand, and tiles that pop when a letter lands.
  private fx = new LetterFx();
  private pops = Array.from({ length: 16 }, () => ({ id: '', t: 0, wait: 0, size: 0, active: false }));
  private lastCandidate: string | null = null;
  private target = new Vector3();

  // scratch
  private head = new Vector3();
  private forward = new Vector3();
  private yawQ = new Quaternion();
  private localQ = new Quaternion();
  private euler = new Euler();
  private offset = new Vector3();
  private UP = new Vector3(0, 1, 0);

  init(): void {
    this.save = loadSave();
    this.day = dayNumber();
    sign.hold.holdMs = this.save.holdMs;

    this.board = this.world.requireSceneObject<UIKitMLAsset>('board');
    this.controls = this.world.requireSceneObject<UIKitMLAsset>('controls');
    const chartLeft = this.world.requireSceneObject<UIKitMLAsset>('chart-left');
    const chartRight = this.world.requireSceneObject<UIKitMLAsset>('chart-right');

    const grab = (panel: UIKitMLAsset, id: string) => {
      const element = panel.getElementById(id) as unknown as Element | undefined;
      if (element) this.el.set(id, element);
      else console.warn(`[fingerspell] missing UI element #${id}`);
    };
    for (const id of [
      'streak', 'view-grid', 'view-duo', 'view-info', 'info-title', 'info-1', 'info-2', 'info-3',
      'info-4', 'info-5', 'msg', 'sign-letter', 'sign-status', 'sign-fill',
    ]) grab(this.board, id);
    for (let r = 0; r < MAX_GUESSES; r++) {
      for (let c = 0; c < WORD_LENGTH; c++) {
        grab(this.board, `t-${r}-${c}`);
        grab(this.board, `tl-${r}-${c}`);
      }
    }
    for (let b = 0; b < 2; b++) {
      for (let r = 0; r < DUO_MAX_GUESSES; r++) {
        for (let c = 0; c < WORD_LENGTH; c++) {
          grab(this.board, `d${b}-${r}-${c}`);
          grab(this.board, `dl${b}-${r}-${c}`);
        }
      }
    }
    for (const letter of LEFT_CHART) grab(chartLeft, `k-${letter}`);
    for (const letter of RIGHT_CHART) grab(chartRight, `k-${letter}`);

    for (let i = 0; i < 4; i++) {
      grab(this.controls, `btn-${i}`);
      grab(this.controls, `btn-${i}-label`);
      const onClick = () => this.press(i);
      const button = this.el.get(`btn-${i}`);
      button?.addEventListener('click', onClick);
      this.cleanupFuncs.push(() => button?.removeEventListener('click', onClick));
    }

    // 3D reference hands: one per chart cell, plus a large one for lessons.
    this.buildChart(this.chartGroups.left, LEFT_CHART);
    this.buildChart(this.chartGroups.right, RIGHT_CHART);
    this.world.createTransformEntity(this.chartGroups.left);
    this.world.createTransformEntity(this.chartGroups.right);
    this.focus.scale.setScalar(1.05);
    this.focus.visible = false;
    this.world.createTransformEntity(this.focus);
    this.world.createTransformEntity(this.fx);

    this.placed.set(this.board, LAYOUT.board);
    this.placed.set(chartLeft, LAYOUT.chartLeft);
    this.placed.set(chartRight, LAYOUT.chartRight);
    this.placed.set(this.chartGroups.left, LAYOUT.chartLeft);
    this.placed.set(this.chartGroups.right, LAYOUT.chartRight);
    this.placed.set(this.controls, LAYOUT.controls);
    this.placed.set(this.focus, LAYOUT.focus);
    this.placeRig(this.head.set(0, 1.2, 0), 0);

    sign.onLetter = (letter, left) => this.onLetter(letter, left);

    // A mouse can click the buttons on the desktop page. In VR they are
    // touch-only, so a thumb-to-finger letter such as F or O can never be
    // mistaken for a pinch "click" on a far-away button.
    const controlsEntity = this.world.requireSceneEntity('controls');
    this.cleanupFuncs.push(
      this.world.visibilityState.subscribe((state) => {
        const flat = state === VisibilityState.NonImmersive;
        if (flat && !controlsEntity.hasComponent(RayInteractable)) {
          controlsEntity.addComponent(RayInteractable);
        } else if (!flat && controlsEntity.hasComponent(RayInteractable)) {
          controlsEntity.removeComponent(RayInteractable);
        }
        if (flat) {
          this.rigPlaced = false;
        } else if (!this.save.tutorialDone && this.screen === 'home') {
          this.startTutorial();
        }
      }),
    );

    if (import.meta.env.DEV) {
      // Dev server only: F9 wipes the saved progress and reloads, for a fresh run.
      const onReset = (e: KeyboardEvent) => {
        if (e.key !== 'F9') return;
        localStorage.removeItem('fingerspell.save.v1');
        location.reload();
      };
      window.addEventListener('keydown', onReset);
      this.cleanupFuncs.push(() => window.removeEventListener('keydown', onReset));
    }

    if (new URLSearchParams(location.search).has('keys')) {
      const onKey = (e: KeyboardEvent) => {
        if (e.key >= '1' && e.key <= '4') this.press(Number(e.key) - 1);
      };
      window.addEventListener('keydown', onKey);
      this.cleanupFuncs.push(() => window.removeEventListener('keydown', onKey));
    }

    this.applyPalette();
    this.setMirrored(this.save.leftHanded);
    this.showHome();
  }

  update(delta: number): void {
    this.clock += delta;
    const immersive = this.world.visibilityState.peek() !== VisibilityState.NonImmersive;

    // Put the game around the player once we know where their head is.
    if (immersive && !this.rigPlaced) {
      this.player.head.getWorldPosition(this.head);
      if (this.head.y > 0.4) {
        this.player.head.getWorldDirection(this.forward);
        // Object3D.getWorldDirection reports +Z; the player looks down -Z.
        const yaw = Math.atan2(-this.forward.x, -this.forward.z) + Math.PI;
        this.placeRig(this.head, yaw);
        this.rigPlaced = true;
      }
    }

    if (this.focus.visible) this.focus.rotation.y = Math.sin(this.clock * 0.9) * 0.7;

    if (this.msgTimer > 0) {
      this.msgTimer -= delta;
      if (this.msgTimer <= 0) this.text('msg', ' ');
    }

    if (this.reveal) this.stepReveal(delta);

    // A quiet tick the moment a shape is recognised, so the player knows it was seen.
    const candidate = sign.listening ? sign.candidate : null;
    if (candidate && candidate !== this.lastCandidate) sound.seen();
    this.lastCandidate = candidate;
    const holding = sign.listening && sign.handSeen && candidate !== null && !sign.hold.needsRelax && !sign.hold.entered;
    this.fx.step(delta, holding ? sign.handPos : null, this.player.head, sign.progress);
    this.stepPops(delta);

    if (this.screen === 'tutorial' && this.tutorialStep === 0) {
      this.raisedFor = sign.raised ? this.raisedFor + delta : 0;
      if (this.raisedFor > 0.6) this.advanceTutorial();
    }

    this.updateSignIndicator(immersive);
  }

  // ---------------------------------------------------------------- layout

  private buildChart(group: Group, letters: string): void {
    [...letters].forEach((letter, n) => {
      const hand = new HandFigure();
      hand.setLetter(letter);
      // G and H lie sideways, so they are drawn a little smaller to stay in their cell.
      hand.scale.setScalar(letter === 'G' || letter === 'H' ? 0.27 : 0.34);
      hand.rotation.y = 0.45;
      const col = n % 3;
      const row = Math.floor(n / 3);
      hand.position.set((col - 1) * 0.11, (1 - row) * 0.14 + 0.012, 0.028);
      group.add(hand);
      this.chartHands.set(letter, hand);
    });
  }

  private placeRig(head: Vector3, yaw: number): void {
    this.yawQ.setFromAxisAngle(this.UP, yaw);
    const d = Math.PI / 180;
    for (const [object, spot] of this.placed) {
      this.offset.set(spot.pos[0], 0, spot.pos[2]).applyQuaternion(this.yawQ);
      object.position.set(head.x + this.offset.x, head.y + spot.pos[1], head.z + this.offset.z);
      this.localQ.setFromEuler(this.euler.set(spot.rot[0] * d, spot.rot[1] * d, spot.rot[2] * d, 'YXZ'));
      object.quaternion.copy(this.yawQ).multiply(this.localQ);
    }
    this.offset
      .set(LAYOUT.controls.pos[0], 0, LAYOUT.controls.pos[2])
      .applyQuaternion(this.yawQ);
    sign.controlsCenter.set(
      head.x + this.offset.x,
      head.y + LAYOUT.controls.pos[1],
      head.z + this.offset.z,
    );
  }

  // ------------------------------------------------------------ UI helpers

  private text(id: string, value: string): void {
    this.el.get(id)?.setProperties({ text: value.trim() });
  }

  private say(message: string, seconds = 3): void {
    this.text('msg', message);
    this.msgTimer = seconds;
  }

  private info(title: string, lines: string[] = [], small: string[] = []): void {
    this.text('info-title', title);
    for (let i = 0; i < 3; i++) this.text(`info-${i + 1}`, lines[i] ?? ' ');
    this.text('info-4', small[0] ?? ' ');
    this.text('info-5', small[1] ?? ' ');
  }

  private view(grid: boolean): void {
    const duo = grid && this.duo !== null;
    this.el.get('view-grid')?.setProperties({ display: grid && !duo ? 'flex' : 'none' });
    this.el.get('view-duo')?.setProperties({ display: duo ? 'flex' : 'none' });
    this.el.get('view-info')?.setProperties({ display: grid ? 'none' : 'flex' });
  }

  private buttons(defs: Array<[string, () => void] | null>): void {
    for (let i = 0; i < 4; i++) {
      const def = defs[i] ?? null;
      this.actions[i] = def ? def[1] : null;
      this.text(`btn-${i}-label`, def ? def[0] : ' ');
      this.el.get(`btn-${i}`)?.setProperties({
        backgroundColor: def ? '#262b38' : '#15171d',
        borderColor: def ? '#8a93a8' : '#262b38',
      });
    }
  }

  private press(index: number): void {
    const now = performance.now();
    if (now - this.lastPress < 350) return;
    const action = this.actions[index];
    if (!action) return;
    this.lastPress = now;
    if (import.meta.env.DEV) console.log(`[fingerspell] button ${index}`);
    sound.press();
    action();
    // The pressing finger is still pointing: D if upright, G if sideways.
    sign.hold.lockLetters(POINTING_LETTERS);
  }

  private palette(): Palette {
    return this.save.highContrast ? HIGH_CONTRAST : NORMAL;
  }

  /** World position of the centre of a board tile (sizes match scripts/gen-ui.mjs). */
  private tileWorld(row: number, col: number, out: Vector3): Vector3 {
    out
      .set((col - (WORD_LENGTH - 1) / 2) * 0.079, 0.35 - (0.112 + row * 0.079), 0.012)
      .applyQuaternion(this.board.quaternion)
      .add(this.board.position);
    return out;
  }

  /** The same for a tile on one of the two small boards. */
  private duoTileWorld(board: number, row: number, col: number, out: Vector3): Vector3 {
    out
      .set((board === 0 ? -0.112 : 0.112) + (col - (WORD_LENGTH - 1) / 2) * 0.042, 0.35 - (0.1265 + row * 0.061), 0.012)
      .applyQuaternion(this.board.quaternion)
      .add(this.board.position);
    return out;
  }

  /** Make a tile swell and settle. `wait` staggers a row of them. */
  private pop(id: string, size: number, wait = 0): void {
    const slot = this.pops.find((q) => q.active && q.id === id) ?? this.pops.find((q) => !q.active);
    if (!slot) return;
    slot.id = id;
    slot.size = size;
    slot.wait = wait;
    slot.t = 0;
    slot.active = true;
  }

  private stepPops(delta: number): void {
    for (const q of this.pops) {
      if (!q.active) continue;
      if (q.wait > 0) {
        q.wait -= delta;
        continue;
      }
      q.t += delta / 0.28;
      const done = q.t >= 1;
      // Quick swell, then an eased settle back to rest.
      const k = done ? 0 : Math.sin(Math.min(1, q.t) * Math.PI) * (1 - q.t * 0.5);
      const scale = 1 + q.size * k;
      this.el.get(q.id)?.setProperties({ transformScaleX: scale, transformScaleY: scale });
      if (done) q.active = false;
    }
  }

  private clearPops(): void {
    for (const q of this.pops) {
      if (!q.active) continue;
      q.active = false;
      this.el.get(q.id)?.setProperties({ transformScaleX: 1, transformScaleY: 1 });
    }
  }

  private paintTile(row: number, col: number, letter: string, mark: Mark | null): void {
    this.paintCell(`t-${row}-${col}`, `tl-${row}-${col}`, letter, mark);
  }

  private paintDuoTile(board: number, row: number, col: number, letter: string, mark: Mark | null): void {
    this.paintCell(`d${board}-${row}-${col}`, `dl${board}-${row}-${col}`, letter, mark);
  }

  private paintDuo(): void {
    const duo = this.duo;
    if (!duo) return;
    for (let b = 0; b < 2; b++) {
      for (let r = 0; r < DUO_MAX_GUESSES; r++) {
        const marks = r < duo.guesses.length ? duo.marks[b][r] : null;
        const typing = r === duo.guesses.length && duo.status === 'playing' && duo.solvedAt[b] < 0;
        for (let c = 0; c < WORD_LENGTH; c++) {
          if (marks) this.paintDuoTile(b, r, c, duo.guesses[r][c], marks[c]);
          else this.paintDuoTile(b, r, c, typing ? (duo.current[c] ?? '') : '', null);
        }
      }
    }
  }

  private paintCell(tileId: string, labelId: string, letter: string, mark: Mark | null): void {
    const p = this.palette();
    this.text(labelId, letter || ' ');
    const tile = this.el.get(tileId);
    const label = this.el.get(labelId);
    if (mark === null) {
      tile?.setProperties({
        backgroundColor: '#181b23',
        borderColor: letter ? '#aab2c5' : '#3a4050',
      });
      label?.setProperties({ color: '#f4f5f7' });
    } else {
      // Correct tiles also get a white outline, so the result never relies on colour alone.
      tile?.setProperties({
        backgroundColor: p[mark],
        borderColor: mark === 'correct' ? '#ffffff' : p[mark],
      });
      label?.setProperties({ color: mark === 'absent' ? '#8f96a6' : p.onColor });
    }
  }

  private paintChart(): void {
    const p = this.palette();
    const game = this.duo ?? this.round;
    const states = game && (this.screen === 'round' || this.screen === 'result') ? game.letterStates() : {};
    for (const letter of SUPPORTED_LETTERS) {
      const mark = states[letter] as Mark | undefined;
      const lesson =
        (this.screen === 'practice' && letter === this.practiceTarget) ||
        (this.screen === 'tutorial' && letter === TUTORIAL_WORD[this.tutorialStep - 1]);
      this.el.get(`k-${letter}`)?.setProperties({
        backgroundColor: mark ? p[mark] : '#181b23',
        borderColor: lesson || mark === 'correct' ? '#ffffff' : mark ? p[mark] : '#3a4050',
      });
      this.chartHands.get(letter)?.material.color.setHex(p.hand[mark ?? 'unknown']);
    }
  }

  private paintGrid(): void {
    const round = this.round;
    for (let r = 0; r < MAX_GUESSES; r++) {
      for (let c = 0; c < WORD_LENGTH; c++) {
        if (round && r < round.guesses.length) {
          this.paintTile(r, c, round.guesses[r][c], round.marks[r][c]);
        } else if (round && r === round.guesses.length && round.status === 'playing') {
          this.paintTile(r, c, round.current[c] ?? '', null);
        } else {
          this.paintTile(r, c, '', null);
        }
      }
    }
  }

  private applyPalette(): void {
    this.focus.material.color.setHex(this.palette().hand.unknown);
    this.fx.setColor(this.save.highContrast ? 0xffffff : 0xf5c542);
    this.paintGrid();
    this.paintDuo();
    this.paintChart();
  }

  private setMirrored(left: boolean): void {
    this.focus.setMirrored(left);
    for (const hand of this.chartHands.values()) hand.setMirrored(left);
  }

  private updateStreak(): void {
    this.text('streak', `Streak ${currentStreak(this.save, this.day)}`);
  }

  private updateSignIndicator(immersive: boolean): void {
    let status: string;
    if (!immersive) status = 'Enter VR to play';
    else if (!sign.tracked) status = 'Show your hands to the headset';
    else if (!sign.listening) status = 'Touch a button on the bar below';
    else if (!sign.raised) status = 'Raise a hand to sign';
    else if (sign.hold.needsRelax) status = 'Relax your hand, then sign';
    else if (sign.candidate) status = sign.progress >= 1 ? 'Got it' : 'Hold still...';
    else status = 'Make a letter shape';

    const letter = sign.listening ? (sign.candidate ?? ' ') : ' ';
    const fill = sign.listening ? Math.round(sign.progress * 20) : 0;
    if (status !== this.shown.status) {
      this.shown.status = status;
      this.text('sign-status', status);
    }
    if (letter !== this.shown.letter) {
      this.shown.letter = letter;
      this.text('sign-letter', letter);
    }
    if (fill !== this.shown.fill) {
      this.shown.fill = fill;
      this.el.get('sign-fill')?.setProperties({ width: Math.max(0.1, (fill / 20) * 32) });
    }
  }

  // ---------------------------------------------------------------- screens

  private enter(screen: Screen, listening: boolean): void {
    if (import.meta.env.DEV) console.log(`[fingerspell] screen ${screen}`);
    this.screen = screen;
    sign.listening = listening;
    sign.hold.reset();
    this.fx.finish();
    this.clearPops();
    this.reveal = null;
    this.focus.visible = false;
    this.text('msg', ' ');
    this.msgTimer = 0;
    this.updateStreak();
  }

  private showHome(): void {
    this.enter('home', false);
    this.view(false);
    const today = this.save.today?.day === this.day ? this.save.today : null;
    const status = !today
      ? "Today's word is waiting."
      : !today.finished
        ? `Today: ${today.guesses.length} of ${MAX_GUESSES} guesses used.`
        : this.save.lastWinDay === this.day
          ? `Solved today in ${today.guesses.length}. New word tomorrow.`
          : 'Missed today. New word tomorrow.';
    this.info(
      'Spell the daily word',
      [
        'Sign each letter with your hand.',
        status,
        `Letters learned: ${lettersLearned(this.save)} of ${SUPPORTED_LETTERS.length}`,
      ],
      [
        'Uses ASL fingerspelling handshapes for 17 letters.',
        'A game, not a lesson. Not reviewed by Deaf signers.',
      ],
    );
    this.buttons([
      ['Daily word', () => this.startDaily()],
      ['Practice', () => this.startPractice()],
      ['How to play', () => this.startTutorial()],
      ['Options', () => this.showOptions()],
    ]);
    this.paintChart();
  }

  private showOptions(): void {
    this.enter('options', false);
    this.view(false);
    this.info(
      'Options',
      [
        'Hold time: how long to hold a shape.',
        'Contrast: orange and blue tiles.',
        'Hand: which hand the pictures show.',
      ],
      ['The game reads either hand at any time.', 'Progress is saved on this headset only.'],
    );
    const next = () => this.showOptions();
    this.buttons([
      [`Hold ${(this.save.holdMs / 1000).toFixed(1)}s`, () => {
        const i = HOLD_OPTIONS.indexOf(this.save.holdMs);
        this.save.holdMs = HOLD_OPTIONS[(i + 1) % HOLD_OPTIONS.length];
        sign.hold.holdMs = this.save.holdMs;
        storeSave(this.save);
        next();
      }],
      [`Contrast ${this.save.highContrast ? 'on' : 'off'}`, () => {
        this.save.highContrast = !this.save.highContrast;
        storeSave(this.save);
        this.applyPalette();
        next();
      }],
      [`Hand: ${this.save.leftHanded ? 'left' : 'right'}`, () => {
        this.save.leftHanded = !this.save.leftHanded;
        storeSave(this.save);
        this.setMirrored(this.save.leftHanded);
        next();
      }],
      ['Back', () => this.showHome()],
    ]);
  }

  // --------------------------------------------------------------- tutorial

  private startTutorial(): void {
    this.enter('tutorial', false);
    this.view(false);
    this.tutorialStep = 0;
    this.raisedFor = 0;
    this.info('Hold up one hand', ['Raise it in front of you,', 'palm facing away from you.']);
    this.buttons([['Skip', () => this.finishTutorial(false)], null, null, null]);
    this.paintChart();
  }

  private advanceTutorial(): void {
    this.tutorialStep++;
    sound.step();
    if (this.tutorialStep > TUTORIAL_WORD.length) {
      this.finishTutorial(true);
      return;
    }
    const letter = TUTORIAL_WORD[this.tutorialStep - 1];
    sign.listening = true;
    // The hand may have just pressed "How to play" and still be pointing.
    if (this.tutorialStep === 1) sign.hold.lockLetters(POINTING_LETTERS);
    else sign.hold.reset();
    const done = TUTORIAL_WORD.slice(0, this.tutorialStep - 1);
    this.info(`Copy this shape: ${letter}`, [
      'Hold still until the bar fills.',
      `${done}${'_'.repeat(TUTORIAL_WORD.length - done.length)}`.split('').join(' '),
    ]);
    this.focus.setLetter(letter);
    this.focus.visible = true;
    this.paintChart();
  }

  private finishTutorial(completed: boolean): void {
    this.save.tutorialDone = true;
    storeSave(this.save);
    if (!completed) {
      this.showHome();
      return;
    }
    this.enter('tutorial', false);
    this.tutorialStep = TUTORIAL_WORD.length + 1;
    sound.success();
    this.info(
      `You spelled ${TUTORIAL_WORD}`,
      ['That is the whole game.', 'Guess the five-letter word in six tries.', 'Touch DAILY WORD on the bar below.'],
      ['The pictures at the sides show every shape.', 'Buttons are pressed with a fingertip.'],
    );
    this.buttons([
      ['Daily word', () => this.startDaily()],
      ['Practice', () => this.startPractice()],
      null,
      ['Home', () => this.showHome()],
    ]);
    this.paintChart();
  }

  // ------------------------------------------------------------------ round

  private startDaily(): void {
    this.day = dayNumber();
    const today = this.save.today?.day === this.day ? this.save.today : null;
    this.duo = null;
    this.round = new Round(dailyWord(this.day), today ? { guesses: today.guesses } : undefined);
    this.roundIsDaily = true;
    if (this.round.status === 'playing') this.showRound();
    else this.showResult(true);
  }

  /** The bonus game: two random words, every guess played on both boards. */
  private startDuo(): void {
    const first = randomWord(dailyWord(this.day));
    let second = randomWord(first);
    while (second === dailyWord(this.day)) second = randomWord(first);
    this.round = null;
    this.duo = new DuoRound([first, second]);
    if (import.meta.env.DEV) console.log(`[fingerspell] two boards ${first} ${second}`);
    this.roundIsDaily = false;
    this.showRound();
  }

  private showRound(): void {
    this.enter('round', true);
    this.view(true);
    this.paintGrid();
    this.paintDuo();
    this.paintChart();
    this.buttons([
      ['Undo', () => this.undo()],
      ['Submit', () => this.submit()],
      null,
      ['Home', () => this.showHome()],
    ]);
    this.say(this.duo ? 'Each guess plays on both boards. 7 tries.' : "Sign a letter to start today's word", 6);
  }

  private undo(): void {
    if (this.reveal) return;
    this.fx.finish();
    const duo = this.duo;
    if (duo) {
      if (!duo.undo()) return;
      sound.undo();
      for (let b = 0; b < 2; b++) {
        if (duo.solvedAt[b] < 0) this.paintDuoTile(b, duo.guesses.length, duo.current.length, '', null);
      }
      return;
    }
    if (!this.round?.undo()) return;
    sound.undo();
    this.paintTile(this.round.guesses.length, this.round.current.length, '', null);
  }

  private submit(): void {
    if (this.reveal) return;
    const duo = this.duo;
    if (duo) {
      this.fx.finish();
      if (!duo.canSubmit()) {
        sound.reject();
        this.say(`Sign ${WORD_LENGTH - duo.current.length} more letters first`);
        return;
      }
      const row = duo.guesses.length;
      const result = duo.submit();
      if (!result) return;
      sign.listening = false;
      this.reveal = { row, marks: [], duo: result, shown: 0, timer: 0 };
      return;
    }
    const round = this.round;
    if (!round) return;
    this.fx.finish();
    if (!round.canSubmit()) {
      sound.reject();
      this.say(`Sign ${WORD_LENGTH - round.current.length} more letters first`);
      return;
    }
    const row = round.guesses.length;
    const marks = round.submit();
    if (!marks) return;
    sign.listening = false;
    this.reveal = { row, marks, duo: null, shown: 0, timer: 0 };
    if (this.roundIsDaily) {
      this.save.today = {
        day: this.day,
        guesses: [...round.guesses],
        finished: round.status !== 'playing',
      };
      if (round.status !== 'playing') recordDaily(this.save, this.day, round.status === 'won');
      storeSave(this.save);
    }
  }

  private stepReveal(delta: number): void {
    const reveal = this.reveal;
    if (!reveal) return;
    reveal.timer -= delta;
    if (reveal.timer > 0) return;
    const duo = this.duo;
    if (duo && reveal.duo) {
      if (reveal.shown < WORD_LENGTH) {
        const c = reveal.shown++;
        let good = false;
        for (let b = 0; b < 2; b++) {
          const marks = reveal.duo[b];
          if (!marks) continue;
          this.paintDuoTile(b, reveal.row, c, duo.guesses[reveal.row][c], marks[c]);
          this.pop(`d${b}-${reveal.row}-${c}`, marks[c] === 'absent' ? 0.06 : 0.16);
          good ||= marks[c] !== 'absent';
        }
        sound.reveal(c, good);
        reveal.timer = 0.16;
        return;
      }
      this.reveal = null;
      this.paintChart();
      if (duo.status === 'playing') {
        const solved = reveal.duo.findIndex((marks) => marks?.every((mark) => mark === 'correct'));
        if (solved >= 0) {
          sound.step();
          this.say(`${solved === 0 ? 'Left' : 'Right'} board solved. One to go.`, 5);
        }
        sign.listening = true;
        sign.hold.lockLetters(POINTING_LETTERS);
      } else {
        this.showResult(false);
      }
      return;
    }
    const round = this.round;
    if (!round) return;
    if (reveal.shown < WORD_LENGTH) {
      const c = reveal.shown++;
      this.paintTile(reveal.row, c, round.guesses[reveal.row][c], reveal.marks[c]);
      sound.reveal(c, reveal.marks[c] !== 'absent');
      this.pop(`t-${reveal.row}-${c}`, reveal.marks[c] === 'absent' ? 0.06 : 0.14);
      reveal.timer = 0.16;
      return;
    }
    this.reveal = null;
    this.paintChart();
    if (round.status === 'playing') {
      sign.listening = true;
      sign.hold.lockLetters(POINTING_LETTERS);
    } else {
      this.showResult(false);
    }
  }

  private showResult(revisit: boolean): void {
    const duo = this.duo;
    if (duo) {
      this.enter('result', false);
      this.view(true);
      this.paintDuo();
      this.paintChart();
      const won = duo.status === 'won';
      (won ? sound.success : sound.fail)();
      if (won) {
        for (let b = 0; b < 2; b++) {
          for (let c = 0; c < WORD_LENGTH; c++) this.pop(`d${b}-${duo.solvedAt[b]}-${c}`, 0.22, 0.25 + c * 0.09);
        }
      }
      this.say(
        won ? `Both solved in ${duo.guesses.length}.` : `The words were ${duo.answers[0]} and ${duo.answers[1]}.`,
        3600,
      );
      this.buttons([
        ['Two boards', () => this.startDuo()],
        ['Practice', () => this.startPractice()],
        null,
        ['Home', () => this.showHome()],
      ]);
      return;
    }
    const round = this.round;
    if (!round) return;
    this.enter('result', false);
    this.view(true);
    this.paintGrid();
    this.paintChart();
    const won = round.status === 'won';
    if (!revisit) (won ? sound.success : sound.fail)();
    // A little wave along the winning row.
    if (won && !revisit) {
      for (let c = 0; c < WORD_LENGTH; c++) this.pop(`t-${round.guesses.length - 1}-${c}`, 0.2, 0.25 + c * 0.09);
    }
    const streak = currentStreak(this.save, this.day);
    const message = won
      ? this.roundIsDaily
        ? `Solved in ${round.guesses.length}. Streak ${streak}.`
        : `Solved in ${round.guesses.length}.`
      : `The word was ${round.answer}.`;
    this.say(message, 3600);
    this.buttons([
      ['Two boards', () => this.startDuo()],
      ['Practice', () => this.startPractice()],
      null,
      ['Home', () => this.showHome()],
    ]);
  }

  // --------------------------------------------------------------- practice

  private startPractice(): void {
    this.enter('practice', true);
    this.view(false);
    this.practiceRun = 0;
    this.nextPracticeLetter();
    this.buttons([['Skip letter', () => this.nextPracticeLetter()], null, null, ['Home', () => this.showHome()]]);
  }

  private nextPracticeLetter(): void {
    // Favour the letters signed least often so far.
    const pool = SUPPORTED_LETTERS.filter((l) => l !== this.practiceTarget).sort(
      (a, b) => (this.save.practice[a] ?? 0) - (this.save.practice[b] ?? 0),
    );
    this.practiceTarget = pool[Math.floor(Math.random() * Math.min(4, pool.length))];
    sign.hold.reset();
    const count = this.save.practice[this.practiceTarget] ?? 0;
    this.info(`Copy this shape: ${this.practiceTarget}`, [
      'Hold still until the bar fills.',
      count >= MASTERY_COUNT ? 'Learned' : `Signed ${count} of ${MASTERY_COUNT} times`,
      `Letters learned: ${lettersLearned(this.save)} of ${SUPPORTED_LETTERS.length}`,
    ]);
    this.focus.setLetter(this.practiceTarget);
    this.focus.visible = true;
    this.paintChart();
  }

  // ------------------------------------------------------------ letter input

  private onLetter(letter: string, left: boolean): void {
    if (import.meta.env.DEV) console.log(`[fingerspell] letter ${letter} (${left ? 'left' : 'right'} hand)`);
    if (left !== this.save.leftHanded && this.world.session) {
      // Show the pictures for whichever hand the player actually uses.
      this.save.leftHanded = left;
      this.setMirrored(left);
      storeSave(this.save);
    }

    const duo = this.duo;
    if (this.screen === 'round' && duo && !this.reveal) {
      const col = duo.current.length;
      const row = duo.guesses.length;
      if (!duo.addLetter(letter)) {
        sound.reject();
        this.say('Row is full. Touch SUBMIT or UNDO.');
        return;
      }
      sound.letter();
      // One sign lands on every board still in play.
      const land = () => {
        if (this.screen !== 'round' || this.duo !== duo) return;
        if (duo.guesses.length !== row || duo.current[col] !== letter) return;
        for (let b = 0; b < 2; b++) {
          if (duo.solvedAt[b] >= 0) continue;
          this.paintDuoTile(b, row, col, letter, null);
          this.pop(`d${b}-${row}-${col}`, 0.24);
        }
      };
      const first = duo.solvedAt[0] < 0 ? 0 : 1;
      if (sign.handSeen) this.fx.accept(sign.handPos, this.duoTileWorld(first, row, col, this.target), land);
      else land();
      if (duo.current.length === WORD_LENGTH) this.say('Touch SUBMIT on the bar below', 6);
      else if (col === 0) this.text('msg', ' ');
    } else if (this.screen === 'round' && this.round && !this.reveal) {
      const col = this.round.current.length;
      if (!this.round.addLetter(letter)) {
        sound.reject();
        this.say('Row is full. Touch SUBMIT or UNDO.');
        return;
      }
      sound.letter();
      // The letter flies from the hand and lands on its tile.
      const row = this.round.guesses.length;
      const land = () => {
        if (this.screen !== 'round' || !this.round || this.round.guesses.length !== row) return;
        if (this.round.current[col] !== letter) return;
        this.paintTile(row, col, letter, null);
        this.pop(`t-${row}-${col}`, 0.2);
      };
      if (sign.handSeen) this.fx.accept(sign.handPos, this.tileWorld(row, col, this.target), land);
      else land();
      if (this.round.current.length === WORD_LENGTH) this.say('Touch SUBMIT on the bar below', 6);
      else if (col === 0) this.text('msg', ' ');
    } else if (this.screen === 'practice') {
      if (letter !== this.practiceTarget) {
        this.say(`That looked like ${letter}. Check the picture.`);
        return;
      }
      this.save.practice[letter] = (this.save.practice[letter] ?? 0) + 1;
      storeSave(this.save);
      this.practiceRun++;
      if (sign.handSeen) this.fx.accept(sign.handPos, this.focus.position, () => {});
      sound.step();
      this.nextPracticeLetter();
      this.say(`Nice ${letter}. ${this.practiceRun} in a row.`);
    } else if (this.screen === 'tutorial' && this.tutorialStep >= 1) {
      if (letter !== TUTORIAL_WORD[this.tutorialStep - 1]) {
        this.say(`That looked like ${letter}. Check the picture.`);
        return;
      }
      this.advanceTutorial();
      if (sign.handSeen) this.fx.accept(sign.handPos, this.focus.position, () => {});
    }
  }
}
