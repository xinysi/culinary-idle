// 小游戏 UI 标准 · 静态合规检查（24 款 × 11 项）
// 标准见《小游戏UI标准.md》§11。用法：node scripts/minigame_ui_audit.mjs
// 例外（见标准 §10）：火候炉无开始门控/结算弹窗；大胃王开始按钮类名为 .fs-btn。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(root, 'src/views/')
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
const checks = [
  ['顶栏', (s, tpl, pre) => new RegExp('class="' + pre + '-topbar"').test(tpl) && /模式说明/.test(tpl)],
  ['模式胶囊', (s, tpl, pre, style) => { const r = ruleOf(style, '.' + pre + '-mode'); return has(r, /padding: 5px 12px/) && has(r, /font-size: 12px/) && has(r, /border-radius: 999px/) && has(r, /1px dashed rgba\(150, 110, 70, 0\.4\)/) && has(r, /rgba\(255, 252, 246, 0\.8\)/) && has(r, /var\(--muted\)/) }],
  ['选中态', (s, tpl, pre, style) => has(ruleOf(style, '.' + pre + '-mode.on'), /rgba\(217, 90, 56, 0\.14\)/) && has(ruleOf(style, '.' + pre + '-mode.on'), /var\(--primary-strong\)/)],
  ['状态胶囊', (s, tpl, pre, style) => { const r = ruleOf(style, '.' + pre + '-chip'); return has(r, /padding: 5px 12px/) && has(r, /font-weight: 700/) && has(r, /rgba\(255, 252, 246, 0\.8\)/) }],
  ['说明按钮', (s, tpl, pre, style) => has(ruleOf(style, '.' + pre + '-info-btn'), /linear-gradient\(135deg, #72b864, #589c4b\)/)],
  ['说明弹窗', (s, tpl, pre, style) => { const r = ruleOf(style, '.' + pre + '-info-box'); return has(r, /min\(620px, 92vw\)/) && has(r, /rgba\(255, 252, 246, 0\.94\)/) && has(r, /border-radius: 16px/) }],
  ['通用规则框', (s, tpl, pre, style) => { const r = ruleOf(style, '.' + pre + '-info-rule'); return has(r, /rgba\(114, 184, 100, 0\.1\)/) && has(r, /var\(--text\)/) && has(r, /font-size: 12\.5px/) }],
  ['开始门控', (s, tpl, pre) => new RegExp('class="' + pre + '-start"').test(tpl) || (pre === 'fs' && /▶ 开始游戏/.test(tpl))],
  ['结算弹窗', (s, tpl, pre) => new RegExp(pre + '-mask').test(tpl) && new RegExp(pre + '-result').test(tpl) && new RegExp(pre + '-again').test(tpl)],
  ['无提示行', (s, tpl, pre) => !new RegExp('<div[^>]*class="' + pre + '-hint"').test(tpl) && !/hint\.value/.test(s)],
  ['深色适配', (s, tpl, pre) => new RegExp("data-theme='dark'][^{]*\\.mg-shell \\.(" + pre + "-mode|" + pre + "-chip)").test(css)],
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
console.log('小游戏 UI 合规检查（标准见《小游戏UI标准.md》）\n')
console.log(pad('游戏', 10) + checks.map(([l]) => pad(l, 9)).join(''))
for (const r of rows) {
  const skip = EXCEPTIONS[r.name] || []
  const cells = checks.map(([l]) => pad(skip.includes(l) ? '—' : r.fails.includes(l) ? '✗' : r.fails.includes(l + '!') ? '?' : '✓', 9)).join('')
  console.log(pad(r.name, 10) + cells + (r.fails.length ? '   ← ' + r.fails.join('、') : ''))
}
const bad = rows.reduce((a, r) => a + r.fails.length, 0)
console.log('\n失败合计：' + bad + (bad ? '' : '（全部合规）'))
process.exit(bad ? 1 : 0)
