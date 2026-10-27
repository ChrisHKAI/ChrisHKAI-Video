// A film as a list of segments, one after another (film.json "story.segments"):
// pieces of the template's own story, played on the story's clock
// ({ "story": [from, to] }, story seconds, "end" for its last), and beats with
// clocks of their own ({ "beat": "phrase", "bars": 3, … }: references/beats.md).
// The film is as long as its segments together. While a beat plays, the story
// stands still where it was cut away from (its places are far from every
// beat's stage, out of its shots). Without segments the film is the story
// itself, and every time below is the story's own.
//
// Each segment: { i, kind: "story" | "beat", f0, f1, len } in film seconds,
// plus s0, s1 (story seconds) for a story piece or the film.json entry for a beat.
const EPS = 1e-4;

export function makeSegments({ list, storyDuration, bar }) {
  const on = Array.isArray(list) && list.length > 0;
  const warnings = [];
  let f = 0;
  const segs = (on ? list : [{ story: [0, storyDuration] }]).map((entry, i) => {
    let s;
    if (entry.story) {
      const [a, b] = entry.story.map((v) => (v === "end" ? storyDuration : v));
      if (!(a >= 0 && b > a && b <= storyDuration + 1e-6)) throw new Error(`story.segments[${i}]: story [${entry.story}] is not inside the story's 0–${storyDuration} s`);
      s = { i, kind: "story", s0: a, s1: b, len: b - a, entry };
    } else if (entry.beat) {
      const len = entry.len ?? (entry.bars != null ? entry.bars * bar : null);
      if (!(len > 0)) throw new Error(`story.segments[${i}]: beat "${entry.beat}" needs "bars" (or "len" in seconds)`);
      s = { i, kind: "beat", len, entry };
    } else throw new Error(`story.segments[${i}]: give "story": [from, to] or "beat": <name or path>`);
    s.f0 = f;
    s.f1 = f + s.len;
    f = s.f1;
    // what keeps every hit on a downbeat: a beat lasts whole bars, and a piece of the
    // story plays a whole number of bars from where the story has it
    const whole = (v) => Math.abs(v / bar - Math.round(v / bar)) < 1e-3;
    if (on && s.kind === "beat" && !whole(s.len)) warnings.push(`segment ${i} (beat "${entry.beat}") is ${s.len.toFixed(3)} s, not whole bars (${bar} s): what follows leaves the downbeats`);
    if (on && s.kind === "story" && !whole(s.f0 - s.s0)) warnings.push(`segment ${i} plays the story ${(s.f0 - s.s0).toFixed(3)} s from where the story has it, not whole bars: its hits leave the downbeats`);
    return s;
  });
  const duration = f;
  const at = (t) => segs.find((s) => t < s.f1) ?? segs[segs.length - 1];
  const stories = segs.filter((s) => s.kind === "story");

  // the story's clock at film time t: inside a piece of it, where that piece is;
  // during a beat, standing still at the end of the last piece (or the start of the next)
  function storyTime(t) {
    if (!on) return t;
    const s = at(t);
    if (s.kind === "story") return s.s0 + Math.min(t - s.f0, s.len);
    const before = stories.filter((x) => x.f1 <= s.f0).pop();
    if (before) return before.s1 - EPS;
    const after = stories.find((x) => x.f0 >= s.f1);
    return after ? after.s0 : 0;
  }
  // a story time in the film: where a piece plays it (null when none does)
  function toFilm(v) {
    if (!on) return v;
    const s = stories.find((x) => v >= x.s0 - 1e-6 && v < x.s1 - 1e-9) ?? stories.find((x) => Math.abs(v - x.s1) < 1e-6);
    return s ? +(v - s.s0 + s.f0).toFixed(4) : null;
  }
  // the story's events in film time; one no piece plays goes to where the story
  // goes on after it (or the film's end), so a reader always finds a time
  function events(ev) {
    if (!on) return ev;
    const near = (v) => {
      const t = toFilm(v);
      if (t !== null) return t;
      const after = stories.find((x) => x.s0 > v);
      return +(after ? after.f0 : duration).toFixed(4);
    };
    const map = (v) => (Array.isArray(v) ? v.map(map) : near(v));
    return Object.fromEntries(Object.entries(ev).map(([k, v]) => [k, map(v)]));
  }
  // the story's sound cues where its pieces play them (a cue a few ms before a
  // piece's start belongs to it); the others are dropped
  function cues(list) {
    if (!on) return list;
    const out = [];
    for (const c of list) {
      const s = stories.find((x) => c.t >= x.s0 - 0.03 && c.t < x.s1);
      if (s) out.push({ ...c, t: +(Math.max(c.t, s.s0) - s.s0 + s.f0).toFixed(4) });
    }
    return out;
  }
  // hard cuts (film time): every join between segments, the story's own cuts
  // inside its pieces, and the beats' own (filmCuts)
  const cutsWith = (storyCuts, filmCuts = []) => {
    if (!on) return storyCuts;
    const all = [...segs.slice(1).map((s) => s.f0), ...storyCuts.map(toFilm).filter((t) => t !== null), ...filmCuts];
    return all.sort((a, b) => a - b).filter((t, i, a) => t > 0 && t < duration && (i === 0 || t - a[i - 1] > 1e-6));
  };

  return { on, list: segs, duration, warnings, at, storyTime, toFilm, events, cues, cutsWith };
}
