# Steps 0 and 1: the computer, then onboarding

Ask as little as possible. Work things out from the link and the profile;
the user answers one round of questions at most. Never ask who the film is
for or whether the numbers are real: the user has settled that. Reply in the
user's language; paths and commands stay as they are.

## Step 0: the computer

Quiet unless something is missing.

1. Run `node <skill>/engine/scripts/doctor.mjs`. If `node` itself is
   missing, Node.js 22 is the first thing to install: `brew install node@22`
   on a Mac with Homebrew, `winget install -e --id OpenJS.NodeJS.LTS` on
   Windows, else nodejs.org.
2. Every line ✓: go on without a word about it.
3. Something ✗: show the plan it prints as one short list (what, size,
   where from, whether it needs a password) and ask once whether to install
   it all. One yes covers the list. Then run `doctor.mjs --install`, then
   `doctor.mjs` again.
4. An item marked "you run this one" needs an admin password (Homebrew,
   apt). Give the user the command to paste into Terminal and wait. Never
   type a password and never ask for one.
5. No: print `doctor.mjs --install --dry-run` so they have the commands,
   and stop.
6. Notes, said once: no GPU means Cycles renders take hours (the EEVEE draft
   stays quick); the end-card face falls back to Source Han Sans Heavy when
   Lantinghei SC is not on the Mac (Font Book can add it).

What is installed goes user-level: Blender into `~/Applications`, the
Python modules into `~/.chrishkai-video/venv`, headless Chrome into
`~/.cache/puppeteer`, the fallback faces into `~/.chrishkai-video/fonts`.
`engine/run.mjs` finds them there by itself.

This skill also needs, from the agent running it: a shell that may run for
an hour or more (renders run in the background), the ability to look at
images (every check is a picture to look at) and, for step 2, a browser.
Without image viewing, say so before starting: the checks cannot be skipped.

## Step 1: onboarding

1. Ask for one thing, the creator's profile: a link, a share message pasted
   from the app, or screenshots. If the user gave one already, do not ask.
2. See what the link says: `node <skill>/engine/scripts/new-film.mjs <folder>
   --link "<what they pasted>" --dry-run`. It reads whole share messages, finds
   the platform and the handle, and works out the rest.
3. Work out without asking:
   - the stage: whose profile page the toy pops out of. The link's platform;
     from screenshots, the app they show.
   - the script, 简 or 繁: from the profile's own text once seen (step 2);
     `zh-Hans` until then.
   Not worked out: which picture the toy is made from. Step 2 always asks,
   as soon as the profile picture is in (many are real people, some are not
   the creator at all).
4. Ask, in one round (AskUserQuestion where the agent has it, else one
   message with numbered options), only what is still open:
   - always: 16:9 (the X desktop page, recommended) or 9:16 (the X phone
     page). This release publishes on X only; 抖音, 小红书, 视频号 and
     Instagram come one per later release, so if the user names one, say so
     and make the X film (the 9:16 one plays on phones).
   - only when the link is not an X profile: the creator's X handle, if they
     have one; the film's page is the X profile either way.
   Not asked: the length (30 s is the only template for now), the folder,
   colours, music.
5. Open the workspace: `node <skill>/engine/scripts/new-film.mjs
   <handle>-intro --link "…" --publish x --aspect 16:9|9:16`,
   in the user's current folder; tell them where it is. It writes
   `film.json` (`step: "research"`) and the empty `research/`, `assets/`,
   `recipes/`.
6. A share link (`v.douyin.com`, `xhslink.com`) only names the platform:
   step 2 opens it in the browser to reach the profile.
7. Both orientations wanted (an X 16:9 film besides the phone one): make one
   first; the second is another workspace with `--aspect 16:9 --theme
   x-desktop` that reuses the research and the toy.

Next is step 2, the research: the profile, the pinned and best posts, their
numbers, and a material table for the user to pick from.
