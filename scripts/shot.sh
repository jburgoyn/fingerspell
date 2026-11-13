#!/bin/sh
# Screenshot from a level head, a little closer than the seat: shot.sh <file> [z]
npx @iwsdk/cli xr set-transform --input-json "{\"device\":\"headset\",\"position\":{\"x\":0,\"y\":1.52,\"z\":${2:--0.3}},\"orientation\":{\"pitch\":${3:-0},\"yaw\":0,\"roll\":0}}" | grep -E 'message'
sleep 0.4
npx @iwsdk/cli browser screenshot --output-file "$1" | grep screenshotPath
npx @iwsdk/cli xr set-transform --input-json '{"device":"headset","position":{"x":0,"y":1.6,"z":0},"orientation":{"pitch":0,"yaw":0,"roll":0}}' | grep -E 'message'
