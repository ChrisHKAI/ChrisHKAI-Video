// Where each per-frame texture lives inside build/atlas/####.png (pixels).
// Everything is painted at 2x its UI size, like assets/ui.png.
import { CODE, TERM, STATUS } from "./timeline.js";

const S = 2;
export const ATLAS_SCALE = S;
export const ATLAS = {
  w: STATUS[2] * S,
  h: (CODE[3] + TERM[3] + STATUS[3]) * S,
  code: [0, 0, CODE[2] * S, CODE[3] * S],
  term: [0, CODE[3] * S, TERM[2] * S, TERM[3] * S],
  status: [0, (CODE[3] + TERM[3]) * S, STATUS[2] * S, STATUS[3] * S],
};
