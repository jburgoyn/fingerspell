#!/bin/sh
# Enters VR in the simulator with hand tracking.
npx @iwsdk/cli xr enter --input-json '{}' | grep -E 'success|message'
npx @iwsdk/cli xr set-input-mode --input-json '{"mode":"hand"}' | grep -E '"ok"|message'
