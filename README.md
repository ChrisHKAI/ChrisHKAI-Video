# ChrisHKAI-Video

ChrisHKAI 的视频 Skill 合集：用代码做视频，主角是创作者自己的 3D 搪胶公仔。

## Skill

| Skill | 做什么 | 状态 |
| --- | --- | --- |
| `creator-toy-intro` | 自媒体 3D 公仔介绍片：贴一条主页链接，做出一条 30 秒、主角是你自己 3D 搪胶公仔的自我介绍片 | 开发中（第四阶段：实测） |

## 作品

`examples/` 收录了做这个 Skill 之前和期间做过的每一条片：简介、代码和素材图，供大家参考；成片放在本仓库的 Releases（标签 `films`），不放进仓库，安装 Skill 时就不用一起下载。目录见 [examples/README.md](examples/README.md)；公仔设计（isnail 吉祥物、Kin 的三花猫、Tim、Steve Jobs、Chris）另在 `skills/creator-toy-intro/characters/`。

## 安装（Claude Code）

```bash
claude plugin marketplace add ChrisHKAI/ChrisHKAI-Video
claude plugin install chrishkai-video@chrishkai-video
```

其他 agent：把 `skills/creator-toy-intro/` 整个文件夹复制到它的 skills 目录。

## 实测过的 agent 和模型

第四阶段用真实创作者实测后填写：哪个 agent、哪个模型、什么思考强度、什么电脑，做出来的片怎样。

| agent | 模型 | 强度 | 电脑 | 结果 |
| --- | --- | --- | --- | --- |
| — | — | — | — | 待实测 |

## 授权

代码以 MIT 授权发布。`examples/` 里创作者的头像、封面等图片属于各自的创作者。仓库不含任何字体文件：兰亭黑等系统字体的商业用途，需要另行向字体厂商购买授权。
