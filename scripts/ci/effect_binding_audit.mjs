// 效果登记表 ↔ player store 绑定审计（2026-09-28 立，CI 亦执行）
//
// 背景：2026-09-28 全量体检在 `src/game/data/activeEffects.js`（「效果总览」的 105 行登记表）里抓到一处**真缺陷**：
//      `同时可接 ${p.takeoutConcurrency?.() ?? 1} 单`
//   —— `takeoutConcurrency` 是 `takeout.js` 的**纯函数**（`takeoutConcurrency(level)`），player store 上**根本没有**
//   这个方法名。可选链 `?.()` 把「方法不存在」静默吃成 `undefined` ⇒ 永远回落成 **1** ⇒
//   外卖 10 级的玩家在「效果总览」里看到的仍是「同时可接 1 单」。这正是本项目最忌讳的「显示与结算不一致」。
//
// 为什么现有守卫抓不到：`template_binding_audit` 问的是**模板里**用了没定义的名字（`_ctx.X`，靠编译器），
//   而这里是**数据模块里的 JS**，没有编译器兜底、也没有运行时抛错（`?.()` 恰好就是「允许不存在」的写法）。
//   同一个写法在 player.js 里还有一处（`this.pushLog?.()`，已修）—— 这一族的共性见 AGENTS「静默失效五兄弟」。
//
// 本审计钉四件事：
//   A. **凡引用必存在**：`src/game/data/**` 里 `p.NAME`（p = 效果登记表/成就/年鉴等模块拿到的 player store）
//      的每个 NAME 都必须在**真实建出来的 store** 上存在 —— 判据用 `NAME in store`（不是拿源码正则自比自：
//      getter 有 `name() {`、`name: (s) => () => {` 两种写法，正则数不出来，实测 `getXpMultiplier` 就被漏判过）
//   B. **扫描器自证**：解析到的引用条数不得骤低（否则 A 会因为「一条都没解析到」而恒真 —— 假绿）
//   C. **具体回归点**：`p.takeoutConcurrency` 不许回来；该行必须走 `takeout.js` 的纯函数并**带上等级**
//   D. **同族写法也点名**：`this.NAME?.()` 这种「store 内部自引用不存在的成员」在本文件（player.js）里筛查
//
// 反例验证：`node scripts/dev/verify_binding.mjs`（把那一行改回 `p.takeoutConcurrency?.() ?? 1` ⇒ A/C 各自 FAIL 并点名）。
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createPinia, setActivePinia } from 'pinia'
import { stripComments, stripHtmlComments } from './lib/comments.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const fails = []
const ok = []
const check = (name, cond, detail = '') => (cond ? ok.push(name) : fails.push(`${name}${detail ? '  ← ' + detail : ''}`))

// ── 浏览器垫片 + 真实 store（与 continuity_test / system_test 同一做法）──
const mem = new Map()
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
}
globalThis.document = { addEventListener() {}, visibilityState: 'visible' }
setActivePinia(createPinia())
const { usePlayerStore } = await import('../../src/stores/player.js')
const player = usePlayerStore()

function walk(dir, out = []) {
  for (const e of readdirSync(join(root, dir))) {
    const rel = `${dir}/${e}`
    if (statSync(join(root, rel)).isDirectory()) walk(rel, out)
    else if (e.endsWith('.js')) out.push(rel)
  }
  return out
}
const read = (p) => stripHtmlComments(stripComments(readFileSync(join(root, p), 'utf8')))

// ── A. 凡引用必存在 ──
// 🔴 **范围必须先界定**：`p` 在数据层有两个完全不同的身份 ——
//   · **player store**：注册表的回调参数（`read: (p) =>` / `check: (p) =>`）—— 本次要审的就是它
//   · **普通数据对象**：`p.id` / `p.icon` / `p.tier` 这类（洗 DATA 数组时的局部变量）
//   不界定就会误报（实测 10 个文件、24 个名字：daoGraph 的 p.desc、guilds 的 p.xpPct、explorationGear 的 p.slot …）。
//   界定方式**不是猜**：把 `p` 当 store 的 8 个文件，其 `p.NAME` **100% 能在真实 store 上找到**；
//   其余 10 个文件至少有一个名字在 store 上不存在（≈5 条引用以内，一眼可辨）。
//   下方 A2 是**强制归类**条款：新出现的「p 引用 ≥10 条」的数据文件必须显式登记进这份名单 ——
//   否则它会静静地落在扫描范围之外（本项目对 materialCost 的允许清单用的是同一手法）。
const STORE_P_FILES = [
  'src/game/data/activeEffects.js',      // 效果总览 105 行登记表（本轮抓到 bug 的地方）
  'src/game/data/achievements.js',
  'src/game/data/achievementProgress.js',
  'src/game/data/expansions.js',
  'src/game/data/milestones.js',
  'src/game/data/story.js',
  'src/game/data/newbieChain.js',
  'src/game/data/featureGroups.js',
]
let refCount = 0
{
  const bad = []
  const perFile = new Map()
  for (const f of walk('src/game/data')) {
    const txt = read(f)
    const names = [...new Set([...txt.matchAll(/\bp\.([a-zA-Z_][a-zA-Z0-9_]*)/g)].map((m) => m[1]))]
    if (!names.length) continue
    perFile.set(f, names)
    if (!STORE_P_FILES.includes(f)) continue
    refCount += names.length
    // `in` 同时认 state / getter / action（Pinia 三者都挂在 store 实例上）
    for (const n of names) if (!(n in player)) bad.push(`${f} 的 p.${n}`)
  }
  check('A1. 登记表回调里的每个 `p.NAME` 都存在于 player store（没有 `?.()` 掩盖的错名）',
    bad.length === 0, bad.join('；'))

  // A2：强制归类 —— **不同成员名 ≥10 个**的文件必须在名单里（新注册表会顶到这条上，逼人来登记）
  // 口径是 **unique 而不是出现次数**：出现次数分不开这两族（普通数据对象里 shanhaiGraph 也有 13 次、
  // guilds 10 次），而 unique 分得很干净 —— store 族最小 10、普通对象族最大 5。
  // ⚠️ 已知边界（如实记）：新写的注册表若只用到 ≤5 个不同成员，A2 不会逼它登记 ⇒ 它不会被 A1 审。
  //    这是**刻意接受的**：唯一能自动分辨两族的静态特征就是「名字是否都在 store 上」，而那要先把文件列进来，
  //    会形成循环。所以新增注册表时**请手工**把路径加进 STORE_P_FILES（A3 会保证名单不烂）。
  const heavy = [...perFile.entries()].filter(([, ns]) => ns.length >= 10).map(([f]) => f).sort()
  const unlisted = heavy.filter((f) => !STORE_P_FILES.includes(f))
  check('A2. 凡 `p.` 用到 ≥10 个不同成员的数据文件都在 STORE_P_FILES 名单里（新注册表必须登记，否则漏审）',
    unlisted.length === 0, unlisted.length ? `未登记：${unlisted.join('、')}` : '')

  // A3：名单本身不许失效（文件改名/删了要立刻发现，否则这条守卫会静默缩小）
  const gone = STORE_P_FILES.filter((f) => !perFile.has(f))
  check('A3. STORE_P_FILES 名单里的文件都还在、都仍有 `p.` 引用', gone.length === 0, gone.join('、'))
  check('A3. 名单覆盖到的文件数 = 8（基线；少了说明有人从名单里挪走了文件）',
    STORE_P_FILES.filter((f) => perFile.has(f)).length >= 8)
}

// ── B. 扫描器自证：引用条数不得骤低 ──
check('B. 扫描器自证：解析到的 p.NAME 引用 ≥ 60 条（过少说明正则/剥注释坏掉了，A 会假绿）',
  refCount >= 60, `实际 ${refCount} 条`)

// ── C. 具体回归点：外卖并发数 ──
{
  const ae = read('src/game/data/activeEffects.js')
  check('C. 不再出现 `p.takeoutConcurrency`（store 上没有这个成员）', !/p\.takeoutConcurrency/.test(ae))
  check('C. 外卖那行从 takeout.js 引入纯函数并**带上等级**调用（takeoutConcurrency(lv)）',
    /import\s*\{[^}]*\btakeoutConcurrency\b[^}]*\}\s*from\s*'\.\/takeout\.js'/.test(ae)
    && /takeoutConcurrency\(lv\)/.test(ae))
  // 判据不能只看「文本里有没有 takeoutConcurrency」——导入但不用也会绿 ⇒ 上面两条必须成对
}

// ── D. 同族：store 内部自引用不存在的成员（`this.X?.()` 是同一族的静默写法）──
{
  const pj = read('src/stores/player.js')
  // 只查 store **自己**调用 `this.<member>(` 的形态；成员可能是 action（同文件定义）或 getter。
  // 判据同样落到真实 store 上，避免「正则数定义」的漏判。
  const selfRefs = [...new Set([...pj.matchAll(/this\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g)].map((m) => m[1]))]
  const missing = selfRefs.filter((n) => !(n in player))
  // 少数是 JS 内建/局部对象的方法（如 `this.$reset`、Map/Date 之类若出现），列出来但不许有「store 成员拼错」
  const ALLOW = new Set(['$reset', '$patch', '$state', '$id'])
  const realMissing = missing.filter((n) => !ALLOW.has(n))
  check('D. player store 里 `this.X(...)` 的成员都存在（没有靠 `?.()` 掩盖的错名）',
    realMissing.length === 0, realMissing.join('、'))
  check('D. store 自引用扫描器自证：解析到的 `this.X(` ≥ 50 处', selfRefs.length >= 50, `实际 ${selfRefs.length}`)
  // 具体回归点：pushLog 不在 player store 上（它在 ui store）
  check('D. 不再出现 `this.pushLog?.(`（pushLog 在 ui store，player 上不存在）',
    !/this\.pushLog\?\./.test(pj))
  check('D. 头像日志走 ui store 的唯一出口 useUiStore().pushLog', /useUiStore\(\)\.pushLog\('头像已更新'/.test(pj))
}

// ── 输出 ──
console.log('══ 效果登记表 ↔ player store 绑定审计（凡引用必存在）══')
for (const n of ok) console.log('  ok  ' + n)
for (const n of fails) console.log('FAIL  ' + n)
console.log(`\n解析 p.NAME 引用 ${refCount} 条`)
console.log(`通过 ${ok.length} / 失败 ${fails.length}`)
process.exit(fails.length ? 1 : 0)