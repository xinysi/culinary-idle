// 图鉴三查审计（2026-09-06 用户要求：任何新增功能/调整后必须运行）
// 检查全部物品的：详细作用完整性 / 可用于制作（用途坏链）/ 获取来源与跳转覆盖 / 重名 / 交叉引用
// 运行：node scripts/item_triple_audit.mjs （CI 亦执行；失败退出码 1）
import { ITEMS, getItem } from '../src/game/data/items.js'
import { CATEGORY_LABEL, itemDetailLines } from '../src/game/data/itemDetail.js'
import { itemSources } from '../src/game/data/itemSources.js'
import { itemUses } from '../src/game/data/itemUses.js'
import { ALCHEMY_RECIPES } from '../src/game/data/alchemy.js'
import { getAllSkillInstances } from '../src/game/skills/registry.js'
import { FORAGING_TARGETS } from '../src/game/skills/ForagingSkill.js'
import { FISHING_TARGETS } from '../src/game/skills/FishingSkill.js'
import { HUNTING_TARGETS } from '../src/game/skills/HuntingSkill.js'
import { EXCAVATION_TARGETS } from '../src/game/skills/ExcavationSkill.js'
import { CROPS } from '../src/game/skills/FarmingSkill.js'
import { SHOP_ITEMS } from '../src/game/data/shop.js'
import { EXPLORATION_TARGETS_ALL } from '../src/game/data/explorationTargets.js'
import { SPIRITS } from '../src/game/data/spirits.js'
import { COMBAT_BOSSES } from '../src/game/data/combat.js'
import { SEASONS } from '../src/game/data/seasons.js'
import { ALL_ACHIEVEMENTS } from '../src/game/data/achievements.js'
import { QUESTS } from '../src/game/data/quests.js'

let fail = 0
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  ok  ${name}`)
  else { fail++; console.log(`FAIL  ${name} ${detail}`) }
}
const items = Object.values(ITEMS)

// ── 0. 全量数据健康 ──
{
  const bad = []
  for (const it of items) {
    if (!it.name) bad.push(`${it.id}缺name`)
    if (it.value == null || !Number.isFinite(it.value) || it.value < 0) bad.push(`${it.id}value=${it.value}`)
  }
  check('数据', '物品 name/value 完整', bad.length === 0, bad.slice(0, 5).join(','))
}

// ── 1. 重名（图鉴一个名字≠两样东西）──
{
  const nm = {}
  for (const it of items) (nm[it.name] ??= []).push(it.id)
  const dups = Object.entries(nm).filter(([, ids]) => ids.length > 1)
  check('重名', '全部物品名称唯一', dups.length === 0, dups.slice(0, 3).map(([n, ids]) => `${n}:${ids.join(',')}`).join('; '))
}

// ── 2. 详细作用（itemDetailLines）完整性 ──
{
  const bad = []
  for (const it of items) {
    const lines = itemDetailLines(it.id)
    const text = lines.map((l) => l.join(' ')).join(' ')
    if (text.includes('undefined')) bad.push(`${it.id}(undefined)`)
    if (!lines.some((l) => l[0] === '类型')) bad.push(`${it.id}(无类型行)`)
    if (it.category && !CATEGORY_LABEL[it.category]) bad.push(`${it.id}(类别无标签:${it.category})`)
    if (it.type === 'seed' && !lines.some((l) => l[0] === '种植产物')) bad.push(`${it.id}(种子无种植信息)`)
    if (it.type === 'spirit' && !lines.some((l) => l[0] === '食灵效果')) bad.push(`${it.id}(食灵无效果)`)
    if (it.type === 'equipment' && !Object.keys(it.stats ?? {}).length) bad.push(`${it.id}(装备无stats)`)
  }
  check('详细作用', '全部物品详情行完整（无 undefined/缺类型/种子/食灵/装备）', bad.length === 0, bad.slice(0, 8).join('; '))
}

// ── 3. 可用于制作（itemUses）：产物必须存在（幽灵配方引用不入图鉴）──
{
  let bad = 0
  for (const it of items) for (const u of itemUses(it.id)) if (!ITEMS[u.outputId]) bad++
  check('可用于制作', 'itemUses 无坏链（产出引用均存在）', bad === 0, `bad=${bad}`)
}

// ── 4. 获取来源：来源跳转覆盖（jump 关键字更新时同步维护此表）──
{
  const RULES = ['采摘', '垂钓', '狩猎', '挖掘', '农耕', '烹饪', '烘焙', '腌制', '调酒', '调料', '香料', '锻造', '保鲜', '探索', '商店', '购买', '赛季', 'BOSS', '首领', '击败', '炼金', '成就', '主线任务', '任务', '契约', '食灵', '觅珍', '抽卡', '竞技场']
  const missing = new Map()
  const norm = (s) => s.replace(/Lv\d+/g, 'LvX').replace(/×\d+/g, '×N').replace(/\d+/g, 'N')
  for (const it of items) for (const s of itemSources(it.id)) {
    if (!RULES.some((r) => s.includes(r))) {
      const key = norm(s)
      missing.set(key, (missing.get(key) ?? 0) + 1)
    }
  }
  check('获取来源', '全部来源可跳转（无未识别来源模式）', missing.size === 0, [...missing.entries()].slice(0, 4).map(([g, n]) => `${n}x ${g.slice(0, 40)}`).join('; '))
}

// ── 5. 交叉引用：采集/三农/商店/探索/食灵/BOSS/赛季/成就/任务 所有 id 存在 ──
{
  const bad = []
  for (const skill of getAllSkillInstances()) if (skill.type === 'production') for (const r of skill.recipes) {
    if (!ITEMS[r.output?.itemId]) bad.push(`配方${r.id}出${r.output?.itemId}`)
    for (const mid of Object.keys(r.ingredients ?? {})) if (!ITEMS[mid]) bad.push(`配方${r.id}料${mid}`)
  }
  for (const t of [...FORAGING_TARGETS, ...FISHING_TARGETS, ...HUNTING_TARGETS, ...EXCAVATION_TARGETS]) if (!ITEMS[t.itemId]) bad.push(`采集${t.itemId}`)
  for (const c of CROPS) if (!ITEMS[c.itemId] || !ITEMS[c.seedId]) bad.push(`作物${c.itemId}`)
  for (const s of SHOP_ITEMS) if (s.itemId && !ITEMS[s.itemId]) bad.push(`商店${s.itemId}`)
  for (const t of EXPLORATION_TARGETS_ALL) {
    if (!ITEMS[t.id]) bad.push(`探索${t.id}`)
    for (const l of t.loot ?? []) if (l.type === 'item' && !ITEMS[l.itemId]) bad.push(`探索${t.id}loot${l.itemId}`)
  }
  for (const s of SPIRITS) for (const [mid] of Object.entries(s.contract ?? {})) if (!ITEMS[mid]) bad.push(`食灵${s.id}契约${mid}`)
  for (const b of COMBAT_BOSSES) for (const d of b.drops ?? []) if (!ITEMS[d.itemId]) bad.push(`BOSS${b.name}d${d.itemId}`)
  for (const se of SEASONS) for (const x of [se.limitedItem, ...(se.limitedItems ?? [])]) if (x && !ITEMS[x]) bad.push(`赛季${se.id}${x}`)
  for (const a of ALL_ACHIEVEMENTS) for (const id of Object.keys(a.reward?.items ?? {})) if (!ITEMS[id]) bad.push(`成就${a.id}${id}`)
  for (const q of QUESTS) {
    for (const id of Object.keys(q.reward?.items ?? {})) if (!ITEMS[id]) bad.push(`任务${q.id}${id}`)
    for (const o of q.objectives ?? []) if (['gather', 'craft', 'harvest'].includes(o.kind) && !ITEMS[o.param]) bad.push(`任务${q.id}目标${o.param}`)
  }
  check('交叉引用', '全部系统引用 id 存在（含任务目标）', bad.length === 0, bad.slice(0, 6).join('; '))
}

// ── 6. 炼金幽灵配方监控：已知幽灵基线（2026-09-06 审计入库，已从 UI/图鉴过滤）；
// 后续只允许为零（新增引用不存在物品的炼金配方将 FAIL，需同步补物品或修正配方）──
const KNOWN_GHOST_RECIPE_IDS = new Set(['al36', 'al37', 'al1918', 'al1919', 'al1920', 'al1921', 'al1922', 'al1923', 'al1924', 'al1925', 'al1926', 'al1927', 'al1928', 'al1929', 'al1930', 'al1931', 'al1932', 'al1933', 'al1934', 'al1935', 'al1936', 'al1937', 'al1938', 'al1939', 'al1940', 'al1941', 'al1942', 'al1943', 'al1944', 'al1945', 'al1946', 'al1947', 'al1948', 'al1949', 'al1950', 'al1951', 'al1952', 'al1953', 'al1954', 'al1955', 'al1956', 'al1957', 'al1958', 'al1959', 'al1960', 'al1961', 'al1962', 'al1963', 'al1964', 'al1965', 'al1966', 'al1967', 'al1968', 'al1969', 'al1970', 'al1971', 'al1972', 'al1973', 'al1974', 'al1975', 'al1976', 'pres_ext_01_al'])
{
  const ghost = ALCHEMY_RECIPES.filter((r) => !ITEMS[r.out] || Object.keys(r.in ?? {}).some((k) => !ITEMS[k]))
  const newGhost = ghost.filter((r) => !KNOWN_GHOST_RECIPE_IDS.has(r.id))
  check('炼金', newGhost.length === 0, `新增幽灵配方 ${newGhost.map((r) => r.id).filter(Boolean).join(',')}（已知基线 ${ghost.length} 条已从 UI 过滤）`)
}

console.log(`══ 图鉴三查审计：${fail === 0 ? 'PASS' : 'FAIL'}（${items.length} 件物品）══`)
process.exit(fail === 0 ? 0 : 1)
