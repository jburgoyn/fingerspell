#!/bin/sh
# Plays a bonus round to a loss in the simulator (six identical wrong guesses).
./scripts/enter.sh; sleep 1
./scripts/press.sh 0; sleep 1.5      # Daily word (already finished today -> result screen)
./scripts/press.sh 0; sleep 1.5      # Bonus word
for i in 1 2 3 4 5 6; do node scripts/sign.mjs WIFLY 1300; ./scripts/press.sh 1; sleep 2; done
./scripts/logs.sh | tail -5
./scripts/shot.sh artifacts/lose.png -0.45
