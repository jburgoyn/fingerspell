#!/bin/sh
# Simulator helpers.  sim.sh pose <poseId> [fingers-json] [hand]   |   sim.sh up|side [hand]   |   sim.sh rest [hand]
cmd=$1; shift
case $cmd in
  up)   npx @iwsdk/cli xr set-transform --input-json "{\"device\":\"${1:-hand-right}\",\"position\":{\"x\":0.18,\"y\":1.42,\"z\":-0.35},\"anchor\":\"wrist\",\"orientation\":{\"fingers\":\"up\",\"palm\":\"forward\"}}" | grep -E '"ok"|message' ;;
  side) npx @iwsdk/cli xr set-transform --input-json "{\"device\":\"${1:-hand-right}\",\"position\":{\"x\":0.22,\"y\":1.42,\"z\":-0.35},\"anchor\":\"wrist\",\"orientation\":{\"fingers\":\"left\",\"palm\":\"toward-head\"}}" | grep -E '"ok"|message' ;;
  pose) f=${2:-"{}"}; npx @iwsdk/cli xr set-hand-pose --input-json "{\"device\":\"${3:-hand-right}\",\"poseId\":\"$1\",\"fingers\":$f}" | grep -E '"ok"|message' ;;
  rest) npx @iwsdk/cli xr set-hand-pose --input-json "{\"device\":\"${1:-hand-right}\",\"poseId\":\"default\"}" | grep -E '"ok"|message' ;;
esac
