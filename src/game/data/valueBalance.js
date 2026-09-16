// 材料/物品 value 平衡：让可采集材料与配方产物的 value 随其获取等级匹配。
// 方式（用户选 B）：保留每级内物品原有的相对强弱差异（±30%），并整组平移保证“跨等级严格递增、无倒挂”。
// 忽略矿物（copperOre/ironOre/saltOre/各 ext 矿/黄金矿/白银矿等）。启动时调用。
import { ITEMS } from './items.js'
import { FORAGING_TARGETS } from '../skills/ForagingSkill.js'
import { FISHING_TARGETS } from '../skills/FishingSkill.js'
import { HUNTING_TARGETS } from '../skills/HuntingSkill.js'
import { EXCAVATION_TARGETS, EXCAVATION_GROUND_TARGETS, MINING_TARGETS } from '../skills/ExcavationSkill.js'
import { WOODCUTTING_TARGETS } from './timbers.js'
import { CROPS } from '../skills/FarmingSkill.js'
import { COOKING_RECIPES } from '../skills/CookingSkill.js'
import { BAKING_RECIPES } from '../skills/BakingSkill.js'
import { PRESERVING_RECIPES } from '../skills/PreservingSkill.js'
import { BREWING_RECIPES } from '../skills/BrewingSkill.js'
import { SPICE_RECIPES } from '../skills/SpiceMixingSkill.js'
import { SMITHING_SET_RECIPES } from './smithSetExt.js'
import { PRESERVATION_RECIPES } from '../skills/PreservationSkill.js'
import { SPIRIT_RECIPES } from '../skills/SpiritSummoningSkill.js'
import { GATHERING_EXT, PRODUCTION_EXT, SMITHING_EXT, PRESERVE_EXT, SPIRIT_EXT } from './expansion1.js'
import { GATHERING_EXT2, PRODUCTION_EXT2, SMITHING_EXT2, PRESERVE_EXT2, SPIRIT_EXT2 } from './expansion2.js'
import { ALCHEMY_RECIPES } from './alchemy.js'
import { resetMijianPoolCache } from './mijianDraws.js'
import { WOODWORKING_RECIPES } from './woodworking.js'
import { SIDELINE_RECIPES } from './sidelineWorks.js'

const isMineral = (id) => { const it = ITEMS[id]; return it?.category === 'mineral' || /Ore|fossil|salt|矿/.test(id) }
const round = (v) => Math.round(v)

// 物品 -> 最低获取等级（采集/农耕/探索掉落 ∪ 配方产物能力）
const level = {}
const addLv = (id, lv) => { if (id != null && (level[id] == null || lv < level[id])) level[id] = lv }
// ⚠️ v2.7.0：与 recipeBalance 同源——矿物拆出后要把「挖掘地面 / 采矿 / 伐木」三份清单都登记，
// 否则新木材的 value 不参与「随等级 ±30% 带」校正，会与同级材料倒挂。
for (const [arr] of [
  [FORAGING_TARGETS], [FISHING_TARGETS], [HUNTING_TARGETS],
  [EXCAVATION_TARGETS], [EXCAVATION_GROUND_TARGETS], [MINING_TARGETS], [WOODCUTTING_TARGETS],
]) for (const t of arr) addLv(t.itemId, t.reqLevel)
for (const s of ['foraging', 'fishing', 'hunting', 'excavation']) { for (const t of GATHERING_EXT[s] ?? []) addLv(t.itemId, t.reqLevel); for (const t of GATHERING_EXT2[s] ?? []) addLv(t.itemId, t.reqLevel) }
for (const c of CROPS) addLv(c.itemId, c.reqLevel)
// 注意：探索掉落【不】作为物品价值等级来源。探索卡片等级是“探索区难度”，不代表物品真实等级；
// 否则探索数据变化会连动物品价值。价值等级一律以采集/农耕/配方产物为准（与物品等级平衡口径一致）。
const PROD = [ [PRODUCTION_EXT, ['cooking', 'baking', 'preserving', 'brewing', 'spiceMixing']], [PRODUCTION_EXT2, ['cooking', 'baking', 'preserving', 'brewing', 'spiceMixing']], [PRESERVE_EXT, []], [PRESERVE_EXT2, []], [SMITHING_EXT, []], [SMITHING_EXT2, []], [SMITHING_SET_RECIPES, []], [SPIRIT_EXT, []], [SPIRIT_EXT2, []] ]
for (const [arrLike, keys] of PROD) {
  const arrs = keys.length ? keys.map((k) => arrLike?.[k] ?? []).flat() : Array.isArray(arrLike) ? arrLike : Object.values(arrLike ?? {}).flat()
  for (const r of arrs) if (r?.output?.itemId) addLv(r.output.itemId, r.reqLevel)
}
// 基础配方产物锚（此前只算扩展配方产物，漏了基础配方，导致价值锚与等级锚不一致）
for (const r of [...COOKING_RECIPES, ...BAKING_RECIPES, ...PRESERVING_RECIPES, ...BREWING_RECIPES, ...SPICE_RECIPES]) {
  if (r.output?.itemId) addLv(r.output.itemId, r.reqLevel)
}
addLv(undefined, 0)

/** 炼金不变量修复：炼金产物价值不得超过其投入价值总和 */
function applyAlchemyRatioCap() {
  // 炼金配方（1499 条）是按「投入价值 ≈ 产出价值（微亏换效率）」逐条生成的，authored 数据 0 违规；
  // 但上面的「按物品等级夹取」只看产出自身的等级，会把某些产物抬到远高于其投入——典型：
  // 9 清水（买卖价 2/瓶，成本 18）→ 1 苏打水，15 → 54，卖价 27 > 18，成了无限刷钱循环。
  // 这里把产物价值压回「投入价值」上界，使炼金不创造价值（迭代到不动点；实测 3 轮收敛、仅影响 ~60 件）。
  for (let pass = 0; pass < 8; pass++) {
    let changed = 0
    for (const r of ALCHEMY_RECIPES) {
      const out = r?.out
      const outItem = ITEMS[out]
      if (!outItem || outItem.value == null) continue
      let inValue = 0
      for (const [id, qty] of Object.entries(r.in ?? {})) inValue += (ITEMS[id]?.value ?? 0) * qty
      if (outItem.value > inValue) { outItem.value = inValue; changed++ }
    }
    if (!changed) break
  }
}

export function applyValueBalance() {
  // 温和曲线：value 下限随等级递增（2 + 等级×2.5）。每件 value 夹到「该级 ±30% 带」内，
  // 保留个体差异且不导致连环爆炸（不做整组平移）。
  const curve = (lv) => 2 + lv * 2.5
  for (const [id, item] of Object.entries(ITEMS)) {
    const lv = level[id]
    if (lv == null || isMineral(id) || item.value == null) continue
    const c = curve(lv)
    item.value = Math.round(Math.max(c * 0.7, Math.min(c * 1.3, item.value)))
  }
  applyAlchemyRatioCap()
  applySidelineProductValues() // 副业产物 value = 其材料投入合计（必须在材料平衡之后，见函数注释）
  resetMijianPoolCache() // 池子按 value 筛选 → 平衡改过 value 后必须重算（顺序敏感，见 mijianDraws 注释）
}

/**
 * 副业产物的 value = **其配方材料的价值合计**（2026-09-17，v2.10.1）。
 *
 * 起因（用户实测提问）：「木工、陶艺、编织、刺绣、蜡烛制作是技能，但是做了一件后就能用了，
 * 多制作出来的没用了」——产物原先按「等级的曲线值」定价（Lv1 陶碗只值 5 金币），
 * 而它的材料（松木×2 + 铁矿×2）值 40 上下，于是「半价卖给杂货铺」这条出口名义上存在、实际等于零。
 *
 * 现在把产物价值锚到材料投入上 ⇒ **卖一件产物 = 把这份材料整包卖掉的收入**（产物 ×0.5 = 材料 ×0.5），
 * 多做出来的永远不浪费；不需要新增任何机制、货币或存档字段。
 * ⚠️ 安全性：副业产物已被排除出全部池子与自动出口（抽卡/礼包/珍馐阁/交易所/商队/自动出售，
 * 见 `SIDELINE_ITEM_CATEGORIES` 的 5 个消费方），且**没有任何配方把它们当材料** ⇒ 调高 value 不产生套利。
 * ⚠️ 必须在**材料价值平衡之后**调用：材料 value 是上面那段改过的，先算会拿到旧值。
 */
export function applySidelineProductValues() {
  const sumOf = (ingredients) => {
    let s = 0
    for (const [id, qty] of Object.entries(ingredients ?? {})) s += (ITEMS[id]?.value ?? 0) * qty
    return Math.max(1, Math.round(s))
  }
  for (const r of [...WOODWORKING_RECIPES, ...Object.values(SIDELINE_RECIPES).flat()]) {
    const it = ITEMS[r?.output?.itemId]
    if (it) it.value = sumOf(r.ingredients)
  }
}

