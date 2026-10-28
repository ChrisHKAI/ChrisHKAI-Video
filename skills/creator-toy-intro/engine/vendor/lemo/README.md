# lemo-opuscar's sampler

`sampler.py` is copied from
[lemomo-ai/lemo-opuscar](https://github.com/lemomo-ai/lemo-opuscar), commit
`413a6bd6`, file `core/audio/sampler.py`, under the MIT licence (`LICENSE`).
It plays real instruments from sample libraries by name. It chooses each
sample by pitch and velocity, retunes it with soxr, alternates between
recordings so repeated notes do not sound identical, and stretches a long
note seamlessly. Its own guide is `core/audio/INSTRUMENTS.md` in that
repository.

Three lines are changed, each marked `# creator-toy-intro`:
- where the samples live: `~/.chrishkai-video/instruments`, or `INSTRUMENTS`
  in the environment;
- the two hints that say how to fetch a library.

`sfx.py` stands in for lemo's `core/audio/sfx.py`. It holds the sample
rate, `add` and `limit`, as lemo wrote them.

The samples are lemo's packs of five libraries, pinned in
`engine/lib/instruments.json`. `engine/scripts/instruments.mjs` fetches
them. Two of them need credit when used:
- the Salamander piano (CC BY 3.0);
- the MuldjordKit drums (CC BY 4.0).

`sampler.credits()` writes those lines. The skill puts them in
`build/credits.txt`.
