// 物品获取来源索引 — 图鉴悬浮详情用
// 运行时反查：采集目标/制作食谱/农耕/商店/探索/赛季/BOSS掉落/食灵契约/成就/任务/附产物
import { FORAGING_TARGETS } from '../skills/ForagingSkill.js'
import { FISHING_TARGETS } from '../skills/FishingSkill.js'
import { HUNTING_TARGETS } from '../skills/HuntingSkill.js'
import { isMineralTarget, EXCAVATION_TARGETS, EXCAVATION_GROUND_TARGETS, MINING_TARGETS } from '../skills/ExcavationSkill.js'
import { WOODCUTTING_TARGETS } from './timbers.js'
import { CROPS } from '../skills/FarmingSkill.js'
import { COOKING_RECIPES } from '../skills/CookingSkill.js'
import { BAKING_RECIPES } from '../skills/BakingSkill.js'
import { PRESERVING_RECIPES } from '../skills/PreservingSkill.js'
import { BREWING_RECIPES } from '../skills/BrewingSkill.js'
import { SPICE_RECIPES } from '../skills/SpiceMixingSkill.js'
import { SMITHING_SET_RECIPES } from './smithSetExt.js'
import { PRESERVATION_RECIPES } from '../skills/PreservationSkill.js'
import { EXPLORATION_TARGETS_ALL } from './explorationTargets.js'
import { GATHERING_EXT, PRODUCTION_EXT, SMITHING_EXT, PRESERVE_EXT } from './expansion1.js'
import { GATHERING_EXT2, PRODUCTION_EXT2, SMITHING_EXT2, PRESERVE_EXT2 } from './expansion2.js'
import { SHOP_ITEMS } from './shop.js'
import { ALCHEMY_RECIPES } from './alchemy.js'
import { getItem, ITEMS } from './items.js'
import { MIJIAN_POOLS, poolItems, mijianPoolVersion } from './mijianDraws.js'
import { ENCOUNTERS } from './encounters.js'
import { COMBAT_BOSSES } from './combat.js'
import { SEASONS } from './seasons.js'
import { seasonTiers } from './seasonContent.js'
import { SPIRITS } from './spiritTiers.js'
import { ALL_ACHIEVEMENTS } from './achievements.js'
import { QUESTS } from './quests.js'
import { RARE_POOL, SEED_POOL, INGREDIENT_POOL, FOOD_POOL, SPICE_POOL, MINERAL_POOL } from './gameShopPools.js'
import { EXPEDITIONS } from './expeditions.js'
import { RANCH_ANIMALS } from './ranch.js'
import { HONEY_TIERS } from './honey.js'
import { ESSENCE_TIERS } from './essences.js'
import { PRIME_CROP_ID } from './primeCrop.js'
import { MUSHROOM_MEDIA } from './mushroomHouse.js'
import { SPIRIT_PLANTS } from './spiritField.js'
import { POND_FISH } from './ranch.js'
import { EXCHANGE_POOL_CATEGORIES } from './exchange.js'
import { SUPPLIERS, SUPPLIER_PRICE_MULT } from './suppliers.js'
import { REGIONS } from './regions.js'
import { MASCOTS } from './mascots.js'
import { CHEFS, chefReward } from './chefChallenges.js'
import { CODEX_REWARDS } from './codexShop.js'

const SOURCES = {}
const add = (id, src) => {
  if (!id) return
  ;(SOURCES[id] ??= []).push(src)
}

// 采集（基础 + 扩充）
// v2.7.0：矿物独立为「采矿」、新增「伐木」——挖掘改为只列**地面目标**（根茎/菌类），
// 矿物走采矿、木材走伐木；新增来源串「采矿获得」「伐木获得」必须在 sourceJump.js 里有跳转规则（审计会查）。
const GATHER = [
  [FORAGING_TARGETS, '采摘'],
  [FISHING_TARGETS, '垂钓'],
  [HUNTING_TARGETS, '狩猎'],
  [EXCAVATION_GROUND_TARGETS, '挖掘'],
  [MINING_TARGETS, '采矿'],
  [WOODCUTTING_TARGETS, '伐木'],
]
for (const [arr, name] of GATHER) for (const t of arr) add(t.itemId, `${name}获得（Lv${t.reqLevel} 解锁）`)
// 扩充目标（ext/ext2）里：挖掘只登记**非矿物**，其余（矿物）归采矿
for (const [skill, name, keep] of [['foraging', '采摘', null], ['fishing', '垂钓', null], ['hunting', '狩猎', null], ['excavation', '挖掘', (t) => !isMineralTarget(t)]]) {
  for (const t of GATHERING_EXT[skill] ?? []) if (!keep || keep(t)) add(t.itemId, `${name}获得（Lv${t.reqLevel} 解锁）`)
}
for (const [skill, name, keep] of [['foraging', '采摘', null], ['fishing', '垂钓', null], ['hunting', '狩猎', null], ['excavation', '挖掘', (t) => !isMineralTarget(t)]]) {
  for (const t of GATHERING_EXT2[skill] ?? []) if (!keep || keep(t)) add(t.itemId, `${name}获得（Lv${t.reqLevel} 解锁）`)
}
// 采矿：ext/ext2 里的矿物目标 + 13 座同名矿（后者原本没有「挖掘获得」来源串）
for (const [skill] of [['excavation']]) {
  for (const t of GATHERING_EXT[skill] ?? []) if (isMineralTarget(t)) add(t.itemId, `采矿获得（Lv${t.reqLevel} 解锁）`)
  for (const t of GATHERING_EXT2[skill] ?? []) if (isMineralTarget(t)) add(t.itemId, `采矿获得（Lv${t.reqLevel} 解锁）`)
}
// （13 座同名矿的「采矿获得」已由上面的 GATHER 表一次登记完：MINING_TARGETS 里就有它们。
//  v2.8.0 删掉了这里原先「再补一遍」的循环——那会让同一条来源串在图鉴里出现两次。）

// 农耕
for (const c of CROPS) add(c.itemId, `农耕种植获得（Lv${c.reqLevel} 解锁）`)

// 制作（基础 + 扩充）
const PROD = [
  [COOKING_RECIPES, '烹饪制作'],
  [BAKING_RECIPES, '烘焙制作'],
  [PRESERVING_RECIPES, '腌制制作'],
  [BREWING_RECIPES, '调酒制作'],
  [SPICE_RECIPES, '调料调配'],
  [SMITHING_SET_RECIPES, '厨具锻造'],
  [PRESERVATION_RECIPES, '食材保鲜制作'],
]
for (const [arr, name] of PROD) for (const r of arr) add(r.output?.itemId, `${name}（Lv${r.reqLevel} 可学）`)
for (const [skill, name] of [['cooking', '烹饪制作'], ['baking', '烘焙制作'], ['preserving', '腌制制作'], ['brewing', '调酒制作'], ['spiceMixing', '调料调配']]) {
  for (const r of PRODUCTION_EXT[skill] ?? []) add(r.output?.itemId, `${name}（Lv${r.reqLevel} 可学）`)
}
for (const [skill, name] of [['cooking', '烹饪制作'], ['baking', '烘焙制作'], ['preserving', '腌制制作'], ['brewing', '调酒制作'], ['spiceMixing', '调料调配']]) {
  for (const r of PRODUCTION_EXT2[skill] ?? []) add(r.output?.itemId, `${name}（Lv${r.reqLevel} 可学）`)
}
for (const r of PRESERVE_EXT) add(r.output?.itemId, `食材保鲜制作（Lv${r.reqLevel} 可学）`)
for (const r of PRESERVE_EXT2) add(r.output?.itemId, `食材保鲜制作（Lv${r.reqLevel} 可学）`)

// 炼金（合成）
for (const a of ALCHEMY_RECIPES) {
  const mats = Object.entries(a.in)
    .map(([id, q]) => `${getItem(id)?.name ?? id}×${q}`)
    .join('+')
  add(a.out, `炼金合成（${mats}）`)
}

// 商店
for (const s of SHOP_ITEMS) if (s.itemId) add(s.itemId, `杂货铺购买（${s.price} 金币）`)

// 探索（200 目标）
for (const t of EXPLORATION_TARGETS_ALL) for (const l of t.loot ?? []) if (l.itemId) add(l.itemId, `探索「${t.name}」获得`)

// 赛季：限定装备 + 奖励档位（用 seasonTiers 主题化后的真实发放奖励，避免把被替换的通用道具误标为赛季来源）
for (const s of SEASONS) {
  add(s.limitedItem, `赛季「${s.name}」限定奖励`)
  for (const t of seasonTiers(s)) for (const id of Object.keys(t.reward?.items ?? {})) add(id, `赛季「${s.name}」奖励`)
}

// 首领 掉落
for (const b of COMBAT_BOSSES) for (const d of b.drops ?? []) add(d.itemId, `首领「${b.name}」掉落`)
// 竞技场挑战对手掉落（arena.js 固定 mysterySpice 5%）：仅作图鉴来源索引，不改掉落数据
add('mysterySpice', '竞技场挑战对手掉落（5%）')

// 食灵：召唤本体 + 契约材料
for (const sp of SPIRITS) {
  add(sp.id, `食灵召唤（Lv${sp.reqLevel} 契约）`)
  for (const c of Object.keys(sp.contract ?? {})) add(c, `食灵契约材料（召唤${sp.name}）`)
}

// 成就 / 任务奖励
for (const a of ALL_ACHIEVEMENTS) for (const id of Object.keys(a.reward?.items ?? {})) add(id, `成就「${a.name}」奖励`)
for (const q of QUESTS) for (const id of Object.keys(q.reward?.items ?? {})) add(id, `主线任务「${q.name}」奖励`)

// 附产物（固定机制；百分比与技能内常量一致：采摘木材 50%、挖掘铜矿 50%/铁矿 30%/化石 2%、狩猎野鸡蛋 15%）
// v2.7.0：铜矿/铁矿的附产**保留在挖掘**（用户确认），所以它们既有「采矿获得」也有「挖掘附产物」两条来源。
add('wood', '采摘附产物（50%）')
add('copperOre', '挖掘附产物（50%）')
add('ironOre', '挖掘附产物（30%）')
add('fossilIngredient', '挖掘附产物（2%）')
add('pheasantEgg', '狩猎野鸡附产物（15%）')

// 觅珍抽卡（2026-09-06）：三池物品来源
// ⚠️ v2.8.0 修：这里原先是**重抄一遍过滤条件**，且漏掉了池定义里的 `cap`（价值上限）——
//    于是图鉴把 370 件「抽不到的高价值物品」标成可抽到（含 16 档高价值木材、化石食材、松露/灵果等）。
//    现改为**直接复用池函数** `poolItems()`，登记侧与判定侧永远同源（`mijianDraws.js` 是唯一真身）。
// 惰性登记（见下方 ensureMijianSources）：池子按 value 筛成员，而 value 会被 `applyValueBalance()` 改，
// 所以这份登记**不能**在模块加载期算一次就算完——那会让结果取决于 import 顺序（实测踩过）。
let _mijianRegisteredVersion = -1
function ensureMijianSources() {
  const v = mijianPoolVersion()
  if (v === _mijianRegisteredVersion) return
  for (const id of Object.keys(SOURCES)) {
    const kept = SOURCES[id].filter((x) => !x.startsWith('觅珍·'))
    if (kept.length !== SOURCES[id].length) SOURCES[id] = kept
  }
  for (const p of MIJIAN_POOLS) {
    if (p.id === 'mix' || p.id === 'limited') continue // 混池/限时池是「按权重混合」的组合池，不逐件登记
    for (const it of poolItems(p.id)) add(it.id, `觅珍·${p.name}（抽卡）`)
  }
  _mijianRegisteredVersion = v
}

// 游戏商店（2026-09-09 小游戏游戏币商店）：礼包/盲盒/种子袋随机获取（池定义与商店发货共用 gameShopPools）
for (const id of RARE_POOL) add(id, '游戏商店·稀有食材盲盒（游戏币购买）')
for (const id of SEED_POOL) add(id, '游戏商店·神秘种子袋（游戏币购买）')
for (const id of INGREDIENT_POOL) add(id, '游戏商店·鲜味食材礼包（游戏币购买）')
for (const id of FOOD_POOL) add(id, '游戏商店·珍馐料理礼包（游戏币购买）')
for (const id of SPICE_POOL) add(id, '游戏商店·精酿调料礼包（游戏币购买）')
for (const id of MINERAL_POOL) add(id, '游戏商店·锻造矿材礼包（游戏币购买）')

// 远行采集队（2026-09-09 长线挂机线）：各线路产出池 + 稀有掉落
for (const ex of EXPEDITIONS) {
  const ids = new Set()
  for (const s of ex.slots ?? []) for (const id of s.pool ?? []) ids.add(id)
  if (ex.rare?.itemId) ids.add(ex.rare.itemId)
  for (const id of ids) add(id, `远行采集队·${ex.name}（领取）`)
}

// 牧场养殖（2026-09-10）：驯养动物的周期产出
for (const an of RANCH_ANIMALS) {
  for (const id of Object.keys(an.products ?? {})) add(id, `牧场养殖·${an.name}（驯养产出）`)
}

// ── 挂机产线四套（2026-09-14）──
// 蜂蜜：**唯一来源是温室蜂场**（作物伴生 10% / 蜂箱产蜜），故必须显式登记来源
for (const h of HONEY_TIERS) {
  add(h.id, `温室蜂场·作物伴生（${h.name}：作物 Lv${h.minLevel}+ 时 10% 概率）`)
  add(h.id, '温室蜂场·蜂箱（花类蜜源产蜜）')
}
// 菌房：菇床周期产出
for (const m of MUSHROOM_MEDIA) {
  for (const id of Object.keys(m.products ?? {})) add(id, `灵圃菌房·${m.name}（菇床产出）`)
}
// 灵田：灵植定向收获
for (const sp of SPIRIT_PLANTS) {
  for (const id of Object.keys(sp.products ?? {})) add(id, `灵圃菌房·${sp.name}（灵植收获）`)
}
// 网箱（并入牧场页）：养鱼周期产出
for (const f of POND_FISH) {
  for (const id of Object.keys(f.products ?? {})) add(id, `牧场·网箱（${f.name}养鱼产出）`)
}
// 精耕作物（v2.5.0）：**只有农田能出**（reqLevel ≥ 40 的作物附产，概率随该作物精通提高）
add(PRIME_CROP_ID, '农耕收获附产（等级 40 以上的作物，概率 4%~10%）')

// 菌灵露 8 档（v2.3.0）：灵圃菌房的萃露炉酿造（**唯一来源**）
for (const e of ESSENCE_TIERS) {
  add(e.id, `灵圃菌房·萃露炉（${getItem(e.anchor)?.name ?? e.anchor} Lv${e.anchorLv} 等原料酿造）`)
}

// 交易所（2026-09-10）：可买入的货品池（按类别与价值区间动态轮换）
for (const it of Object.values(ITEMS)) {
  if (it.type !== 'ingredient' || !EXCHANGE_POOL_CATEGORIES.includes(it.category)) continue
  if ((it.value ?? 0) < 20 || (it.value ?? 0) > 300) continue
  add(it.id, '交易所（行情买入）')
}

// 产地与风土（2026-09-12 补录）：把采集队线路派驻到产地后，该产地物资箱物品会混入产出。
// 此前产地从未登记为来源——玩家在图鉴里看不到「这里也能产出它」，也点不进去（sourceJump 同步补了跳转）。
for (const r of REGIONS) for (const id of r.box ?? []) {
  add(id, `产地与风土·${r.name}（派驻产出）`)
  add(id, `商队线·${r.name}特产（归队带回）`) // 同一批 box 物品也是商队特产（player.caravanClaim 按 route.box 抽取）
}

// 吉祥物（2026-09-12 补录）：每日蹭一蹭有概率带礼物（同属补录，此前未登记）
for (const m of MASCOTS) for (const id of Object.keys(m.items ?? {})) add(id, `吉祥物·${m.name}（每日互动礼物）`)

// 供应商合约（2026-09-10）：签约后按日自动到货（供货清单见 suppliers.js）
for (const s of SUPPLIERS) add(s.itemId, `供应商合约·${s.name}（每日到货 ${s.qty} 个，货款 ${Math.round(SUPPLIER_PRICE_MULT * 100)}% 物价）`)

// 名厨挑战（2026-09-10）：战胜名厨的固定奖励 + 对手掉落
for (const c of CHEFS) {
  for (const id of Object.keys(chefReward(c, 1).items ?? {})) add(id, `名厨挑战·战胜「${c.name}」奖励`)
}
add('mysterySpice', '名厨挑战对手掉落（25%）')

// 图鉴兑换所（2026-09-10）：按图鉴完成度档位发放的点数兑换（限量道具）
for (const r of CODEX_REWARDS) for (const id of Object.keys(r.items ?? {})) add(id, `图鉴兑换所兑换（${r.cost} 图鉴点数）`)

// 随机奇遇（2026-09-11 补录）：挂机动作 0.2% 触发的小事件，分支奖励给的物品
for (const enc of ENCOUNTERS) {
  for (const c of enc.choices ?? []) {
    for (const id of Object.keys(c.effect?.items ?? {})) add(id, `随机奇遇·「${enc.title}」（挂机 0.2% 触发）`)
  }
}

/** 某物品的获取来源列表（无来源返回 []） */
export function itemSources(id) {
  ensureMijianSources() // 惰性登记：首次取来源时（必然已在价值平衡之后）才算一遍
  return SOURCES[id] ?? []
}
/** 有来源索引的物品数（图鉴覆盖率统计用） */
export function sourcedCount() {
  return Object.keys(SOURCES).length
}
