# ChrisHKAI-Video

The reusable skill and engine live in `skills/creator-toy-intro/`. Claude Code
loads that directory as a plugin; Codex discovers the same skill through the
`.agents/skills/creator-toy-intro` symlink. Keep one shared engine and workflow.

For a creator film, read that skill's `SKILL.md` and `references/codex.md`.
Keep film workspaces and creators' media outside the repo. Source maintenance
and installation do not require making a film or installing render dependencies.

For Codex installation changes, run `python3 tests/install-codex.test.py`.
For research/story engine changes, run
`node --test tests/story-directions.test.mjs`. See `tests/README.md` for
Blender-dependent checks. Report what was actually tested; offline checks
are not a complete rendered-film test.
