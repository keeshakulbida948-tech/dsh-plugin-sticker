// dsh-plugin-sticker
// DeepSeek Harness 表情包插件 —— 让 AI 在聊天时根据情境发表情包
//
// 职责：
//   1. 维护表情包图库索引（assets/stickers.json，蓝发鱼娘/蓝色大肥鱼系列梗图）
//   2. list_stickers 工具：AI 按关键词/情绪浏览图库
//   3. send_sticker 工具：AI 选定后"发送"，图片直接内嵌渲染在对话气泡里（client 端 toolview）
//
// 图库目录：默认指向作者本地目录，可通过环境变量 DSH_STICKER_DIR 覆盖。
// 注意：图片文件不随本仓库分发（体积大），仅索引入库；他人使用需自行准备图库。

import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'sticker'
export const inject = ['tools', 'webServer']

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ---- 图库配置 ----
const DEFAULT_STICKER_DIR = 'C:/Users/Administrator/Pictures/做表情包的图片/新建文件夹 (2)'
const STICKER_DIR = process.env.DSH_STICKER_DIR || DEFAULT_STICKER_DIR
const INDEX_PATH = path.join(__dirname, 'assets', 'stickers.json')

// 情绪->典型场景 速查（写入工具描述，帮 AI 快速选题）
const MOOD_GUIDE = [
  '委屈/求安慰/道歉 -> 流泪、抱鲸鱼、墙角蹲、望月想家系列',
  '开心/炫耀/求夸 -> 干饭王奖杯、皇冠女王、墨镜耍帅、聚光灯自信系列',
  '吐槽/无语/压力大 -> 已读乱回、压力传送门、问号、文件堆、流水线系列',
  '生气/威胁/警告 -> 蓝拖鞋、巨勺武器、审判法槌、锅盔战士系列',
  '撒娇/可爱/求投喂 -> 比心、小心心、抱鲸鱼、举牌求饶系列',
  '困了/想睡/摆烂 -> 冬眠裹被子、昏睡抱碗、低电量、已读没力气系列',
  '干饭/饿/约饭 -> 冲刺、开饭啦、火锅期待、鱼航员系列',
  '摸鱼/逃避/不想干活 -> 摸鱼比耶、躲贝壳、传送门逃跑、暗度陈仓系列',
]

// ---- 索引加载 ----
let INDEX = []
try {
  INDEX = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'))
} catch (err) {
  console.warn(`[sticker] 索引加载失败: ${err.message}`)
}
const byId = new Map(INDEX.map((s) => [String(s.id), s]))
const byFile = new Map(INDEX.map((s) => [s.file, s]))

function filePathOf(sticker) {
  return path.join(STICKER_DIR, sticker.file)
}

function normalize(text) {
  return String(text || '').toLowerCase().trim()
}

// 关键词打分匹配：query 拆分后对 subject/mood/tags/file 加权
function searchStickers(query, limit = 20) {
  const q = normalize(query)
  if (!q) return INDEX.slice(0, limit)
  const terms = q.split(/[\s,，、;；/]+/).filter(Boolean)
  const scored = INDEX.map((s) => {
    const haySubject = normalize(s.subject)
    const hayMood = normalize(s.mood)
    const hayTags = (s.tags || []).join(' ').toLowerCase()
    const hayFile = normalize(s.file)
    let score = 0
    for (const t of terms) {
      if (!t) continue
      if (hayTags.includes(t)) score += 3
      if (haySubject.includes(t)) score += 2
      if (hayMood.includes(t)) score += 2
      if (hayFile.includes(t)) score += 1
    }
    return { s, score }
  })
  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.s)
}

function describe(sticker) {
  return `#${sticker.id}「${sticker.subject}」情绪:${sticker.mood} 适用:${(sticker.tags || []).slice(0, 5).join('/')}`
}

export function apply(ctx) {
  console.log(`[sticker] 表情包插件已加载：${INDEX.length} 张图 @ ${STICKER_DIR}`)

  // ---- list_stickers：浏览/搜索图库 ----
  ctx.tools.register(defineTool({
    name: 'list_stickers',
    description:
      '浏览表情包图库（蓝发鱼娘/蓝色大肥鱼系列梗图，共 109 张）。' +
      '给 query 会按情绪/主题/关键词搜索，省略 query 返回图库前 20 张。' +
      '典型可用情绪与场景：\n' + MOOD_GUIDE.join('\n') +
      '\n返回每张图的编号、画面描述、情绪与适用标签，之后用 send_sticker 发送（传编号或文件名）。' +
      '用户发来搞笑/吐槽/炫耀/诉苦等情绪化内容、或聊天氛围适合玩梗时，可主动调用发表情包活跃气氛。',
    parameters: {
      query: {
        type: 'string',
        description: '搜索关键词，如：委屈 / 干饭 / 摸鱼 / 生气 / 可爱 / 已读乱回 / 想家',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          message: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: value.message }],
    },
    async execute(args) {
      const q = normalize(args.query)
      const hits = searchStickers(args.query, 20)
      if (hits.length === 0) {
        return { message: `图库中没有匹配「${q}」的表情包。可试试：委屈/开心/生气/可爱/困/摸鱼/干饭/压力/女王/想家/冬眠/已读乱回` }
      }
      const lines = hits.map(describe)
      const head = q
        ? `匹配「${q}」的表情包 ${hits.length} 张（send_sticker 传编号）：`
        : `图库共 ${INDEX.length} 张，前 ${hits.length} 张（send_sticker 传编号）：`
      return { message: head + '\n' + lines.join('\n') }
    },
  }))

  // ---- send_sticker：发送表情包（产出文件卡片，可点击打开） ----
  ctx.tools.register(defineTool({
    name: 'send_sticker',
    description:
      '向用户发送一张表情包图片。参数 name 可以是：list_stickers 返回的编号（如 "5"）、' +
      '或完整文件名、或情绪/主题词（如 "委屈"——会自动匹配最合适的一张）。' +
      '发送后图片会直接内嵌显示在对话气泡中，用户立即可见。' +
      '适用时机：用户开心/难过/吐槽/炫耀/求夸/自嘲/催更/抱怨压力大/聊吃饭话题等，' +
      '发一张恰到好处的表情包让对话更有趣。不要过度使用，同一轮最多发 1 张。',
    parameters: {
      name: {
        type: 'string',
        required: true,
        description: '表情包编号、文件名或情绪关键词，如 "12" / "委屈" / "干饭王"',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'number' },
          file: { type: 'string', required: true },
          subject: { type: 'string', required: true },
          mood: { type: 'string', required: true },
          path: { type: 'string', required: true },
          message: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: `[表情包] ${value.subject}（${value.mood}）`,
      }],
      presentationMeta: (_args, value) => value,
    },
    // 图片由 client 端 toolview 直接内嵌渲染，无需 deliverables 产物行（去掉 mutation 声明）
    presentCall() {
      return undefined
    },
    async execute(args) {
      const hit = resolveByName(args.name)
      if (!hit) {
        const fuzzy = searchStickers(args.name, 5)
        const hint = fuzzy.length
          ? '\n相近的候选：\n' + fuzzy.map(describe).join('\n') + '\n请用编号或更精确的词重试。'
          : '\n未找到。先用 list_stickers 搜索合适表情包，再传编号发送。'
        return {
          id: 0, file: '', subject: '', mood: '', path: '',
          message: `没有找到「${args.name}」对应的表情包。${hint}`,
        }
      }
      const fp = filePathOf(hit)
      if (!fs.existsSync(fp)) {
        return {
          id: hit.id, file: hit.file, subject: hit.subject, mood: hit.mood, path: fp,
          message: `表情包文件缺失：${fp}。请确认图库目录 DSH_STICKER_DIR 配置正确。`,
        }
      }
      return {
        id: hit.id, file: hit.file, subject: hit.subject, mood: hit.mood, path: fp,
        message: `已发送表情包「${hit.subject}」（${hit.mood}）`,
      }
    },
  }))

  // ---- 表情包图片 HTTP 服务：供前端直接 <img> 展示 ----
  // GET /sticker-img/<name> -> 图片 bytes（name 支持编号/文件名/情绪词，与 send_sticker 同解析）
  const imgCache = new Map()
  ctx.effect(() => {
    try {
      const disposer = ctx.webServer.register({
        kind: 'prefix',
        path: '/sticker-img',
        async handler(req, res) {
          try {
            const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
            const name = pathname.slice('/sticker-img/'.length)
            const hit = resolveByName(name)
            if (!hit) {
              res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
              res.end('sticker not found')
              return
            }
            const fp = filePathOf(hit)
            let buf = imgCache.get(hit.id)
            if (!buf) {
              if (!fs.existsSync(fp)) {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
                res.end('sticker file missing')
                return
              }
              buf = fs.readFileSync(fp)
              if (imgCache.size > 220) imgCache.clear()
              imgCache.set(hit.id, buf)
            }
            res.writeHead(200, {
              'Content-Type': 'image/png',
              'Content-Length': buf.length,
              'Cache-Control': 'public, max-age=86400',
            })
            res.end(buf)
          } catch (err) {
            res.writeHead(500)
            res.end(String(err))
          }
        },
      })
      console.log('[sticker] 图片服务已注册 /sticker-img/<name>')
      return disposer
    } catch (err) {
      console.warn(`[sticker] 图片服务注册失败: ${err.message}`)
      return () => {}
    }
  })

  console.log('[sticker] 表情包插件初始化完成')
}

function resolveByName(name) {
  const key = normalize(name)
  if (!key) return null
  if (byId.has(key)) return byId.get(key)
  if (byFile.has(name)) return byFile.get(name)
  // 文件名精确/部分匹配
  const byFileExact = INDEX.find((s) => normalize(s.file) === key)
  if (byFileExact) return byFileExact
  const byFilePart = INDEX.find((s) => normalize(s.file).includes(key))
  if (byFilePart) return byFilePart
  // 情绪/主题模糊匹配 -> 最高分
  const fuzzy = searchStickers(name, 1)
  return fuzzy.length ? fuzzy[0] : null
}
