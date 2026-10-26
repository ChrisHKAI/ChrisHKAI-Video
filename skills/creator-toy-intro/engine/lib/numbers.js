// A number as a platform writes it: "304万", "1.1萬", "46K", "5,018", "2.3M",
// "1.2亿". The film shows it exactly that way, so the display string is kept;
// the value is only for sorting and for the counter, which counts up the
// display digits (304 of 304万) and puts the unit after them.
const UNITS = { 万: 1e4, 萬: 1e4, 亿: 1e8, 億: 1e8, 千: 1e3, k: 1e3, K: 1e3, w: 1e4, W: 1e4, m: 1e6, M: 1e6, b: 1e9, B: 1e9 };

export function readNumber(display) {
  const s = String(display).trim();
  const m = s.match(/^([+]?)(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*([万萬亿億千kKwWmMbB]?)\+?$/);
  if (!m) return null;
  const digits = m[2].replace(/,/g, "");
  const unit = m[3] || "";
  const n = Number(digits);
  return {
    display: s,
    value: Math.round(n * (UNITS[unit] ?? 1)),
    count: n, // what the counter counts up to (in display units)
    unit,
    whole: Number.isInteger(n), // the counter's digit slots take whole numbers only
  };
}
