# Fingerspell

A daily word game for Meta Quest that you play by signing. Each day there is one
five-letter word. You spell your guesses letter by letter with ASL
fingerspelling handshapes, the headset reads your hand, and each letter is
marked right place / wrong place / not in the word. Six tries, a daily streak,
about five minutes, sitting down, no controllers.

Built with Meta's Immersive Web SDK (WebXR), so it runs in the Quest browser
from a link.

> **What this is not.** It is a game that uses fingerspelling handshapes. It is
> not a sign-language course or a certified teaching tool, the handshape
> pictures are hand-authored approximations, and neither the pictures nor the
> recogniser have been reviewed by Deaf signers. Fingerspelling is one small
> part of ASL.

## Supported letters

**17 letters: A B C D E F G H I L O R U V W X Y**

| Not supported | Why |
| --- | --- |
| J, Z | They are movements, not static shapes. |
| M, N, S, T | Fists that differ only by where the thumb is tucked. Headset hand tracking cannot tell them apart reliably. A fist with the thumb across the front is read as **E** (so an S will also read as E). |
| K, P, Q | K hides the thumb between two fingers; P and Q point the hand at the floor, where tracking is weakest. |

Every answer word uses only the 17 supported letters (a test enforces this).
Guesses do not have to be dictionary words: any five supported letters count.

Known soft spots, to check on a real headset first: **R** (crossed fingers),
**E** versus **A** (thumb position on a fist), and **G / H** (they are read by
the hand pointing sideways).

## How to play

1. Open the link in the Quest browser, put the controllers down, press **Enter VR**.
2. First run: a three-shape tutorial (you spell YOU). Under a minute.
3. Raise a hand, copy a handshape from the charts at the sides, and hold still
   until the bar fills. That enters the letter. Relax your hand between
   double letters, and after touching a button (a pointing finger is the
   shape for D, so it is ignored until your hand changes shape).
4. Touch **Submit** on the bar in front of you with a fingertip. **Undo**
   removes a letter.
5. After the daily word, **Two boards** is a bonus game: two hidden words,
   every guess is played on both, and you have seven tries to solve both.
   A solved board stops taking guesses.
6. **Practice** shows one shape at a time and tracks which letters you have
   learned. **Options** changes the hold time (0.6 to 1.8 s), a colour-blind
   friendly palette, and which hand the pictures show.

Either hand works at any time; the pictures flip to match the hand you use.
Progress is stored in the browser on the headset (localStorage) and nowhere else.

## Run it

Needs Node 20.19+ (22 or 24 are fine).

```bash
npm install
npm run dev        # dev server + browser with the WebXR emulator (IWER)
npm test           # unit tests: recogniser, game rules, hold-to-confirm, streak
npm run typecheck
npm run build      # static site in dist/
```

`npm run dev` opens a Chromium window that pretends to be a Quest 3. Press
**Enter XR** there, switch the emulator to hands, and pose the hand from the
emulator panel.

### Driving the simulator from the command line

With `npm run dev` (or `npx @iwsdk/cli dev up`) running:

```bash
./scripts/enter.sh                 # enter VR with hand tracking
./scripts/press.sh 0               # poke button 0 on the bar (0-3, left to right)
node scripts/sign.mjs CLOUD        # sign a word with the emulated right hand
./scripts/shot.sh artifacts/a.png  # screenshot
./scripts/logs.sh                  # game events and console errors
```

The emulator has ready-made poses for 16 of the 17 letters (all but R), so a
whole round can be played and recorded without a headset.

Desktop-only developer aid: add `?keys` to the URL and letter keys enter
letters, `1`-`4` press the bar buttons. It is off unless you add that flag.

## Put it on a headset

The build is a plain static site with relative paths, so any HTTPS host works.

**GitHub Pages** (workflow included at `.github/workflows/deploy.yml`):

1. Create a GitHub repo and push this folder to `main`.
2. In the repo: Settings -> Pages -> Source: **GitHub Actions**.
3. The workflow tests, builds and publishes. The game is then at
   `https://<user>.github.io/<repo>/`.

**Vercel**: `npm run build`, then `npx vercel deploy --prod` and use the
`https://<project>.vercel.app` address.

**Same Wi-Fi, no hosting**: `npm run dev`, then on the Quest open one of the
`https://192.168...:8081/` addresses it prints and accept the certificate warning.

### What to check on the Quest

Sit down, controllers out of reach.

1. **Tutorial**: does it start by itself, and do Y, O and U register within a
   couple of seconds each?
2. **Every letter**: open Practice and go through all 17. Note any that will
   not register or that read as a different letter (the message line says
   "That looked like ..."). R, E, A, G and H are the ones to watch.
3. **Accidental letters**: rest your hands in your lap, scratch your face,
   reach for the bar. Nothing should be typed. After pressing a button, keep
   pointing: it must not type a D.
4. **Buttons**: is the bar comfortable to reach from a chair, and does one
   touch equal one press?
5. **Comfort**: is all the text readable, and is everything inside your view
   without turning your head much?
6. **Left hand**: sign with the left hand; the pictures should flip.
7. **Full round**: play today's word to the end; check the streak and that
   reloading the page keeps today's guesses.
8. **Smoothness**: it should feel fluid (the competition asks for 60 fps or more).

If a letter misbehaves, the thresholds are plain numbers in
`src/game/recognizer.ts`, one line per letter.

## How hands are read

- `src/hands-system.ts` reads the 25 WebXR hand joints per hand each frame
  (`XRFrame.fillPoses`), for whichever hands are raised (wrist no more than
  40 cm below eye level) and not down at the button bar.
- `src/game/recognizer.ts` turns the joints into a few measurements in the
  hand's own frame: how bent each finger is, where the thumb tip sits, which
  fingertips touch, the gap between index and middle fingertips, and which way
  the hand points. Each letter is a short rule over those measurements, scored
  0 to 1. The best letter is reported only if it is confident and clearly
  ahead of the runner-up. Left hands are mirrored so one rule set covers both.
  No machine learning, no camera images, nothing leaves the headset.
- `HoldDetector` in `src/game/logic.ts` enters a letter only after it has been
  held for the hold time, ignores one-frame flickers and short tracking
  dropouts, will not repeat a letter until the hand changes shape, and ignores
  the pointing finger that has just pressed a button.
- Buttons are IWSDK `PokeInteractable` panels: pressed by touching them. In VR
  they do not respond to far pinches, so the thumb-to-finger letters (F, O, D)
  can never click something by accident.

### How it was tested, and what has not been

- 100 unit tests (`npm test`). The recogniser is checked against (a) the
  synthetic reference hand in `src/game/hand-model.ts`, with noise and tilt,
  and (b) joint data captured from the WebXR emulator's built-in hand poses,
  which were not made for this game.
- A full round, practice, options, undo, the win and loss screens and both
  hands were played in the emulator through the real WebXR hand-joint path.
- **Not yet tested on a physical Quest.** Emulator hands are clean; real
  tracking is noisier and real hands vary. Expect to tune thresholds after the
  first headset session. R has no emulator pose and is covered only by the
  synthetic hand.

### Performance

Measured in the desktop simulator (an Apple M1, so not Quest numbers): the
renderer reports 110 draw calls and about 118,000 triangles per frame (both
eyes together), no dropped frames, and the game's
own systems take under a tenth of each frame's script time. Nothing is
allocated per frame in the game's systems. **Frame rate on a real Quest has not
been measured yet.** Under `npm run dev`, F8 logs the renderer's draw calls
and triangles for the last frame.

## Project layout

```
src/game/            pure TypeScript, no rendering: recogniser, hand model, rules, words, save
src/hands-system.ts  reads hand joints, runs the recogniser and hold-to-confirm
src/game-system.ts   screens, board, buttons, tutorial, practice, placement around the player
src/hand-display.ts  the 3D reference hands
src/letter-fx.ts     hold ring, letter flight and spark at the hand
src/ambience.ts      halo behind the board, drifting motes, win confetti
src/sound.ts         synthesised sound effects (no audio files)
public/ui/           UIKitML panels, generated by scripts/gen-ui.mjs
public/scenes/       scene composition
tests/               unit tests and captured emulator poses
scripts/             simulator helpers and tuning tables
SUBMISSION.md        draft Devpost text
```

## Credits

Immersive Web SDK, three.js and pmndrs/uikit (MIT). The floor and stage
geometry come from the IWSDK starter template. Word list, handshape model,
recogniser and game code were written for this project.
