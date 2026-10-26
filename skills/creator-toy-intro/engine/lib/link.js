// Reads a creator's link: a profile URL, or a whole share message pasted from
// an app ("长按复制此条消息…https://v.douyin.com/…"). Says which platform it
// is, the handle or id where the URL holds one, and which stage themes can
// play it. A short share link (v.douyin.com, xhslink.com) only says the
// platform: open it in the browser to reach the profile.
const STAGE = {
  x: { "16:9": "x-desktop", "9:16": "x-mobile" },
  douyin: { "9:16": "douyin-mobile" },
  xhs: { "9:16": "xhs-mobile" },
  channels: { "9:16": "channels-mobile" },
  ig: { "9:16": "ig-mobile" },
};
// paths on x.com / instagram.com that are not profiles
const X_RESERVED = new Set(["home", "i", "search", "explore", "settings", "messages", "notifications", "compose", "intent", "share", "hashtag", "login", "signup", "tos", "privacy"]);
const IG_RESERVED = new Set(["p", "reel", "reels", "explore", "stories", "accounts", "direct", "tv"]);

const RULES = [
  { platform: "x", host: /(^|\.)(x|twitter)\.com$/, read: (p) => (p[0] && !X_RESERVED.has(p[0].toLowerCase()) && /^[A-Za-z0-9_]{1,15}$/.test(p[0]) ? { handle: p[0] } : null) },
  { platform: "douyin", host: /^v\.douyin\.com$/, short: true },
  { platform: "douyin", host: /(^|\.)douyin\.com$/, read: (p) => (p[0] === "user" && p[1] ? { id: p[1] } : null) },
  { platform: "douyin", host: /(^|\.)iesdouyin\.com$/, read: (p) => (p[0] === "share" && p[1] === "user" && p[2] ? { id: p[2] } : null) },
  { platform: "xhs", host: /(^|\.)xiaohongshu\.com$/, read: (p) => (p[0] === "user" && p[1] === "profile" && p[2] ? { id: p[2] } : null) },
  { platform: "xhs", host: /^xhslink\.com$/, short: true },
  { platform: "channels", host: /^channels\.weixin\.qq\.com$/ },
  { platform: "ig", host: /(^|\.)instagram\.com$/, read: (p) => (p[0] === "stories" && p[1] ? { handle: p[1] } : p[0] && !IG_RESERVED.has(p[0]) ? { handle: p[0] } : null) },
  // places a creator may link that have no stage theme yet
  { platform: "youtube", host: /(^|\.)youtube\.com$|^youtu\.be$/, read: (p) => (p[0]?.startsWith("@") ? { handle: p[0].slice(1) } : null) },
  { platform: "bilibili", host: /(^|\.)bilibili\.com$|^b23\.tv$/, read: (p) => (/^\d+$/.test(p[0] ?? "") ? { id: p[0] } : null) },
  { platform: "wechat-article", host: /^mp\.weixin\.qq\.com$/ },
];

export function readLink(text) {
  const found = String(text).match(/https?:\/\/[^\s<>"'，。、）)】]+/i) ?? String(text).match(/\b(?:[a-z0-9-]+\.)+(?:com|tv|be)\/[^\s<>"'，。、）)】]*/i);
  if (!found) return null;
  let url;
  try { url = new URL(found[0].startsWith("http") ? found[0] : `https://${found[0]}`); } catch { return null; }
  const host = url.hostname.toLowerCase().replace(/^www\.|^m\./, "");
  const parts = url.pathname.split("/").filter(Boolean);
  for (const r of RULES) {
    if (!r.host.test(host)) continue;
    const got = r.read ? r.read(parts) : null;
    return {
      url: url.href,
      platform: r.platform,
      ...(got ?? {}),
      short: Boolean(r.short),
      profile: Boolean(got) || r.platform === "channels",
      themes: STAGE[r.platform] ?? null,
    };
  }
  return { url: url.href, platform: null, short: false, profile: false, themes: null };
}

// the stage theme for a platform and an aspect ("16:9" / "9:16"), or null
export const stageTheme = (platform, aspect) => STAGE[platform]?.[aspect] ?? null;
export const STAGE_THEMES = STAGE;
