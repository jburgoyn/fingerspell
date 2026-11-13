#!/bin/sh
# Prints warnings and errors from the managed browser console.
npx @iwsdk/cli browser logs --input-json '{"count":80}' | python3 -c "
import sys,json
d=json.load(sys.stdin)
for e in d['data']['result']:
    if e.get('level') in ('warn','warning','error') or 'fingerspell' in e.get('message',''):
        print(e['level'], e['message'][:400])
"
