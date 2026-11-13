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

## Description (about 480 words, limit 500)

**Fingerspell is a daily word game you play by signing.**

Every day there is one five-letter word. You guess it by spelling with your
hand, one letter at a time, using ASL fingerspelling handshapes. The headset
reads the shape of your hand, you hold it for a moment, and the letter drops
into the board. After each guess every letter is marked: right place, wrong
place, or not in the word. Six tries. Solve it and your streak grows; come
back tomorrow for the next word.

**Inspiration.** Daily word games are a habit millions of people already
have, and they are played on a keyboard. In a headset with hand tracking the
keyboard can be your hand. Fingerspelling is a real, existing way of spelling
with one hand, so the input is not an invented gesture set: it is something
worth knowing after the headset comes off.

**Why it only works here.** Take away hand tracking and there is no game. The
core loop is the feeling of making a shape, watching the bar fill, and seeing
your own hand type a letter.

**The first minute.** There is no wall of text. The game asks you to raise a
hand, shows a 3D hand to copy, and you sign Y, then O, then U. You have
spelled a word before you have read a paragraph. One fingertip touch starts
today's puzzle.

**Built for a chair.** Everything is placed around your seated head position:
the board a metre away inside a narrow field of view, a button bar within
easy reach, handshape charts at either side. A full session is about five
minutes. Today's progress is saved, so you can stop and resume.

**A reason to come back.** One shared word per day, a streak, and a practice
mode that tracks which of the 17 letters you have learned.

**Accessible by default.** Either hand works at any moment and the pictures
flip to match. The hold time is adjustable from 0.6 to 1.8 seconds. Results
never rely on colour alone, and there is a colour-blind friendly palette.
Every sound has a visual twin. The whole game can be played one-handed.

**Honest limits.** Fingerspell supports 17 static letters (A B C D E F G H I
L O R U V W X Y). J and Z are movements; M, N, S, T, K, P and Q are too
alike for headset tracking to separate reliably, so the word list avoids
them. It is a game that uses fingerspelling, not a sign-language course or a
certified teaching tool, and it has not yet been reviewed by Deaf signers.
Fingerspelling is one small part of ASL.

**What is next.** Review of the handshapes and wording with Deaf signers, the
motion letters J and Z, more letters as tracking allows, a share-your-result
card, and a two-player mode where one person signs and the other guesses.

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
- **Testing.** 97 automated tests cover the recogniser (against a synthetic
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
