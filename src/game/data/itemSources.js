// 物品获取来源索引 — 图鉴悬浮详情用
// 运行时反查：采集目标/制作食谱/农耕/商店/探索/赛季/BOSS掉落/食灵契约/成就/任务/附产物
import { FORAGING_TARGETS } from '../skills/ForagingSkill.js'
import { FISHING_TARGETS } from '../skills/FishingSkill.js'
import { HUNTING_TARGETS } from '../skills/HuntingSkill.js'
import { EXCAVATION_TARGETS } from '../skills/ExcavationSkill.js'
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
const GATHER = [
  [FORAGING_TARGETS, '采摘'],
  [FISHING_TARGETS, '垂钓'],
  [HUNTING_TARGETS, '狩猎'],
  [EXCAVATION_TARGETS, '挖掘'],
]
for (const [arr, name] of GATHER) for (const t of arr) add(t.itemId, `${name}获得（Lv${t.reqLevel} 解锁）`)
for (const [skill, name] of [['foraging', '采摘'], ['fishing', '垂钓'], ['hunting', '狩猎'], ['excavation', '挖掘']]) {
  for (const t of GATHERING_EXT[skill] ?? []) add(t.itemId, `${name}获得（Lv${t.reqLevel} 解锁）`)
}
for (const [skill, name] of [['foraging', '采摘'], ['fishing', '垂钓'], ['hunting', '狩猎'], ['excavation', '挖掘']]) {
  for (const t of GATHERING_EXT2[skill] ?? []) add(t.itemId, `${name}获得（Lv${t.reqLevel} 解锁）`)
}

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
add('wood', '采摘附产物（50%）')
add('copperOre', '挖掘附产物（50%）')
add('ironOre', '挖掘附产物（30%）')
add('fossilIngredient', '挖掘附产物（2%）')
add('pheasantEgg', '狩猎野鸡附产物（15%）')

// 觅珍抽卡（2026-09-06）：三池物品来源
const MIJIAN_POOL_KINDS = {
  material: ['ingredient', 'spice'],
  food: ['food', 'drink'],
  gear: ['equipment'],
}
for (const [pid, kinds] of Object.entries(MIJIAN_POOL_KINDS)) {
  for (const [id, it] of Object.entries(ITEMS)) {
    if (!kinds.includes(it.type)) continue
    if (pid === 'material' && (it.category === 'mineral' || /矿$/.test(it.name))) continue
    add(id, `觅珍·${pid === 'material' ? '材料池' : pid === 'food' ? '食物池' : '厨具池'}（抽卡）`)
  }
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

// 交易所（2026-09-10）：可买入的货品池（按类别与价值区间动态轮换）
for (const it of Object.values(ITEMS)) {
  if (it.type !== 'ingredient' || !EXCHANGE_POOL_CATEGORIES.includes(it.category)) continue
  if ((it.value ?? 0) < 20 || (it.value ?? 0) > 300) continue
  add(it.id, '交易所（行情买入）')
}

// 产地与风土（2026-09-12 补录）：把采集队线路派驻到产地后，该产地物资箱物品会混入产出。
// 此前产地从未登记为来源——玩家在图鉴里看不到「这里也能产出它」，也点不进去（sourceJump 同步补了跳转）。
for (const r of REGIONS) for (const id of r.box ?? []) add(id, `产地与风土·${r.name}（派驻产出）`)

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
  return SOURCES[id] ?? []
}
/** 有来源索引的物品数（图鉴覆盖率统计用） */
export function sourcedCount() {
  return Object.keys(SOURCES).length
}
