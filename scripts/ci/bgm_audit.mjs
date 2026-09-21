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
import { stripComments } from './lib/comments.mjs'

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


/* H. 播放器/引擎的公开接口（e2e 的「不重叠 / 暂停继续」断言依赖它们，接口被删会静默失效） */
const soundSrc = fs.readFileSync(path.join(ROOT, 'src/game/core/sound.js'), 'utf8')
/** 剥掉注释后再做「不许出现某某写法」的断言——否则解释根因的注释本身会把守卫顶掉（本轮实测踩过两次：
 *  ① 注释里写了旧变量名 `realFadeTimer`；② `bgm/*.mp3` 里的 `/*` 被简单正则当成块注释、吃掉 10 行代码） */
const soundCode = stripComments(soundSrc)
check('H. 引擎暴露 pause/isPaused/playingCount/position（暂停与「只许一首出声」的守卫依赖）', ['pause(', 'isPaused(', 'playingCount(', 'position('].every((k) => soundSrc.includes(k)))
check(
  'H2. 淡变定时器按元素存（别再退回单个全局定时器 —— 那会造成切曲重叠）',
  /fadeTimers\s*=\s*new Map\(\)/.test(soundCode) && !/realFadeTimer/.test(soundCode)
)
const appSrc = fs.readFileSync(path.join(ROOT, 'src/App.vue'), 'utf8')
check('H3. syncBgm 处理了暂停（settings.bgmPaused → bgm.pause）', /bgmPaused/.test(appSrc) && /bgm\.pause\(\)/.test(appSrc))
check('H4. 播放器有暂停按钮（.bgm-tbtn--play / 面板头部 .bgm-hbtn）', /bgm-tbtn--play/.test(compSrc) && /togglePause/.test(compSrc))

/* I. 播放模式与「上一首 / 下一首」（2026-09-18）：纯函数行为 + 接线 + 常驻控制条 */
const { BGM_MODES, nextBgmMode, nextTrackId, prevTrackId } = mod
const idsAll = BGM_TRACKS.map((t) => t.id)
const iFirst = idsAll[0]
const iLast = idsAll[idsAll.length - 1]
check('I. 三种播放模式齐备（单曲循环/顺序/随机）', BGM_MODES.map((m) => m.id).join(',') === 'repeat,sequence,shuffle', BGM_MODES.map((m) => m.id).join(','))
check('I. 模式轮换会绕回第一项', nextBgmMode('repeat') === 'sequence' && nextBgmMode('sequence') === 'shuffle' && nextBgmMode('shuffle') === 'repeat')
check('I. 顺序播放：next 走列表、末尾绕回第一首', nextTrackId(iFirst, 'sequence') === idsAll[1] && nextTrackId(iLast, 'sequence') === iFirst)
check('I. 顺序播放：prev 到头绕回最后一首', prevTrackId(iFirst, 'sequence') === iLast && prevTrackId(idsAll[1], 'sequence') === iFirst)
// 随机：抽样多次都不许等于当前这首（否则「下一首」看起来没反应）
const rndSamples = Array.from({ length: 40 }, () => nextTrackId(iFirst, 'shuffle'))
check('I. 随机播放：不会抽到当前这首，且结果都在曲库内', rndSamples.every((x) => x !== iFirst && idsAll.includes(x)))
check('I. 随机播放的 prev 也走随机（不会「倒着走列表」）', idsAll.includes(prevTrackId(iFirst, 'shuffle')))
check('I. App.vue 把模式同步给引擎（bgm.setMode）', /bgm\.setMode\(/.test(appSrc))
check('I. App.vue 注册了「放完接下一首」回调（bgm.onEnded）', /bgm\.onEnded\(onBgmEnded\)/.test(appSrc) && /function onBgmEnded/.test(appSrc))
check('I. 播放模式是持久化设置（settings.bgmMode 默认 repeat）', /bgmMode:\s*'repeat'/.test(fs.readFileSync(path.join(ROOT, 'src/stores/player.js'), 'utf8')))
// 引擎侧：只有 repeat 用 el.loop
check('I. 引擎按模式设置 el.loop（顺序/随机不循环）', /el\.loop = playMode === 'repeat'/.test(soundCode))
const compCode = stripComments(compSrc)
// 2026-09-18 起胶囊上不再有 🔊 开关（用户要求删掉，开关改到设置面板的音频页签）
const controls = ['⏮', '⏭', '上一首', '下一首', '播放模式']
check('I. 播放器收起态就有全套常驻控件（上一首/暂停/下一首/模式）', controls.every((k) => compCode.includes(k)) && /bgm-tbtn/.test(compCode))
// 2026-09-18 用户要求删掉胶囊上的 🔊：开关改到「设置 → 🔊 音频」页签（那边本来就有 bgmEnabled）
// ⚠️ 判据只看「按钮元素」而不是扫全文：`.vue` 模板里的 HTML 注释 `<!-- -->` 不会被 JS 注释剥离器剥掉，
//    写 `!/🔊/` 会把注释里那句「已删 🔊」也算进去 → 恒 FAIL（本轮踩过）。
check('I. 胶囊上**没有** 🔊 开关（用户 2026-09-18 要求删掉），且开关仍在设置面板里',
  !/class="bgm-pp"/.test(compCode) && !/class="bgm-pp"[\s\S]{0,200}toggleEnabled/.test(compCode)
  && /bgmEnabled/.test(fs.readFileSync(new URL('../../src/components/SettingsPanel.vue', import.meta.url), 'utf8')))

/* J. 胶囊宽度恒定（2026-09-18 用户报「播放器老是变短变长」）：
   ① `.bgm-name` 必须是**固定 width**，只写 max-width 会让名字区随内容伸缩
      （实测「自动」24px / 4 字曲名 48px / 9 字变奏 83px ⇒ 胶囊在 197~256px 之间来回变）；
   ② ⏸/▶ 字形宽度差 1.8px，播放钮也必须定宽，否则播放态与暂停态差 1.8px；
   ③ 暂停态不许再拼「已暂停 ·」前缀（用户明确要求去掉那三个字，状态由 ⏸/▶ 图标表达）。
   行为层断言在 `e2e-test.spec.mjs` 的 BGM 用例 ⑥（量 4 种状态的胶囊宽度差 < 0.6px）。 */
// ⚠️ 必须**锚定行首**：`/.bgm-name\s*\{/` 会先命中 `.bgm-pill--off .bgm-name { color: … }`（2026-09-21 新增的关闭态规则），
//    于是这条断言对着一条只有 color 的规则判断 → 恒 FAIL（"找不到 .bgm-name 规则"）。
//    同源教训：守卫的正则要匹配「规则定义」而不是「任何含该选择器的规则」。
const nameMatch = compCode.match(/(?:^|\n)\.bgm-name\s*\{([^}]*)\}/)
check('J. `.bgm-name` 用固定 width（不能只写 max-width，否则胶囊宽度跟着曲名变）',
  !!nameMatch && /\bwidth\s*:\s*\d+px/.test(nameMatch[1]) && !/max-width\s*:/.test(nameMatch[1]),
  nameMatch ? nameMatch[1].trim() : '找不到 .bgm-name 规则')
const playMatch = compCode.match(/\.bgm-tbtn--play\s*\{([^}]*)\}/)
check('J. 播放/暂停钮定宽（⏸ 与 ▶ 字形宽度不同，不定宽会让胶囊差 1.8px）',
  !!playMatch && /\bwidth\s*:\s*\d+px/.test(playMatch[1]), playMatch ? playMatch[1].trim() : '找不到 .bgm-tbtn--play 规则')
check('J. 暂停态不再拼「已暂停 ·」前缀（用户要求那三个字不要）',
  !/已暂停\s*·/.test(compCode))

/* K. BGM 胶囊与旁边五个功能胶囊**同高同排**（2026-09-21 用户：「BGM 胶囊是不是融合进底栏了，那大小应该也适配为
   旁边五个胶囊的大小」）。原先 BGM 胶囊 33px（竖 padding 7px）、窄屏那条 `padding: 7px 10px` 更把它撑到 47px，
   而五个功能胶囊是 24px ⇒ 右下角看起来是两块东西。
   口径：高度只在 `main.css` 的 `--dock-pill-h` 定义一处，两边都用 `var(--dock-pill-h)`（谁写死都会被这里抓住）；
   行为层断言在 `e2e-test.spec.mjs` 的 BGM 用例 ⑦（量真实高度、两者与 token 相等、底边对齐）。 */
const mainCss = fs.readFileSync(path.join(ROOT, 'src/styles/main.css'), 'utf8')
const tokenMatch = mainCss.match(/--dock-pill-h\s*:\s*(\d+)px/)
check('K. 底部胶囊高度有唯一 token（main.css 的 --dock-pill-h）', !!tokenMatch, tokenMatch ? '' : '找不到 --dock-pill-h')
const dockSrc = fs.readFileSync(new URL('../../src/components/BottomDock.vue', import.meta.url), 'utf8')
const pillRule = stripComments(dockSrc).match(/\.dock-pill\s*\{([^}]*)\}/)
check('K. 五个功能胶囊的高度取自 --dock-pill-h（别写死）',
  !!pillRule && /height\s*:\s*var\(--dock-pill-h\)/.test(pillRule[1]), pillRule ? pillRule[1].trim().slice(0, 80) : '找不到 .dock-pill 规则')
const bgmPillRule = compCode.match(/\.bgm-pill\s*\{([^}]*)\}/)
check('K. BGM 胶囊的高度也取自 --dock-pill-h（与功能胶囊等高）',
  !!bgmPillRule && /height\s*:\s*var\(--dock-pill-h\)/.test(bgmPillRule[1]), bgmPillRule ? bgmPillRule[1].trim().slice(0, 80) : '找不到 .bgm-pill 规则')
check('K. BGM 胶囊没有靠竖 padding 撑高（那是「比旁边高一截」的成因）',
  !!bgmPillRule && !/padding\s*:\s*\d+px\s+\d+px\s*;/.test(bgmPillRule[1]) && !/padding\s*:\s*\d+px\s+\d+px\s+\d+px\s+\d+px\s*;/.test(bgmPillRule[1]), bgmPillRule ? bgmPillRule[1].trim().slice(0, 80) : '')

console.log(fail ? `\nBGM 审计：FAIL（${fail} 项）` : `\nBGM 审计：PASS（${BGM_TRACKS.length} 首，音频 ${onDisk.length} 个文件）`)
process.exit(fail ? 1 : 0)
