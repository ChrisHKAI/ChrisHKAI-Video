# Running in Codex

This is a local, code-driven Blender workflow. Use the shared `SKILL.md`
and its step references. It needs no Claude CLI, Claude subscription, or
OpenAI API key of its own. Codex's own account and tool access still apply.
Codex installation and offline checks do not establish the quality of a
complete film; report separately what was actually rendered and inspected.

## Paths and commands

`<skill>` in every reference means the directory containing the `SKILL.md`
you loaded. Resolve it to an absolute path, following a symlink if needed.
Do not assume the current directory is the skill, use a Claude plugin cache
path, or rely on `CLAUDE_PLUGIN_ROOT`. No `npm install` is needed for the
engine: its `package.json` only defines local module imports.

Keep the creator's workspace outside the installed skill and source repo.
If Codex was opened in the repo, use a writable sibling `my-films/` folder
or the user's chosen output folder. For an existing film, keep its folder
and run `next` before resuming. For example, replace these paths with the
actual paths, quote them, and set them in each shell call that needs them:

```sh
SKILL_DIR='/absolute/path/to/creator-toy-intro'
FILM_DIR='/absolute/path/to/my-films/yourhandle-intro'
node "$SKILL_DIR/engine/scripts/doctor.mjs"
# Only after orientation is settled, for a new film:
node "$SKILL_DIR/engine/scripts/new-film.mjs" "$FILM_DIR" --link 'https://x.com/yourhandle' --publish x --aspect 16:9
FILM="$FILM_DIR" node "$SKILL_DIR/engine/run.mjs" next
```

The pipeline needs Node 22+. If using a bundled Node executable, put its
directory on `PATH` for that command as well: the engine starts child `node`
commands. Follow `onboarding.md` for the dependency plan and installation;
installing this skill alone does not install Blender, Chrome, or Python modules.
Respect Codex's configured filesystem and network permissions. An existing
user authorization still applies; a skill does not bypass a denied operation.

## Tools and user review

- Use the session's available shell and file-editing tools for code and commands.
  `AskUserQuestion` in older references is not required: use Codex's available
  question tool, or a short numbered question in chat, for decisions still open.
- Use the available browser/search tools for research. In the desktop app,
  prefer its visible in-app browser for the local story and storyboard pages;
  open the exact URL printed by `studio` (the port may vary), and keep it
  available while the user reviews it. Without browser control, share that
  URL for the user to open. Follow the supplied-evidence and public-source
  fallbacks in `research.md` when X is inaccessible; never invent counts.
- Use the image-viewing tool to inspect the generated turnaround, preview
  frames, contact sheets and covers. A successful command or a written review
  is not visual verification. If images cannot be viewed, explain the missing
  capability before beginning; do not mark the visual checks complete.
- Show previews with absolute file paths when the host supports local media,
  and link the story or storyboard page for notes and approval. Preserve the
  toy-picture, story, toy and storyboard decisions in the shared workflow.
  Do not record approval until the user actually gives it. The existing
  `check` and storyboard gates still apply to a full render.
- For `review`, use a fresh subagent only when the host permits delegation;
  otherwise use the self-review fallback in `review.md` and label it as such.
  Do not claim an independent reviewer ran when none did.

## Long-running work and delivery

`studio`, previews and renders can outlast a tool call. Use the shell tool's
persistent session/background support; retain the returned session or process
identifier and log path, and poll that same job. Do not start a second render
because the first call yielded. A live session is not a completed render.
Keep the studio server alive during user review. Resume frames with
`render -- --samples 48 --scale 100 --resume` after an interruption, once
`next` and `check` confirm the film is ready; do not use `--force` to bypass
missing user approval. When a command fails, inspect its output and the
workspace before retrying.

Before delivery, run the shared final QA and inspect its sheets. Link the
actual final MP4, effects-only cut, covers and any generated credits. Keep
the editable film workspace and report any checks that could not run.
