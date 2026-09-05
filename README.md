# dsh-plugin-sticker 🐟

DeepSeek Harness 表情包插件：让 AI 在聊天时**根据情境主动挑选并发送表情包**，发送后图片**直接内嵌在对话气泡里**（无需点击）。

图库为「蓝发鱼娘 / 蓝色大肥鱼」系列梗图（覆盖干饭、压力、摸鱼、委屈、生气、冬眠、想家、女王等 100+ 梗）。AI 在对话氛围合适时（用户开心、吐槽、诉苦、炫耀、求夸、聊吃饭…）会主动调用工具发表情包。

> 搭配 [dsh-plugin-fun](https://github.com/keeshakulbida948-tech/dsh-plugin-fun)（阿蓝人格插件）效果最佳——fun 负责"什么时候该发"的性格引导，sticker 负责"发得出、发得对"。

## 安装

```bash
# 直接安装（GitHub）
dsh plugin --profile web add https://github.com/keeshakulbida948-tech/dsh-plugin-sticker

# 或本地目录安装（开发调试）
dsh plugin --profile web add /path/to/dsh-plugin-sticker

# 装完重启 dsh web 生效
dsh web
```

验证插件已挂载：

```bash
dsh --profile web --dump-config | grep sticker
```

## ⚠️ 先准备图库（重要）

本仓库**不含图片文件**（体积大），只含图库索引 `assets/stickers.json`。你需要一个存放 109 张表情包 PNG 的目录，然后用环境变量告诉插件：

```bash
# Windows PowerShell（示例）
$env:DSH_STICKER_DIR = "D:\my-stickers"
dsh web
```

- 索引里每条记录 `file` 字段 = 图库目录下的文件名，一一对应
- 目录缺失时插件不崩溃，但发图会提示"文件缺失"
- 作者演示图库：`蓝发鱼娘/蓝色大肥鱼` 系列 AI 梗图（可自行用 AI 生成同风格图并按索引结构命名）

## 使用

在 dsh web 聊天里告诉它：

- 「来个委屈的表情包」→ AI 调 `send_sticker`（name: 委屈）
- 「有没有摸鱼的图？发一张」→ AI 先 `list_stickers` 搜索再发送
- 直接说「发 35 号」→ 按编号发送

### 工具

| 工具 | 作用 |
| --- | --- |
| `list_stickers` | 按情绪/主题/关键词搜索图库（省略 query 返回前 20 张），返回编号+描述+标签 |
| `send_sticker` | 发送表情包（参数 name 支持：编号 / 文件名 / 情绪关键词，自动匹配最佳） |

## 配置

| 项 | 说明 |
| --- | --- |
| `DSH_STICKER_DIR` | 图库目录（环境变量），默认作者本地目录 `C:/Users/Administrator/Pictures/做表情包的图片/新建文件夹 (2)`，**他人使用务必覆盖** |
| `assets/stickers.json` | 图库索引（编号→文件名/主体/情绪/标签），图库变化后需同步维护 |

## 工作原理

```
┌─────────────────────────────────────┐
│ dsh web (浏览器)                     │
│  ┌───────────────────────────────┐  │
│  │ 工具卡片 (client toolview)     │  │
│  │  <img src="/sticker-img/35">   │  │  ← 图片内嵌渲染
│  └───────────────────────────────┘  │
└──────────────┬──────────────────────┘
               │ /sticker-img/<name>
┌──────────────▼──────────────────────┐
│ sticker 插件 (node)                 │
│  ├ list_stickers / send_sticker     │
│  ├ webServer 图片路由（读原图目录）  │
│  └ assets/stickers.json 索引        │
└─────────────────────────────────────┘
```

图片文件不复制进插件，由 `/sticker-img/` 路由即时读取原图目录；浏览器端 client.js 注册 `send_sticker` 的自定义 toolview，把图片直接渲染进对话气泡。

## 图库更新

1. 把新图放进图库目录
2. 更新 `assets/stickers.json`（按现有结构追加 `{id, file, subject, mood, tags}` 条目）
3. 重启 dsh web 生效

## License

MIT
