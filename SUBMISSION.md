# Fingerspell: draft Devpost submission

Draft only. Nothing has been submitted. Items marked **TODO** need you.

## Fields

| Field | Value |
| --- | --- |
| Name | Fingerspell |
| Tagline (140 max) | A daily word puzzle you solve by signing. Spell each guess with your bare hands in ASL fingerspelling. Seated, no controllers. |
| Track | Gaming |
| Division | New Experience (started 12 November 2026, inside the competition window; no earlier code or builds) |
| Built with | Immersive Web SDK (WebXR), TypeScript, three.js, UIKitML |
| Link for judges | https://jburgoyn.github.io/fingerspell/ (source: https://github.com/jburgoyn/fingerspell) |
| Video (under 3 minutes, public on YouTube or Vimeo) | **TODO** |
| Target launch date | **TODO** (the rules ask for one if the app is not already on the store) |
| Special awards to mention | Best First Five Minutes, Best Reason to Come Back, Best Accessibility Forward Experience, Boldest Original Concept |

## Description (Devpost's standard headings; limit 500 words)

### Inspiration

Daily word games are a habit millions of people already have, and they are
played on a keyboard. In a headset with hand tracking, the keyboard can be
your hand. Fingerspelling is an existing way of spelling with one hand,
so the input is not an invented gesture set: it is something worth knowing
after the headset comes off.

### What it does

Fingerspell is a daily word game you play by signing. Every day there is one
five-letter word. You spell each guess one letter at a time with ASL
fingerspelling handshapes: make the shape, hold it while a bar fills, and the
letter drops onto the board. Each guess is marked right place, wrong place or
not in the word. Six tries, a daily streak, about five minutes, sitting down,
no controllers at any point.

A three-shape tutorial has you spelling a word inside the first minute,
practice tracks which letters you have learned, and a two-board bonus plays
every guess on two words at once. Either hand works, the
hold time is adjustable, and results never rely on colour alone.

### How we built it

It is a WebXR app built with Meta's Immersive Web SDK, so it runs in the
Quest browser from a link. The game reads the 25 hand joints each frame, and a
purpose-built recogniser scores each letter from finger bend, thumb position
and fingertip contact. No machine-learning model, no camera image, no
server: the word, the streak and the recognition all stay on the headset.
Everything is placed around the player's seated head position.

### Challenges we ran into

Letters fighting buttons. F, O and D are thumb-to-finger shapes that a
pinch-to-click interface would read as clicks, so buttons are touched with a
fingertip and ignore far pinches. The finger that has just pressed a button is
still pointing, which is the shape for D, so that shape is ignored until the
hand changes.

Look-alike letters were the other. M, N, S and T are fists that differ
only by a hidden thumb, so the word list avoids them rather than guessing.

### Accomplishments that we're proud of

A complete, replayable game with no controller and no backend, a first minute
with no wall of text, and 100 automated tests, including the recogniser checked
against hand poses not made for this game. **TODO:** add one line on
how it held up on the headset.

### What we learned

Hand input is mostly about what not to accept. Hold-to-confirm, ignoring
lowered hands, and making the hand change shape before a repeat did more for
the feel than raw recognition accuracy.

### What's next for Fingerspell

Fingerspell supports 17 static letters (A B C D E F G H I L O R U V W X Y). It
is a game that uses fingerspelling, not a sign-language course or a certified
teaching tool, and it has not yet been reviewed by Deaf signers; that review
comes first. Then the motion letters J and Z, more letters as tracking allows,
a share-your-result card, and a two-player mode where one person signs and the
other guesses. Target launch date: **TODO**.

## Screenshots to capture (last year's winners each had 5 to 10, captioned)

Take these in the headset if possible; simulator captures are allowed.

1. A letter mid-hold: hand raised, bar half full. Caption: "Make the shape, hold, and it types."
2. The tutorial after Y, O, U. Caption: "Spelling a word inside the first minute."
3. A round in progress with two marked guesses. Caption: "Right place, wrong place, not in the word."
4. The win screen with the streak. Caption: "One word a day."
5. Practice mode with the 3D reference hand. Caption: "Practice any of the 17 shapes."
6. A fingertip on the button bar. Caption: "Buttons are touched, never pinched, so letters can't click them."
7. Options with the colour-blind palette on. Caption: "Either hand, adjustable hold time, never colour alone."

## How hand interactions are implemented

- **Input is the raw hand skeleton.** Each frame the game reads the 25 WebXR
  hand joints for each hand (`XRFrame.fillPoses`) through the Immersive Web
  SDK's XR frame access. No controllers are used or needed at any point.
- **A purpose-built handshape recogniser** (plain TypeScript, no ML model, no
  network) converts the joints into measurements in the hand's own frame:
  the bend of each finger, where the thumb tip sits relative to the palm and
  fingers, which fingertips touch, the gap between index and middle
  fingertips, and which way the hand points. Each of the 17 letters is a
  short rule over those measurements, scored from 0 to 1. A letter is
  reported only when it is confident and clearly ahead of the runner-up. Left
  hands are mirrored so both hands share one rule set. It allocates nothing
  per frame.
- **Hold to confirm.** A letter is entered only after the shape is held
  steady (0.9 s by default, adjustable). One-frame flickers and brief
  tracking dropouts are ignored; a letter cannot repeat until the hand
  changes shape; hands resting in the lap are ignored because only raised
  hands are read.
- **Buttons are touched, not pinched.** Submit, Undo and the menus are
  IWSDK poke-interactable panels pressed with a fingertip. They deliberately
  do not accept far pinches in VR, because several letters (F, O, D) are
  thumb-to-finger shapes that would otherwise click things. The finger that
  has just pressed a button is still pointing, which is the shape for D, so
  that shape is ignored until the hand changes.
- **Seated placement.** When the session starts, the board, charts and
  button bar are positioned from the player's actual head height and facing
  direction, so it fits a chair, a sofa or a bed without setup.
- **Testing.** 100 automated tests cover the recogniser (against a synthetic
  hand with noise and tilt, and against joint data captured from the WebXR
  emulator's hand poses), the game rules, the hold logic and the streak. A
  full round was played hands-only in the emulator. **TODO before
  submitting:** replace this line with what on-headset testing showed.

## Video outline (keep under 3 minutes)

The rules ask for real gameplay, leading with what makes the project
distinct, and not leaning on AI-generated video.

1. 0:00 Hands only, in headset: sign three letters and watch them land on the board. One line of voice-over: "A daily word game you play by signing."
2. 0:20 First run: the YOU tutorial, start to finish, uncut.
3. 0:50 A full daily round, sped up between guesses, ending on the win and the streak.
4. 1:50 Practice mode and the handshape charts; left hand; options (hold time, contrast).
5. 2:20 Honest limits (17 letters, not a teaching tool) and what is next.

## Before submitting

- [ ] Confirm you are a member of the Meta VR Start program and your Meta account has Developer Access (both required by the time of submission).
- [ ] Join the hackathon on Devpost.
- [ ] Play it on the Quest and tune any letters that misbehave (see README, "What to check on the Quest").
- [ ] Publish to a public HTTPS URL and keep it up, unchanged, until the winner announcement (around 11 December 2026).
- [ ] Record and upload the video.
- [ ] Deadline: **18 November 2026, 12:00 PM Pacific Time**. No changes are allowed after that.
