// 反例验证：C67 美食探索改版（2026-09-27 用户①②③④⑤⑥ 六条）
// 用法：node scripts/dev/verify_c67.mjs   （每例跑一遍 system_test，约 25 秒；共 8 例 ⇒ 约 3.5 分钟）
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const P = (rel) => join(root, rel)
function inject(rel, from, to) {
  const orig = readFileSync(P(rel), 'utf8')
  // ⚠️ 换行符兼容：`bootstrap.js` 是 CRLF，而其它文件是 LF。多行锚点若照抄 LF，
  // 匹配数是 0 ⇒ 脚本「注入失败」被跳过（看着像通过）。这里按文件实际换行折叠一次。
  const norm = (s) => (orig.includes('\r\n') ? s.replace(/\r?\n/g, '\r\n') : s.replace(/\r?\n/g, '\n'))
  const f = norm(from)
  const t = norm(to)
  const n = orig.split(f).length - 1
  if (n !== 1) throw new Error(`${rel} 锚点匹配 ${n} 次（期望 1）：${f.slice(0, 60)}`)
  writeFileSync(P(rel), orig.replace(f, t), 'utf8')
}

const CASES = [
  {
    name: '① 段位曲线改平（末段不再归零 ⇒ 「初始成功率下降到 0%」没做到）',
    rel: 'src/game/data/explorationBalance.js',
    from: 'export const EXPLORE_BAND_DECAY = 1 / 9',
    to: 'export const EXPLORE_BAND_DECAY = 1 / 99',
    expect: '段 10 ×0.00',
  },
  {
    name: '② 成功率上限抬回 95%（用户要求 90%）',
    rel: 'src/game/data/explorationBalance.js',
    from: 'export const EXPLORE_SUCCESS_CAP = 0.9',
    to: 'export const EXPLORE_SUCCESS_CAP = 0.95',
    expect: '卡片上限 90%',
  },
  {
    name: '③ 精通不再补足成功率（末段卡片变死卡）',
    rel: 'src/game/data/explorationBalance.js',
    from: 'export const EXPLORE_MASTERY_PP_MAX = 0.6',
    to: 'export const EXPLORE_MASTERY_PP_MAX = 0',
    expect: '末段',
  },
  {
    name: '④ 精通次数退回「只在成功时加」（0% 的卡片永远练不起来）',
    rel: 'src/game/skills/ExplorationSkill.js',
    from: '    this.player.addMastery(this.id, target.id, 1)\n',
    to: '',
    expect: '失败也计精通次数',
  },
  {
    name: '⑤ 战利品系数退回 ÷2（用户要求「全面调低」）',
    rel: 'src/game/data/difficulty.js',
    from: '  exploreLoot: 0.25,',
    to: '  exploreLoot: 0.5,',
    expect: '÷4',
  },
  {
    name: '⑥ 专属装备掉率写成 1%（用户指定 0.01%）',
    rel: 'src/game/data/explorationGear.js',
    from: 'export const EXPLORE_GEAR_DROP_CHANCE = 0.0001',
    to: 'export const EXPLORE_GEAR_DROP_CHANCE = 0.01',
    expect: '0.01%',
  },
  {
    name: '⑦ 专属装备偷偷加别的属性（用户明确「只有探索成功率」）',
    rel: 'src/game/data/explorationGear.js',
    from: "stats: { exploreSuccessPP: p.exploreSuccessPP },",
    to: "stats: { exploreSuccessPP: p.exploreSuccessPP, attack: 50 },",
    expect: '只有',
  },
  {
    name: '⑧ 套装按 1 件算（合计变成 2.5/5pp，与该套「+5%/+10%」的承诺不符）',
    rel: 'src/game/data/explorationGear.js',
    from: '      { id: \'exploreGearFlavorCloak\', name: \'寻味旅披\', slot: \'body\', exploreSuccessPP: 2.5, tier: 6 },',
    to: '',
    expect: '+5pp / +10pp',
  },
  {
    name: '⑨ 强化开始放大专属成功率（单件满强化变成 10pp，破坏「第二套才 +10%」的承诺）',
    rel: 'src/stores/player.js',
    from: "* (k === 'exploreSuccessPP' ? 1 : mult)",
    to: '* mult',
    expect: '强化不放大专属成功率',
  },
  {
    name: '⑩ 混搭上限被去掉（两套混穿 12.5pp，装备面板显示的值与实际结算不一致）',
    rel: 'src/stores/player.js',
    from: 'sum.exploreSuccessPP = Math.min(10, Math.max(0, sum.exploreSuccessPP ?? 0))',
    to: 'sum.exploreSuccessPP = Math.max(0, sum.exploreSuccessPP ?? 0)',
    expect: '封在 10pp',
  },
  {
    name: '⑪ 离线不再按尝试次数结算精通（末段 0% 卡片挂机一夜精通纹丝不动 = 死卡）',
    rel: 'src/game/bootstrap.js',
    from: "    if (inst.id === 'exploration' && r.masteryAttempts > 0 && inst.currentTarget?.id) {\n      player.addMastery(inst.id, inst.currentTarget.id, r.masteryAttempts)\n    }\n",
    to: '',
    expect: '结算按尝试次数增长卡片精通',
  },
  {
    name: '⑫ 离线装备掉率改成逐件四舍五入（期望 0.6 件时一件都不掉，与在线掷骰口径脱节）',
    rel: 'src/game/skills/ExplorationSkill.js',
    from: "    const gearTotal = Math.round(actions * EXPLORE_GEAR_DROP_CHANCE)\n    for (let n = 0; n < gearTotal; n++) {\n      const gear = EXPLORE_GEAR_ITEMS[n % EXPLORE_GEAR_ITEMS.length]\n      items[gear.id] = (items[gear.id] ?? 0) + 1\n    }",
    to: "    for (const gear of EXPLORE_GEAR_ITEMS) {\n      const q = Math.round((actions * EXPLORE_GEAR_DROP_CHANCE) / EXPLORE_GEAR_ITEMS.length)\n      if (q > 0) items[gear.id] = (items[gear.id] ?? 0) + q\n    }",
    expect: '先取整「总件数」',
  },
  {
    name: '⑬ 装备掉率挪回「成功分支」内（末段 0% 的卡片永远掉不出装备）',
    rel: 'src/game/skills/ExplorationSkill.js',
    from: "    let gear = null\n    if (Math.random() < EXPLORE_GEAR_DROP_CHANCE) {\n      gear = EXPLORE_GEAR_ITEMS[Math.floor(Math.random() * EXPLORE_GEAR_ITEMS.length)]\n      this.player.gainItem(gear.id, 1)\n    }\n    const gearText = gear ? `✨${gear.name}` : null\n    if (Math.random() < this.successChance(target)) {",
    to: "    let gear = null\n    let gearText = null\n    if (Math.random() < this.successChance(target)) {\n      if (Math.random() < EXPLORE_GEAR_DROP_CHANCE) {\n        gear = EXPLORE_GEAR_ITEMS[Math.floor(Math.random() * EXPLORE_GEAR_ITEMS.length)]\n        this.player.gainItem(gear.id, 1)\n        gearText = `✨${gear.name}`\n      }",
    expect: '末段 0% 的卡片',
  },
  {
    name: '⑭ 觅珍不再剔除探索专属装备（图鉴来源又指回抽卡、0.01% 被架空）',
    rel: 'src/game/data/mijianDraws.js',
    from: " || EXPLORE_GEAR_IDS.includes(it.id)",
    to: '',
    expect: '已从觅珍全部池剔除',
  },
  {
    name: '⑮ 离线掉率基数退回「成功次数」（离线比在线少掉一半以上）',
    rel: 'src/game/skills/ExplorationSkill.js',
    from: 'const gearTotal = Math.round(actions * EXPLORE_GEAR_DROP_CHANCE)',
    to: 'const gearTotal = Math.round(ok * EXPLORE_GEAR_DROP_CHANCE)',
    expect: 'round(探索动作数 × 0.01%)',
  },
  {
    name: '⑯ 图鉴不登记「美食探索」这条来源（玩家在图鉴里找不到出处）',
    rel: 'src/game/data/itemSources.js',
    from: "for (const g of EXPLORE_GEAR_ITEMS) {\n  add(g.id, `美食探索（每次探索 ${(EXPLORE_GEAR_DROP_CHANCE * 100).toFixed(3)}% 掉落）`)\n}",
    to: '',
    expect: '图鉴来源只写「美食探索」',
  },
  {
    name: '⑰ 卡片掉落列表里删掉专属装备那一行（玩家还是「看不到」）',
    rel: 'src/views/ExplorationView.vue',
    from: '            <div class="loot-row loot-row--gear" :title="GEAR_TIP">',
    to: '            <div v-if="false" class="loot-row loot-row--gear" :title="GEAR_TIP">',
    expect: '卡片掉落列表里有一行专属装备',
  },
  {
    name: '⑱ 同业榜成长改 0（「越往后越强」不成立 —— 校验新写的那条跨 12 期断言真的会咬）',
    rel: 'src/game/data/rivals.js',
    from: 'export const RIVAL_MONTH_GROWTH = 0.06',
    to: 'export const RIVAL_MONTH_GROWTH = 0',
    expect: '跨年递增',
  },
  {
    name: '⑲ 宽卡网格的防溢出写法改坏（minmax(400px, 1fr) ⇒ 窄屏横向滚动条）',
    rel: 'src/views/ExplorationView.vue',
    from: 'grid-template-columns: repeat(auto-fill, minmax(min(400px, 100%), 1fr));',
    to: 'grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));',
    expect: '防窄屏横向溢出',
  },
  {
    name: '⑳ 窄屏不再并栏（390px 下两栏各 ~160px，掉落名与概率顶在一起）',
    rel: 'src/views/ExplorationView.vue',
    from: '  .ex-col--loot {\n    border-left: 0;\n    padding-left: 0;\n  }',
    to: '',
    expect: '并成一栏',
  },
  {
    name: '㉑ 两栏分隔线改回白色玻璃高光（浅色主题下画在白卡片上 = 看不见）',
    rel: 'src/views/ExplorationView.vue',
    from: '  border-left: 1px dashed var(--border);',
    to: '  border-left: 1px dashed rgba(var(--glass-rgb), 0.55);',
    expect: '--glass-rgb',
  },
  {
    name: '㉒ 减半标签挪回卡片头部（头部窄 ⇒ 整枚换行、同排卡片行高参差；校验 2026-09-28 改稳后的判据仍会咬）',
    rel: 'src/views/ExplorationView.vue',
    from: '<span class="dim ex-lv"',
    to: '<span class="xp-low-chip">{{ LOW_TARGET_CHIP }}</span><span class="dim ex-lv"',
    expect: '不在卡片头部',
  },
]

function run() {
  try {
    const out = execFileSync(process.execPath, ['scripts/ci/system_test.mjs'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout ?? '') + (e.stderr ?? '') }
  }
}

const backups = new Map()
let okAll = true
console.log('基线下先跑一次（应当全绿）…')
const base = run()
console.log(`${base.code === 0 && /失败 0/.test(base.out) ? '✅' : '❌'} 基线：${(base.out.match(/通过 \d+ \/ 失败 \d+/) ?? ['?'])[0]}`)
if (base.code !== 0) okAll = false

for (const c of CASES) {
  if (!backups.has(c.rel)) backups.set(c.rel, readFileSync(P(c.rel), 'utf8'))
  try { inject(c.rel, c.from, c.to) } catch (e) { console.log(`⚠ ${c.name} —— 注入失败：${e.message}`); okAll = false; continue }
  const r = run()
  const hit = r.code !== 0 && r.out.includes('FAIL') && r.out.includes(c.expect)
  console.log(`${hit ? '✅' : '❌'} ${c.name} → ${r.code === 0 ? 'system_test 仍全绿（假绿！）' : 'FAIL'}，点名含「${c.expect}」= ${r.out.includes(c.expect)}`)
  if (!hit) { okAll = false; console.log(r.out.split('\n').filter((l) => l.startsWith('FAIL')).slice(0, 4).join('\n')) }
  writeFileSync(P(c.rel), backups.get(c.rel), 'utf8')
}
for (const [rel, content] of backups) writeFileSync(P(rel), content, 'utf8')
const back = run()
const clean = back.code === 0 && /失败 0/.test(back.out)
console.log(`${clean ? '✅' : '❌'} 还原后 system_test 全绿（${(back.out.match(/通过 \d+ \/ 失败 \d+/) ?? ['?'])[0]}）`)
console.log(okAll && clean ? `\n反例验证通过：${CASES.length} 个注入缺陷全部被点名，还原后恢复全绿` : '\n反例验证失败，见上')
process.exit(okAll && clean ? 0 : 1)
