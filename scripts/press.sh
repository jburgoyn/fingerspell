#!/bin/sh
# Pokes a button on the control bar with the emulated right index finger: press.sh 0..3
npx @iwsdk/cli xr run-sequence --input-json "{\"device\":\"hand-right\",\"steps\":[{\"target\":\"btn-$1\",\"press\":{}}]}" --timeout 45000 | grep -E 'contactMs|message'
