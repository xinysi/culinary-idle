// 荣誉殿堂（2026-09-10 新增）— 把既有的 76 个称号从「纯展示」变成「有被动」。
// 设计约束（纯读取层）：
//   ① 称号数据本身（名称/来源）一律不改，本模块只做「名称 → 被动」的映射与荣誉等级推导；
//   ② 被动只接既有聚合点（技能经验 / 采集产量 / 制作成功率 / 餐厅与分店收入），不新增数值层；
//   ③ 称号数 = 成就称号 69（ALL_ACHIEVEMENTS 里带 title 的项）+ 游戏商店称号 7。
import { ACHIEVEMENT_TITLES, SHOP_TITLES, CODEX_SHOP_TITLES } from './titles.js'

/** 每个称号的被动数值（百分比） */
export const TITLE_PERK_VALUE = 2
/** 荣誉等级上限（0 级 = 尚无荣誉） */
export const HONOR_MAX_LEVEL = 9
/** 每拥有多少个称号升 1 级荣誉 */
export const HONOR_PER_LEVEL = 8

/** 四条被动通道（只读既有聚合点，不碰对决数值曲线） */
export const HONOR_STATS = {
  xpPct: { id: 'xpPct', name: '全技能经验', icon: '📖', desc: '所有技能获得的经验' },
  gatherPct: { id: 'gatherPct', name: '采集产量', icon: '🌾', desc: '采摘/垂钓/狩猎/挖掘/农耕的额外产量概率' },
  craftPct: { id: 'craftPct', name: '制作成功率', icon: '🍳', desc: '各制作技能的配方成功率' },
  goldPct: { id: 'goldPct', name: '经营收入', icon: '💰', desc: '餐厅与分店的每小时收入' },
}

/** 称号名 → 被动通道（按关键词确定性映射；同一称号永远得到同一条） */
const PERK_RULES = [
  { stat: 'goldPct', re: /商|贾|富|财|金|钱|豪|酒|杯|满汉|膳|宴|馆|楼|掌柜|老板/ },
  { stat: 'gatherPct', re: /采|摘|钓|渔|猎|捕|挖|掘|矿|农|耕|种|牧|野|山|海|林|园/ },
  { stat: 'craftPct', re: /厨|刀|火|烹|烤|焙|腌|酿|调|味|菜|食|甜|面|汤|蒸|炸|炖|摆盘|佐|料/ },
  { stat: 'xpPct', re: /学|知|博|典|藏|编|史|书|谱|图|鉴|师|宗|匠|家|者|主|神|王|帝|尊/ },
]
const DEFAULT_STAT = 'xpPct'

/** 某称号的被动通道（未知称号 → 全技能经验） */
export function perkStatOf(titleName) {
  for (const r of PERK_RULES) if (r.re.test(titleName || '')) return r.stat
  return DEFAULT_STAT
}

/** 某称号的被动：{ stat, value, label } */
export function perkOf(titleName) {
  const stat = perkStatOf(titleName)
  return { stat, value: TITLE_PERK_VALUE, label: `${HONOR_STATS[stat].name} +${TITLE_PERK_VALUE}%` }
}

/** 全部称号条目（含来源与被动），供页面展示；owned 由调用方补齐 */
export const ALL_TITLES = [
  ...ACHIEVEMENT_TITLES.map((t) => ({
    id: `ach:${t.id}`,
    name: t.name,
    desc: t.desc,
    from: '成就',
    achName: t.achName,
    achId: t.id,
  })),
  ...SHOP_TITLES.map((t) => ({
    id: `shop:${t.key}`,
    name: t.name,
    desc: '游戏商店购买',
    from: '商店',
    shopKey: t.key,
    icon: t.icon,
  })),
  ...CODEX_SHOP_TITLES.map((t) => ({
    id: `codex:${t.key}`,
    name: t.name,
    desc: t.desc ?? '图鉴兑换所兑换',
    from: '图鉴',
    codexKey: t.key,
  })),
]

export const TITLE_TOTAL = ALL_TITLES.length

/** 荣誉等级（拥有称号数 → 0..9） */
export function honorLevelOf(ownedCount) {
  return Math.min(HONOR_MAX_LEVEL, Math.floor(Math.max(0, ownedCount) / HONOR_PER_LEVEL))
}

/** 升到下一级荣誉还需要的称号数（已满级返回 null） */
export function honorNextNeed(ownedCount) {
  const lv = honorLevelOf(ownedCount)
  if (lv >= HONOR_MAX_LEVEL) return null
  return (lv + 1) * HONOR_PER_LEVEL - ownedCount
}

/** 荣誉等级进度（当前级内已拥有 / 本级所需） */
export function honorLevelProgress(ownedCount) {
  const lv = honorLevelOf(ownedCount)
  if (lv >= HONOR_MAX_LEVEL) return { level: lv, have: ownedCount, need: ownedCount, pct: 1 }
  const base = lv * HONOR_PER_LEVEL
  const need = HONOR_PER_LEVEL
  return { level: lv, have: ownedCount - base, need, pct: Math.min(1, (ownedCount - base) / need) }
}

/**
 * 汇总荣誉效果：{ level, owned, perks: { xpPct, gatherPct, craftPct, goldPct }, equipped, perTitle }
 * - 佩戴的称号：其所在通道 +TITLE_PERK_VALUE%
 * - 荣誉等级：每级四条通道各 +1%
 */
export function honorBonuses({ equipped = null, ownedTitles = [] } = {}) {
  const perks = { xpPct: 0, gatherPct: 0, craftPct: 0, goldPct: 0 }
  const level = honorLevelOf(ownedTitles.length)
  for (const k of Object.keys(perks)) perks[k] += level // 每级 +1%
  let perTitle = null
  if (equipped && ownedTitles.includes(equipped)) {
    perTitle = perkOf(equipped)
    perks[perTitle.stat] += perTitle.value
  }
  return { level, owned: ownedTitles.length, perks, equipped, perTitle }
}
