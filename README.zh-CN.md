<div align="center">

# ChrisHKAI-Video

**贴一条创作者的 X 链接，做出一条主角是他自己 3D 搪胶公仔的短片。**<br>
头像从主页上像贴纸一样撕下来，鼓成他的公仔；最好的帖子立成一面面墙；数字从主页上原来的位置升起来。<br>
<sub>给编程 agent 用的视频 Skill，全部用代码做 · 🌐 <a href="README.md">English</a></sub>

<a href="https://github.com/ChrisHKAI/ChrisHKAI-Video/releases/tag/films"><img alt="看成片" src="https://img.shields.io/badge/-%E2%96%B6%20%E7%9C%8B%E6%88%90%E7%89%87-D7263D?style=for-the-badge"></a> <a href="README.md"><img alt="English" src="https://img.shields.io/badge/README-English-555?style=for-the-badge"></a> <a href="#帮忙测试"><img alt="招募测试" src="https://img.shields.io/badge/%E7%8A%B6%E6%80%81-%E6%8B%9B%E5%8B%9F%E6%B5%8B%E8%AF%95-8A2BE2?style=for-the-badge"></a> <a href="https://github.com/ChrisHKAI/ChrisHKAI-Video/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/ChrisHKAI/ChrisHKAI-Video?style=for-the-badge&color=F5B700&label=stars"></a> <a href="#授权"><img alt="MIT" src="https://img.shields.io/badge/licence-MIT-2EA44F?style=for-the-badge"></a>

⚠️ **为 Claude 而做。** 测试者用 Claude Opus 5.5 和 Sonnet 5.5（high 思考强度）都跑通了，xhigh 效果更好；<br>
其他模型和 agent 还没测过，请谨慎使用。

🆕 **2026-10-29 · 先讲你的故事**：三位测试者的片教会了我们很多。现在片子从创作者最出名的事情出发；公仔照原图的身体来做（柠檬不会长手脚）；开场有三款可选；Blender 开工前先检查哪里会出错。[看看 ↓](#会发生什么)<br>
🧪 **2026-10-28 · 开放测试**：第一条给真实创作者做的片已经完成、通过。现在想看看它在你的电脑上跑得怎样。[怎样帮忙 ↓](#帮忙测试)<br>
🆕 **2026-10-28 · 用耳朵选声音**：六种声音铺在动态分镜下面听完再选；也可以用创作者自己的歌对上影片的节拍，或者用真实乐器采样来演奏。[看看 ↓](#声音)

<sub>官方仓库：[github.com/ChrisHKAI/ChrisHKAI-Video](https://github.com/ChrisHKAI/ChrisHKAI-Video) · 作者 Chris（[@ChrisHKAI](https://x.com/ChrisHKAI)）</sub>

</div>

## 🎬 精选作品

<table><tr>
<td width="50%" valign="top"><a href="https://github.com/ChrisHKAI/ChrisHKAI-Video/releases/download/films/isnail-intro.mp4"><img src="docs/isnail-intro.jpg" alt="蜗牛King 的搪胶吉祥物站在他的帖子墙上"></a><br><b>▶ 蜗牛King</b> · @isnail · 0:30<br><sub>头像撕下来变成他的搪胶吉祥物；帖子立成墙，304万阅读从主页上升起。这个 Skill 就是从这条片提炼出来的。</sub></td>
<td width="50%" valign="top"><a href="https://github.com/ChrisHKAI/ChrisHKAI-Video/releases/download/films/kingao-intro.mp4"><img src="docs/kingao-intro.jpg" alt="Kin 的三花猫站在粉丝增长柱上"></a><br><b>▶ Kin</b> · @KinGao476942 · 0:30<br><sub>主角是他的三花猫搪胶公仔：第 3 天 50 粉丝，第 48 天破万。</sub></td>
</tr></table>

<div align="center">

两条片从第一帧到最后一个音符都是代码：画面由 Blender 渲染，声音由 Python 写出来。<br>
[**▶ 全部成片**](https://github.com/ChrisHKAI/ChrisHKAI-Video/releases/tag/films) · [**每条片怎样做出来**](examples/README.md)

</div>

## 👋 关于我

我是 **Chris**（[@ChrisHKAI](https://x.com/ChrisHKAI)），来自香港，在 X 上分享我用 AI 做的东西。

> **不是模板合集。** 这里每一条片都是我和编程 agent 一起用代码做的。<br>
> Skill 按 Claude Opus 5.5 调校，换了模型未必做得出来。

每条片的导演、制作、配乐和渲染，都由 agent 写代码完成：

- 🧸 **公仔**：按你确认的图片，用零件表、宠物套件或有向距离场雕塑做出来
- 🎨 **画面**：主页是 HTML，场景用 Blender Cycles 逐帧渲染
- 🎵 **声音**：Python 合成、免费乐器采样演奏，或者把创作者自己的歌剪到影片的节拍上

不用视频生成，不用图片生成，不用素材库画面。头像、帖子和数字都是创作者自己的。

## 怎样用

两种方法，装插件最简单。

### 方法一：安装 Skill（推荐）

在终端里：

```sh
claude plugin marketplace add https://github.com/ChrisHKAI/ChrisHKAI-Video.git
claude plugin install chrishkai-video@chrishkai-video
```

完整的 `https://` 地址不需要 SSH key，下载约 2 MB。如果还是失败（连 GitHub 很慢或者连不上），就自己先下载，再加入那个文件夹：

```sh
git clone --depth 1 https://github.com/ChrisHKAI/ChrisHKAI-Video.git
claude plugin marketplace add ./ChrisHKAI-Video
claude plugin install chrishkai-video@chrishkai-video
```

之后在任何文件夹都能用。

- 每条片有自己的工作区 `<账号>-intro/`，放在你启动时所在的文件夹。
- Blender、Python 模块和无头 Chrome 装在用户级文件夹（`~/Applications`、`~/.chrishkai-video`、`~/.cache/puppeteer`），而且要你说好才装。
- 其他 agent：把 [`skills/creator-toy-intro/`](skills/creator-toy-intro/) 整个文件夹复制到它的 skills 目录。

### 方法二：克隆仓库

```sh
git clone https://github.com/ChrisHKAI/ChrisHKAI-Video.git
mkdir my-films && cd my-films
claude --plugin-dir ../ChrisHKAI-Video
```

片放在 `my-films/`，不会进仓库。

### 然后直接说你想要什么

> 帮我做一条自我介绍片：https://x.com/yourhandle

> 幫我整條自我介紹片，主角係我個公仔：https://x.com/yourhandle

> Make a self-intro film for https://x.com/yourhandle

链接、从 App 复制的分享文字、几张截图都可以。还没想好？只输入 `/chrishkai-video:creator-toy-intro`，它会问你要链接。

它用你的语言回答，开头只问一件事：16:9（X 电脑版主页，推荐）还是 9:16（X 手机版主页）。其他都从主页自己判断。

### 会发生什么

六步，每一步都停在一样你要看的东西上。

| 步骤 | 做什么 | 停下来等你的地方 |
|---|---|---|
| **0 · 电脑** | 检查 Blender、Node、Python、ffmpeg 和 Chrome；你说一次好，就装齐缺的 | 缺东西时的安装清单 |
| **1 · 你的链接** | 读链接，开这条片的工作区 | 16:9 还是 9:16 |
| **2 · 他的故事** | 创作者最出名、最自豪的几件事，每件配上图片、数字（今天的数字，注明从哪里读到）和它会变成的动画；电脑装了 Grok Build 会先问你要不要用它搜 X（没装就直接用浏览器，不会问）| 公仔用哪张图做；然后一页选完：两三件故事、三款开场之一、收尾，每个选项都有预览图 |
| **3 · 公仔** | 照原图的身体来做（人、动物、物件），用三种套件之一：零件表、宠物、雕塑 | 一张转身图给你确认，颜色已经在深色舞台上检查过 |
| **4 · 分镜** | 按你选的顺序排好每一段、节拍网格、真实的预览渲染、每种声音铺在动态分镜下面 | 分镜页：在画面上留意见、选声音、签字确认 |
| **5 · 渲染** | 先用最终画质渲染几秒样片，想先看的话有半尺寸快速版，然后是成片、只有音效的版本、各平台封面、最后检查 | 成片 |

片子不是套模板：你的素材需要 Skill 还没有的动画时（比如插画拼成一个立体小世界、网页慢慢滚过），agent 会为你的片专门写出来。

你签字之前，分镜页会先帮你检查：

- **节奏**：冷场、公仔独自站太久或者小得看不见、头三秒，以及每行字停留的时间够不够读完。
- **不会中途崩**：`check` 在 Blender 开工前读一遍所有设定，用白话讲哪里错；分镜页全部通过、你签字之后，才开始正式渲染。
- **颜色**：每个字在深色舞台上都要看得清；配色取自创作者自己的图片。
- **不穿模**：公仔不会走进墙里、站进墙上凸出来的东西里，字条也不会穿过公仔。公仔会自己让开，`clearance` 在 Blender 开工前逐帧检查。
- **要和通过的片一样好**：`compare` 把你的片的开场、公仔出场、数字定格、高潮和结尾卡，和三条已经通过的片并排对比，agent 会把不够的地方改好。正式渲染之前，`sample` 先用最终画质连声音渲染最难的几秒。
- **别又是上一条**：交付过的片都记在台账里（Skill 自己的几条片一开始就在里面），新片在六样东西（开场、结构、招牌动作、配色、声音、结尾）里至少要有四样和每一条都不同。
- **第二意见**：另找一个全新的评审看简报和画面。意见不同时，只当多一个选择给你，不是规定。

故事选择现在先给出最多三条完整主线，并推荐一条：每条都有开场、
素材之间的关系、结尾和证据缺口。重要资料缺失时，再针对问题补搜一轮；
用 Grok 的话会再搜一轮。资料不足时会缩小故事范围，
不强行编出转折。旧项目仍可按原来的方式选择素材。

选好主线后，再做一次快速的内部文字故事测试：观众记住什么、为什么继续看、
换个名字还能不能成立，以及每个主要动作表达什么。它只是提醒，不会挡住片子，
不会多问你一次，也不会拖慢做公仔。实际动作有没有表达清楚，仍会在分镜和成片检查。

### 声音

用耳朵选：`run.mjs listen` 会把每种声音铺在动态分镜下面。

| 声音 | 是什么 |
|---|---|
| `bed`（默认） | 音效加一层很轻的长和弦 |
| `song` | 模板完整的合成歌曲 |
| `band` | 同一首歌，用真实乐器演奏 |
| `strings` | 那层和弦换成真实弦乐组和钢琴 |
| `fx` | 只有音效 |
| `own` | 创作者自己的歌，对上影片的节拍 |

`band` 和 `strings` 需要乐器采样库，约 1.4 GB，你说好才下载。

### 开始之前

- **要花时间，也很耗 token。** 一条片要几个小时，不是几分钟：查资料、做公仔、签分镜，最后 Cycles 在后台渲染一个小时以上（M4 Pro、M5 约 1.5 小时）。high 思考强度可以用，xhigh 更好。
- **在 Apple 芯片的 Mac 上测过**，用的是 Claude Code 和 Claude Opus 5.5。Windows 和 Linux 还没测；Intel Mac 跑不了 Blender 5.2。
- **需要** Blender 5.2+、Node 22+、Python 3.9+、ffmpeg 和无头 Chrome。Skill 会检查，你说好就装齐缺的；需要密码的那几样，由你自己贴进终端运行。如果连 `node` 都没有，先装 Node 22。
- 每条片约 **10 GB 空间**，还要有 **GPU**：没有 GPU，Cycles 要渲染好几个小时。
- agent 必须能**看图片**（每项检查都是一张图）和用**浏览器**查资料。
- **可选**：[Grok Build](https://x.ai) 用来搜 X（每次搜索约 1–1.4 美元），以及真实乐器采样（约 1.4 GB）。
- **输出**：1920×1080 或 1080×1920，30 fps；默认 30 秒，内容多就更长。这一版只出 X；抖音、小红书、视频号、Instagram 之后每次更新加一个平台。

### 更新或卸载

更新，然后重启 Claude Code：

```sh
claude plugin marketplace update chrishkai-video && claude plugin update chrishkai-video@chrishkai-video
```

卸载：

```sh
claude plugin uninstall chrishkai-video@chrishkai-video
```

不需要的话，再删掉 `~/.chrishkai-video`（Python 模块、字体、乐器采样和你的成片台账）。`~/Applications` 里的 Blender 和 `~/.cache/puppeteer` 里的 Chrome 留不留由你。你的片的工作区不会动。

哪一步卡住了，请[开一个 issue](https://github.com/ChrisHKAI/ChrisHKAI-Video/issues)。

## 帮忙测试

这个 Skill 还在测试阶段：已经给一位真实创作者做完一条片。我没法自己试遍每一种电脑和模型，很想知道它在你那边跑得怎样。请[开一个 issue](https://github.com/ChrisHKAI/ChrisHKAI-Video/issues)，写上：

- 用的 agent、模型和思考强度；
- 你的电脑（芯片、系统、GPU）；
- 在哪里卡住，或者哪里看起来不对（附一帧画面或分镜页截图更好）；
- 愿意的话，附上成片。

目前测过：

| agent | 模型 | 强度 | 电脑 | 结果 |
|---|---|---|---|---|
| Claude Code | Claude Opus 5.5 | xhigh | Mac（Apple 芯片） | [铁柱AGI 的 42 秒片](https://github.com/ChrisHKAI/ChrisHKAI-Video/releases/download/films/cgnot996-intro.mp4)，已通过 |
| Claude Code | Claude Opus 5.5 | high | M4 Pro | 无人值守做出 32 秒片，约 2.5 小时；评审认为第三幕太长太静 |
| Claude Code | Claude Sonnet 5.5 | high | M4 Pro | 无人值守做出 32 秒片，约 1.5 小时；一个数字用了旧帖的约数（已改） |
| Claude Code | Claude Opus 5.5 + Haiku | high | M5 | 30 秒片；中途崩了六次，片子也不好看：问题都已修好，教训写进了下一版 |

## 全部作品

做这个 Skill 之前和期间做过的每一条片。点画面就能看；每条片的简介和代码在 [`examples/`](examples/README.md)。

<table><tr>
<td width="50%" valign="top"><a href="https://github.com/ChrisHKAI/ChrisHKAI-Video/releases/download/films/cgnot996-intro.mp4"><img src="docs/cgnot996-intro.jpg" alt="铁柱AGI 的公仔和 1,500 颗金色星星"></a><br><b>▶ 铁柱AGI</b> · @cgnot996 · 0:42<br><sub>Skill 给真实创作者做的第一条片：日历一路翻到万粉、Grok App 拿到 1,500 star、盖上「官方认证」章。</sub></td>
<td width="50%" valign="top"><a href="https://github.com/ChrisHKAI/ChrisHKAI-Video/tree/examples/examples/tim-intro"><img src="docs/tim-intro-steve.jpg" alt="2007 年发布会舞台上的 Steve Jobs 搪胶公仔"></a><br><b>Steve</b> · 出自 Tim 那条片<br><sub>Steve Jobs 搪胶公仔站在 2007 年发布会舞台上，旁边是 Tim 的公仔。整条片（2:23）不公开：里面有属于别人的发布会画面和歌曲。点图看它的代码。</sub></td>
</tr><tr>
<td width="50%" valign="top"><a href="https://github.com/ChrisHKAI/ChrisHKAI-Video/releases/download/films/isnail-intro.mp4"><img src="docs/isnail-endcard.jpg" alt="蜗牛King 的结尾卡：吉祥物骑着蜗牛"></a><br><b>▶ 蜗牛King</b> · 结尾卡<br><sub>吉祥物骑着从公众号标志长出来的蜗牛，撕纸标签一张张拍下来：公众号变现 | 找蜗牛。</sub></td>
<td width="50%" valign="top"><a href="https://github.com/ChrisHKAI/ChrisHKAI-Video/releases/download/films/chris-outro.mp4"><img src="docs/chris-outro.jpg" alt="白色 3D 字 Chris HKAI 和 Chris 公仔"></a><br><b>▶ Chris HKAI</b> · 0:23<br><sub>片尾标识：我自己的雕塑搪胶公仔。</sub></td>
</tr></table>

另外两条，Merge Conflict 和 Made with DeepSeek，在 [Releases 页面](https://github.com/ChrisHKAI/ChrisHKAI-Video/releases/tag/films)。

## 授权

由 **ChrisHKAI × Claude** 制作。

- **代码和文档**：[MIT](LICENSE)。
- **你用 Skill 做的片**：归你。
- **示例片里的创作者**（Releases、`docs/` 和 `examples/`）：他们的头像、帖子、名字和吉祥物属于他们自己。
- **真实乐器**：采样器来自 [lemo-opuscar](https://github.com/lemomo-ai/lemo-opuscar)，MIT 授权，放在 [`engine/vendor/lemo/`](skills/creator-toy-intro/engine/vendor/lemo/)。采样库保留各自的授权：CC0，只有 Salamander 三角钢琴（CC BY 3.0）和 MuldjordKit 鼓组（CC BY 4.0）例外。用到它们的片会生成一份 `credits.txt`，放进影片简介。
- **不含字体文件**：结尾卡用系统字体（兰亭黑、苹方、Helvetica Neue）或免费的思源黑体。系统字体用于商业用途，可能需要另外向字体厂商购买授权。

片里用的素材由你自己负责。

## 鸣谢

- 🍋 **[lemo-opuscar](https://github.com/lemomo-ai/lemo-opuscar)**（Lemomo）：真实乐器背后的采样器和采样包，还有这一页的写法。

---

<div align="center">

⭐ **给仓库点个 Star**<br>
👀 **Watch → Custom → Releases**，有新版本时收到通知<br>
𝕏 关注 [@ChrisHKAI](https://x.com/ChrisHKAI)

<sub>ChrisHKAI-Video · 作者 Chris</sub>

</div>
