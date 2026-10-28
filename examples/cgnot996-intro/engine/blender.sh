#!/bin/zsh
# The skill's render step (engine/run.mjs render) with this film's own scene.py
# (engine/scene.py: the light look). Args after the script go to scene.py:
#   engine/blender.sh --frames 1-900 --samples 128 --scale 100
FILM=${0:A:h:h}
export FILM SKILL=/Users/chris/Developer/ChrisHKAI-Video/skills/creator-toy-intro
cd $FILM && exec caffeinate -i /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-exit-code 1 -P $FILM/engine/scene.py -- "$@"
