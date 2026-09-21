// 小游戏 UI 标准 · 静态合规检查（27 款 × 13 项）
// 逐款检查：顶栏 / 模式胶囊 / 选中态 / 状态胶囊 / 说明按钮与弹窗 / 通用规则框 / 开始门控 / 结算弹窗 / 无提示行 / 深色适配 / 音效单例 / 卸载清理。
// 例外（见标准 §10）：火候炉无开始门控/结算弹窗；大胃王开始按钮类名为 .fs-btn。
// 2026-09-21 新增两项「资源与生命周期」检查：音效单例（不许自建 AudioContext）、卸载清理（定时器/循环必须清）。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { stripComments } from './lib/comments.mjs' // 三态剥注释（字符串/行注释/块注释），防注释把文本检查骗成假绿

const root = join(dirname(fileURLToPath(import.meta.url)), '../..') // 上浮两层：scripts/ci → 仓库根（2026-09-10 归类后）
const dir = join(root, 'src/views/minigames/')
const css = readFileSync(join(root, 'src/styles/main.css'), 'utf8')
const GAMES = [
  ['HeatView', '火候炉', 'hz'], ['TriviaView', '讲堂', 'tv'], ['Kitchen2048View', '2048', 'g2048'], ['FoodRushView', '大胃王', 'fs'],
  ['PuzzleView', '拼图', 'pz'], ['MatchFoodView', '连连看', 'mf'], ['MemoryView', '翻牌', 'mm'], ['SnakeView', '贪吃蛇', 'sn'],
  ['PacmanView', '吃豆人', 'pm'], ['Match3View', '消消乐', 'm3'], ['FlappyBirdView', '笨鸟先飞', 'fb'], ['Match10View', '凑凑消', 'm10'],
  ['FruitMergeView', '水果合成', 'fm'], ['FruitStackView', '果了个果', 'gg'], ['FishingView', '垂钓渔翁', 'fh'], ['SliceView', '切菜大师', 'sk'],
  ['WhackView', '打地鼠', 'wk'], ['SlideView', '摆盘', 'sl'], ['PipeView', '接汤', 'pp'], ['DinerView', '传菜', 'dn'],
  ['TetrisView', '方块', 'tt'], ['MinesweeperView', '扫雷', 'ms'], ['IceSlideView', '滑冰', 'ic'], ['CurlingView', '汤圆冰壶', 'cu'],
  ['GuessDishView', '猜菜名', 'gd'], ['SudokuView', '调味表', 'su'], ['SequenceView', '上菜顺序', 'sv'],
]
// 例外白名单：游戏名 → 跳过的检查项
const EXCEPTIONS = { 火候炉: ['开始门控', '结算弹窗'] }

const ruleOf = (style, sel) => {
  const i = style.indexOf(sel + ' {')
  return i < 0 ? null : style.slice(i, style.indexOf('}', i) + 1)
}
const has = (txt, re) => (txt ? re.test(txt) : false)
// 注：标准里的颜色已全部 token 化（v2.1 皮肤要能覆盖）——断言要求写 token（如 rgba(var(--panel-rgb), 0.8)）而非字面色值。
const checks = [
  ['顶栏', (s, tpl, pre) => new RegExp('class="' + pre + '-topbar"').test(tpl) && /模式说明/.test(tpl)],
  ['模式胶囊', (s, tpl, pre, style) => { const r = ruleOf(style, '.' + pre + '-mode'); return has(r, /padding: 5px 12px/) && has(r, /font-size: 12px/) && has(r, /border-radius: 999px/) && has(r, /1px dashed rgba\(var\(--tint-rgb\), 0\.4\)/) && has(r, /rgba\(var\(--panel-rgb\), 0\.8\)/) && has(r, /var\(--muted\)/) }],
  ['选中态', (s, tpl, pre, style) => has(ruleOf(style, '.' + pre + '-mode.on'), /rgba\(var\(--primary-tint-rgb\), 0\.14\)/) && has(ruleOf(style, '.' + pre + '-mode.on'), /var\(--primary-strong\)/)],
  ['状态胶囊', (s, tpl, pre, style) => { const r = ruleOf(style, '.' + pre + '-chip'); return has(r, /padding: 5px 12px/) && has(r, /font-weight: 700/) && has(r, /rgba\(var\(--panel-rgb\), 0\.8\)/) }],
  ['说明按钮', (s, tpl, pre, style) => has(ruleOf(style, '.' + pre + '-info-btn'), /linear-gradient\(135deg, #72b864, #589c4b\)/)],
  ['说明弹窗', (s, tpl, pre, style) => { const r = ruleOf(style, '.' + pre + '-info-box'); return has(r, /min\(620px, 92vw\)/) && has(r, /rgba\(var\(--panel-rgb\), 0\.94\)/) && has(r, /border-radius: 16px/) }],
  ['通用规则框', (s, tpl, pre, style) => { const r = ruleOf(style, '.' + pre + '-info-rule'); return has(r, /rgba\(114, 184, 100, 0\.1\)/) && has(r, /var\(--text\)/) && has(r, /font-size: 12\.5px/) }],
  ['开始门控', (s, tpl, pre) => new RegExp('class="' + pre + '-start"').test(tpl) || (pre === 'fs' && /▶ 开始游戏/.test(tpl))],
  ['结算弹窗', (s, tpl, pre) => new RegExp(pre + '-mask').test(tpl) && new RegExp(pre + '-result').test(tpl) && new RegExp(pre + '-again').test(tpl)],
  ['无提示行', (s, tpl, pre) => !new RegExp('<div[^>]*class="' + pre + '-hint"').test(tpl) && !/hint\.value/.test(s)],
  ['深色适配', (s, tpl, pre) => new RegExp("data-theme='dark'][^{]*\\.mg-shell \\.(" + pre + "-mode|" + pre + "-chip)").test(css)],
  // ── 以下两条是「资源与生命周期」守卫（2026-09-21 立，两处真实缺陷都曾长期潜伏）──
  // ① 音效必须走共用单例 game/core/minigameAudio.js：原先 15 个页各自 `new AudioContext()` 且从不 close，
  //    凑凑消更是「每响一声新建一个」（实测一局 created 57 / closed 0）；JS 堆不增长 ⇒ 看内存的守卫都发现不了。
  ['音效单例', (s) => !/new\s*\(?\s*window\.AudioContext/.test(s)],
  // ② 用了定时器/动画循环就必须在卸载时清理：大胃王原先没有 onUnmounted ⇒ 离场后 setInterval 照跑、
  //    到点仍 finish() 结算发币；吃豆人的 onUnmounted 只摘了 keydown、没停 rAF ⇒ 无鬼模式永久 60fps 空转。
  //    ⚠️ 判断前先剥注释：这是**文本检查**，注释里提一句 onUnmounted 就会假绿（本项目有先例）。
  ['卸载清理', (s) => {
    const code = stripComments(s)
    if (!/setInterval|requestAnimationFrame/.test(code)) return true
    if (!/onUnmounted\s*\(|onBeforeUnmount\s*\(/.test(code)) return false
    return /clearInterval|cancelAnimationFrame/.test(code)
  }],
]
const rows = []
for (const [file, name, pre] of GAMES) {
  const s = readFileSync(dir + file + '.vue', 'utf8')
  const tpl = s.slice(s.indexOf('<template>'), s.lastIndexOf('</template>'))
  const style = s.slice(s.indexOf('<style'))
  const skip = EXCEPTIONS[name] || []
  const fails = []
  for (const [label, fn] of checks) {
    if (skip.includes(label)) continue
    try { if (!fn(s, tpl, pre, style)) fails.push(label) } catch { fails.push(label + '!') }
  }
  rows.push({ name, fails })
}
const pad = (x, n) => String(x).padEnd(n)
console.log('小游戏 UI 合规检查（逐款 13 项）\n')
console.log(pad('游戏', 10) + checks.map(([l]) => pad(l, 9)).join(''))
for (const r of rows) {
  const skip = EXCEPTIONS[r.name] || []
  const cells = checks.map(([l]) => pad(skip.includes(l) ? '—' : r.fails.includes(l) ? '✗' : r.fails.includes(l + '!') ? '?' : '✓', 9)).join('')
  console.log(pad(r.name, 10) + cells + (r.fails.length ? '   ← ' + r.fails.join('、') : ''))
}
const bad = rows.reduce((a, r) => a + r.fails.length, 0)
console.log('\n失败合计：' + bad + (bad ? '' : '（全部合规）'))
process.exit(bad ? 1 : 0)
