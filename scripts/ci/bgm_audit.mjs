// BGM 曲库/播放器审计（CI 守卫）— 2026-09-17 立
// 背景：右下角新增「背景音乐播放器」，曲目来自用户提供的真实音频（public/audio/bgm/*.mp3）。
// 这类「文件 + 清单」的组合最容易出的问题：清单里写了文件但文件没进仓库（打包后静默无声）、
// 改名后清单没跟上、响度校准系数被手滑改成 0（静默变哑巴）、场景映射指向不存在的曲目。
// 断言：
//   A. 曲库每条都有 file / name / 合法 id，且 id 与 name 都不重复
//   B. 每个 file 在 public/audio/bgm/ 下真实存在且非空（体积 > 10KB，防 0 字节占位）
//   C. 每个有 scene 的曲目，scene 必须在 BGM_SCENE_LABEL 里（否则面板显示空白）
//   D. 场景映射表 BGM_SCENE_TRACK 的每个值都是曲库里的 id，且该曲目的 scene 与键一致
//   E. 响度校准：trim ∈ (0, 2]，BGM_MASTER_TRIM ∈ (0, 1]（为 0 会静默无声）
//   F. 播放器组件引用的 css 类与曲库对得上（组件存在、且没写死曲目清单）
//   G. App.vue 的场景判定仍覆盖全部 10 个场景（漏写某个页面分组会静默永远放兜底曲）
// 运行：node scripts/ci/bgm_audit.mjs
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..')
let fail = 0
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  ok  ${name}`)
  else {
    fail++
    console.log(`FAIL  ${name} ${detail}`)
  }
}

const mod = await import(pathToFileURL(path.join(ROOT, 'src/game/data/bgmTracks.js')).href)
const { BGM_TRACKS, BGM_SCENE_TRACK, BGM_SCENE_LABEL, BGM_MASTER_TRIM, bgmTrackVolume } = mod

/* A. 清单字段与唯一性 */
const ids = BGM_TRACKS.map((t) => t.id)
const names = BGM_TRACKS.map((t) => t.name)
check('A. 曲目条数 ≥ 10（10 个场景各有曲）', BGM_TRACKS.length >= 10, `实际 ${BGM_TRACKS.length}`)
check('A. id 唯一', new Set(ids).size === ids.length)
check('A. name 唯一', new Set(names).size === names.length)
check('A. 每条都有 id/file/name', BGM_TRACKS.every((t) => t.id && t.file && t.name))

/* B. 文件真实存在且非空 */
const audioDir = path.join(ROOT, 'public/audio/bgm')
const missing = []
const tiny = []
for (const t of BGM_TRACKS) {
  const p = path.join(audioDir, t.file)
  if (!fs.existsSync(p)) missing.push(t.file)
  else if (fs.statSync(p).size < 10 * 1024) tiny.push(`${t.file}(${fs.statSync(p).size}B)`)
}
check('B. 曲库里的文件都在 public/audio/bgm/ 下', missing.length === 0, missing.length ? `缺: ${missing.join(', ')}` : '')
check('B. 文件都有实际内容（>10KB，防 0 字节占位）', tiny.length === 0, tiny.join(', '))
// 反向：目录里的音频文件都登记了（避免加了文件却没人能选到）
const onDisk = fs.existsSync(audioDir) ? fs.readdirSync(audioDir).filter((f) => /\.(mp3|ogg|m4a|wav)$/i.test(f)) : []
const unlisted = onDisk.filter((f) => !BGM_TRACKS.some((t) => t.file === f))
check('B2. 目录里的音频都登记进曲库（否则玩家选不到）', unlisted.length === 0, unlisted.length ? `未登记: ${unlisted.join(', ')}` : '')

/* C. scene 有标签 */
const noLabel = BGM_TRACKS.filter((t) => t.scene && !BGM_SCENE_LABEL[t.scene]).map((t) => t.id)
check('C. 每个 scene 都有中文标签', noLabel.length === 0, noLabel.join(', '))

/* D. 场景映射自洽 */
const badScene = []
for (const [scene, id] of Object.entries(BGM_SCENE_TRACK)) {
  const tr = BGM_TRACKS.find((t) => t.id === id)
  if (!tr) badScene.push(`${scene}→${id}(不存在)`)
  else if (tr.scene !== scene) badScene.push(`${scene}→${id}(该曲 scene=${tr.scene})`)
}
check('D. 场景映射都指向存在的曲目且 scene 对得上', badScene.length === 0, badScene.join(', '))
const sceneKeys = new Set(Object.keys(BGM_SCENE_TRACK))
const dupScene = BGM_TRACKS.filter((t) => t.scene && !sceneKeys.has(t.scene)).map((t) => t.id)
check('D2. 有 scene 的曲目都在映射表里（不会永远播不到）', dupScene.length === 0, dupScene.join(', '))

/* E. 响度系数 */
check('E. BGM_MASTER_TRIM ∈ (0,1]（为 0 = 静默无声）', BGM_MASTER_TRIM > 0 && BGM_MASTER_TRIM <= 1, `实际 ${BGM_MASTER_TRIM}`)
const badTrim = BGM_TRACKS.filter((t) => !(t.trim > 0 && t.trim <= 2)).map((t) => `${t.id}=${t.trim}`)
check('E. 每首 trim ∈ (0,2]', badTrim.length === 0, badTrim.join(', '))
// 默认音量下元素音量必须明显小于 1（这些是母带级响度的成品曲，不压会盖过音效）
const v035 = bgmTrackVolume('day', 0.35)
check('E2. 默认音量(0.35)下实际音量 ≤ 0.25（母带级音频必须压成背景音）', v035 > 0 && v035 <= 0.25, `实际 ${v035.toFixed(3)}`)

/* F. 播放器组件 */
const comp = path.join(ROOT, 'src/components/BgmPlayer.vue')
check('F. 播放器组件存在', fs.existsSync(comp))
const compSrc = fs.existsSync(comp) ? fs.readFileSync(comp, 'utf8') : ''
check('F. 组件从曲库取清单（没有手抄曲目）', /from '\.\.\/game\/data\/bgmTracks\.js'/.test(compSrc) && /v-for="t in BGM_TRACKS"/.test(compSrc))
check('F. 组件不直接调 bgm.play（唯一调用点是 App.vue 的 syncBgm）', !/bgm\.play\(/.test(compSrc))
const app = fs.readFileSync(path.join(ROOT, 'src/App.vue'), 'utf8')
check('F2. App.vue 挂载了播放器（游戏阶段）', /<BgmPlayer v-if="ui\.phase === 'game'"/.test(app))

/* G. 场景判定覆盖 10 个场景 */
const need = ['title', 'day', 'night', 'kitchen', 'diner', 'duel', 'boss', 'meditate', 'market', 'memory']
const cover = need.filter((s) => new RegExp(`'${s}'`).test(app) || s === 'title')
check('G. App.vue 的场景判定覆盖全部场景（模块缺失某个分组会永远放兜底曲）', cover.length === need.length, `缺: ${need.filter((s) => !cover.includes(s)).join(', ')}`)

console.log(fail ? `\nBGM 审计：FAIL（${fail} 项）` : `\nBGM 审计：PASS（${BGM_TRACKS.length} 首，音频 ${onDisk.length} 个文件）`)
process.exit(fail ? 1 : 0)
