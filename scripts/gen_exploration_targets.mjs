// 生成“美食探索目标扩充”数据 → src/game/data/explorationTargets.js（勿手改，改后重跑本脚本）
// 目标：把探索目标从原有 50 个扩展到 200 个，并做全面的数值平衡（等级/经验/成功率/战利品/失败代价）。
// 设计原则：
//  - 目标总数恰为 200，reqLevel 从 1 连续覆盖到 99（每级 ≈2 个），保证玩家每升一级都有新目标解锁。
//  - 数值随 reqLevel 单调：intervalSec 递增、xp 递增、baseSuccess 递减、failGold 递增。
//  - 战利品面向全物品库（ingredient/spice/drink/food/consumable），按目标 reqLevel 的等级带匹配；
//    高段目标可掉稀有高级材料（spiritFruit/matsutake/truffle/dragonRoot/ginseng 等）。
//  - 不新增任何物品，完全复用现有 ITEMS；不改 items.js / 各平衡系统。
//  - 生成器只读现有数据源，输出到独立文件 explorationTargets.js，避免自引用污染。
import { writeFileSync } from 'node:fs'
import { ITEMS } from '../src/game/data/items.js'
import { FORAGING_TARGETS } from '../src/game/skills/ForagingSkill.js'
import { FISHING_TARGETS } from '../src/game/skills/FishingSkill.js'
import { HUNTING_TARGETS } from '../src/game/skills/HuntingSkill.js'
import { EXCAVATION_TARGETS } from '../src/game/skills/ExcavationSkill.js'
import { COOKING_RECIPES } from '../src/game/skills/CookingSkill.js'
import { BAKING_RECIPES } from '../src/game/skills/BakingSkill.js'
import { PRESERVING_RECIPES } from '../src/game/skills/PreservingSkill.js'
import { BREWING_RECIPES } from '../src/game/skills/BrewingSkill.js'
import { SPICE_RECIPES } from '../src/game/skills/SpiceMixingSkill.js'
import { SMITHING_SET_RECIPES } from '../src/game/data/smithSetExt.js'
import { CROPS } from '../src/game/skills/FarmingSkill.js'
import { PRESERVATION_RECIPES } from '../src/game/skills/PreservationSkill.js'
import { GATHERING_EXT, PRODUCTION_EXT, SMITHING_EXT, PRESERVE_EXT } from '../src/game/data/expansion1.js'
import { GATHERING_EXT2, PRODUCTION_EXT2, SMITHING_EXT2, PRESERVE_EXT2 } from '../src/game/data/expansion2.js'
import { raiseRecipeLevels, balanceRecipeLevels } from '../src/game/skills/recipeBalance.js'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
// 输出路径按脚本自身位置解析，避免「必须在仓库根目录运行」的隐性约束
const __OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '../src/game/data')
// 注意：ALCHEMY_RECIPES 是横向转化表（{in:{...}, out:"itemId"}，无 reqLevel/output.itemId），
// 其"产物等级"应取被转化物品自身在采集/配方中的等级，故不在此处作为等级锚点。
// 等级锚点必须同步「图鉴/运行时」口径（itemBalance.js）：配方等级先经 raiseRecipeLevels / balanceRecipeLevels
// 平衡再取锚点，且纳入基础+扩充配方、采集扩充、农耕、保鲜等全部来源——否则会把平衡后高级菜品错放进低级探索卡片。

// ── 1. 构建「物品 → 获取等级」权威映射（与 itemBalance.js 的 indexRecipes 口径一致）──
const itemLevel = new Map()
const setLevel = (id, lv) => { if (!id) return; const o = itemLevel.get(id); if (o === undefined || lv < o) itemLevel.set(id, lv) }
// 采集目标（基础 + 扩充）
for (const arr of [FORAGING_TARGETS, FISHING_TARGETS, HUNTING_TARGETS, EXCAVATION_TARGETS]) for (const t of arr) setLevel(t.itemId, t.reqLevel)
for (const skill of ['foraging', 'fishing', 'hunting', 'excavation']) for (const t of (GATHERING_EXT[skill] ?? [])) setLevel(t.itemId, t.reqLevel)
for (const skill of ['foraging', 'fishing', 'hunting', 'excavation']) for (const t of (GATHERING_EXT2[skill] ?? [])) setLevel(t.itemId, t.reqLevel)
// 农耕
for (const c of CROPS) setLevel(c.itemId, c.reqLevel)
// 配方产物：先经平衡（raise/balance）取平衡后 reqLevel —— 与 itemBalance.js 保持一致（复刻其 indexRecipes）
function indexRecipes(arr, fn) {
  const bal = fn(arr)
  for (const o of arr) {
    const r = bal.find((x) => x.id === o.id) ?? o
    if (r.output?.itemId) setLevel(r.output.itemId, r.reqLevel)
  }
}
indexRecipes([...COOKING_RECIPES, ...(PRODUCTION_EXT.cooking ?? []), ...(PRODUCTION_EXT2.cooking ?? [])], raiseRecipeLevels)
indexRecipes([...BAKING_RECIPES, ...(PRODUCTION_EXT.baking ?? []), ...(PRODUCTION_EXT2.baking ?? [])], raiseRecipeLevels)
indexRecipes([...PRESERVING_RECIPES, ...(PRODUCTION_EXT.preserving ?? []), ...(PRODUCTION_EXT2.preserving ?? [])], raiseRecipeLevels)
indexRecipes([...BREWING_RECIPES, ...(PRODUCTION_EXT.brewing ?? []), ...(PRODUCTION_EXT2.brewing ?? [])], raiseRecipeLevels)
indexRecipes([...SPICE_RECIPES, ...(PRODUCTION_EXT.spiceMixing ?? []), ...(PRODUCTION_EXT2.spiceMixing ?? [])], raiseRecipeLevels)
indexRecipes([...SMITHING_SET_RECIPES, ...(SMITHING_EXT ?? []), ...(SMITHING_EXT2 ?? [])], balanceRecipeLevels)
indexRecipes([...PRESERVATION_RECIPES, ...(PRESERVE_EXT ?? []), ...(PRESERVE_EXT2 ?? [])], balanceRecipeLevels)

// ── 2. 收集可作 loot 的物品池（按等级带分组）──────────
// 探索 loot 适合类型：食材/调料/饮品/料理/消耗品（排除装备/食灵/种子/任务物品）
const LOOT_TYPES = new Set(['ingredient', 'spice', 'drink', 'food', 'consumable'])
const pool = [] // { id, type, lv }
for (const [id, lv] of itemLevel) {
  const it = ITEMS[id]
  if (!it || !LOOT_TYPES.has(it.type)) continue
  pool.push({ id, type: it.type, lv })
}
// 按 reqLevel 值直接索引，便于按目标等级带取样
pool.sort((a, b) => a.lv - b.lv)

// ── 确定性伪随机（mulberry32）：保证生成器可重跑产出稳定数据（符合项目生成器惯例）──
function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 每个目标的可掉 loot 物品按「目标 reqLevel 等级带」取样。
// 硬性约束：所有 loot 物品的获取等级 ≤ targetLv + 5（不允许超纲），
// 等级带取 [max(1, lv-5), lv+5]，主物品尽量 ≤ lv+2 并偏材料型（ingredient/spice），
// 辅物品偏收获型（food/drink/consumable），实现类型混合。
function pickLoot(targetLv, count, seed) {
  const rand = mulberry32(seed)
  const lo = Math.max(1, targetLv - 5)
  const hi = targetLv + 5
  const cap = targetLv + 5 // 硬性上限：物品等级不得超过卡片等级 +5
  // 主物品带（偏材料型，≤ targetLv+2）
  const mainBand = materialPool.filter((p) => p.lv >= lo && p.lv <= targetLv + 2)
  // 辅物品带（偏收获型，≤ cap）
  const auxBand = harvestPool.filter((p) => p.lv >= Math.max(1, targetLv - 8) && p.lv <= cap)
  // 兜底带：全池但硬性 clamp 到 cap
  const fallback = pool.filter((p) => p.lv <= cap)
  const out = []
  const used = new Set()
  function drawFrom(source) {
    if (!source.length) return null
    let pick
    let guard = 0
    do {
      pick = source[Math.floor(rand() * source.length)]
      if (++guard > 40) break
    } while (used.has(pick.id))
    if (!pick || used.has(pick.id)) return null
    // 终极保险：任何候选物品等级超过 cap 一律丢弃
    if (pick.lv > cap) return null
    used.add(pick.id)
    return pick
  }
  // 第一条物品：主物品（材料型，不超纲）
  const main = drawFrom(mainBand.length ? mainBand : harvestPool.filter((p) => p.lv <= targetLv + 2))
  if (main) out.push(main)
  // 其余：辅物品（收获型，可略高但 ≤ cap）
  while (out.length < count) {
    const p = drawFrom(auxBand.length ? auxBand : fallback)
    if (!p) break
    out.push(p)
  }
  return out
}

// 类型分层池：material = 食材/调料（可持续原料），harvest = 料理/饮品（收获型成品）
// 每目标尽量混合两种类型，避免 loot 过度偏重单一类型（面向全物品考量）。
const materialPool = pool.filter((p) => p.type === 'ingredient' || p.type === 'spice')
const harvestPool = pool.filter((p) => p.type === 'food' || p.type === 'drink' || p.type === 'consumable')

// ── 3. 难度曲线：随等级推进的线性骨架（保障单调）──────────
// intervalSec 3.0 → 8.0；xp 10 → 480；baseSuccess 0.85 → 0.60；failGold 5 → 140
function curve(level) {
  const t = (level - 1) / 98 // 0~1
  const intervalSec = +(3.0 + t * 5.0).toFixed(1)
  const xp = Math.round(10 + t * 470)
  const baseSuccess = +(0.85 - t * 0.25).toFixed(2) // 0.85 → 0.60
  const failGold = Math.round(5 + t * 135) // 5 → 140
  return { intervalSec, xp, baseSuccess, failGold }
}

// ── 4. 命名：按「掉落物类别 → 主题 → 名字池」组织，让卡片名与主打掉落物呼应 ──────────
// 每个名字带 tier（low 平民摊铺 / mid 餐馆坊店 / high 餐厅御膳传说），
// 生成时按 reqLevel 段 + 主打掉落物类别选名，避免低等级卡片叫高级餐厅等违和。
const CATEGORY_THEME = {
  seafood: 'seafood', meat: 'meat', egg: 'meat',
  fungus: 'fungus', root: 'root',
  fruit: 'fruit', vegetable: 'vegetable', legume: 'vegetable',
  grain: 'grain', flower: 'herb', herb: 'herb', dairy: 'dairy',
  spicePlant: 'spice', seasoning: 'spice',
  drinkBase: 'drink', juice: 'drink', tea: 'drink', wine: 'drink',
  '主食': 'grain', '主菜': 'dish', '汤品': 'dish', '甜点': 'dessert', baking: 'dessert',
}
const THEME_NAMES = {
  seafood: [
    { name: '鱼摊', tier: 'low' }, { name: '水产档', tier: 'low' }, { name: '海鲜小摊', tier: 'low' },
    { name: '渔家宴', tier: 'mid' }, { name: '海鲜市场', tier: 'mid' }, { name: '烤鱼铺', tier: 'mid' },
    { name: '鲜鱼馆', tier: 'mid' }, { name: '海味餐厅', tier: 'mid' },
    { name: '刺身店', tier: 'high' }, { name: '寿司店', tier: 'high' }, { name: '海鲜大酒楼', tier: 'high' }, { name: '深海御膳', tier: 'high' },
  ],
  meat: [
    { name: '肉铺', tier: 'low' }, { name: '熏肉摊', tier: 'low' }, { name: '烧腊铺', tier: 'mid' },
    { name: '烤肉店', tier: 'mid' }, { name: '卤味铺', tier: 'mid' }, { name: '腊味铺', tier: 'mid' },
    { name: '火腿铺', tier: 'mid' }, { name: '白切鸡铺', tier: 'mid' }, { name: '烧鹅铺', tier: 'mid' },
    { name: '烤鸭店', tier: 'high' }, { name: '扒房', tier: 'high' }, { name: '御膳烤坊', tier: 'high' },
  ],
  fungus: [
    { name: '菌菇摊', tier: 'low' }, { name: '山货铺', tier: 'low' }, { name: '干货铺', tier: 'low' },
    { name: '山珍馆', tier: 'mid' }, { name: '菌菇坊', tier: 'mid' },
    { name: '松露料理馆', tier: 'high' }, { name: '野生菌宴', tier: 'high' },
  ],
  root: [
    { name: '野菜摊', tier: 'low' }, { name: '山货摊', tier: 'low' }, { name: '根茎铺', tier: 'low' },
    { name: '药膳坊', tier: 'mid' }, { name: '滋补坊', tier: 'mid' },
    { name: '山珍御膳', tier: 'high' }, { name: '灵芝药膳馆', tier: 'high' },
  ],
  fruit: [
    { name: '水果摊', tier: 'low' }, { name: '鲜果铺', tier: 'low' }, { name: '果切摊', tier: 'low' },
    { name: '果酱坊', tier: 'mid' }, { name: '蜜饯铺', tier: 'mid' },
    { name: '时令果园', tier: 'high' }, { name: '蟠桃宴席', tier: 'high' },
  ],
  vegetable: [
    { name: '早市菜摊', tier: 'low' }, { name: '蔬菜棚', tier: 'low' }, { name: '时蔬摊', tier: 'low' },
    { name: '豆芽坊', tier: 'low' }, { name: '豆制品铺', tier: 'mid' },
    { name: '田园蔬宴', tier: 'high' },
  ],
  grain: [
    { name: '面摊', tier: 'low' }, { name: '馒头铺', tier: 'low' }, { name: '煎饼摊', tier: 'low' },
    { name: '面馆', tier: 'mid' }, { name: '饺子馆', tier: 'mid' }, { name: '馄饨铺', tier: 'mid' },
    { name: '米粉铺', tier: 'mid' }, { name: '烧麦铺', tier: 'mid' }, { name: '肠粉铺', tier: 'mid' },
    { name: '拉面道场', tier: 'high' }, { name: '御膳面点', tier: 'high' },
  ],
  herb: [
    { name: '香草摊', tier: 'low' }, { name: '花草茶铺', tier: 'mid' }, { name: '香草园', tier: 'mid' },
    { name: '御用香草轩', tier: 'high' },
  ],
  dairy: [
    { name: '奶铺', tier: 'low' }, { name: '奶茶铺', tier: 'mid' }, { name: '奶酪坊', tier: 'mid' },
    { name: '奶香御膳', tier: 'high' },
  ],
  spice: [
    { name: '香料摊', tier: 'low' }, { name: '调料铺', tier: 'low' }, { name: '酱料坊', tier: 'mid' },
    { name: '醋坊', tier: 'mid' }, { name: '酱油坊', tier: 'mid' }, { name: '蚝油坊', tier: 'mid' },
    { name: '咖喱坊', tier: 'mid' }, { name: '火锅底料坊', tier: 'mid' },
    { name: '御膳香料坊', tier: 'high' }, { name: '天香阁', tier: 'high' },
  ],
  drink: [
    { name: '糖水铺', tier: 'low' }, { name: '凉茶铺', tier: 'mid' }, { name: '奶茶店', tier: 'mid' },
    { name: '咖啡厅', tier: 'mid' }, { name: '茶艺馆', tier: 'mid' }, { name: '果汁铺', tier: 'mid' },
    { name: '酒馆', tier: 'mid' }, { name: '清吧', tier: 'mid' },
    { name: '精酿坊', tier: 'high' }, { name: '葡萄酒庄', tier: 'high' }, { name: '黄酒坊', tier: 'high' }, { name: '琼浆玉液阁', tier: 'high' },
  ],
  dessert: [
    { name: '糖水摊', tier: 'low' }, { name: '糖葫芦摊', tier: 'low' }, { name: '点心铺', tier: 'low' },
    { name: '蛋挞铺', tier: 'mid' }, { name: '泡芙铺', tier: 'mid' }, { name: '蛋糕铺', tier: 'mid' },
    { name: '甜品铺', tier: 'mid' }, { name: '可丽饼铺', tier: 'mid' }, { name: '松饼铺', tier: 'mid' },
    { name: '马卡龙铺', tier: 'high' }, { name: '提拉米苏铺', tier: 'high' }, { name: '法式甜点屋', tier: 'high' }, { name: '甜品实验室', tier: 'high' },
  ],
  dish: [
    { name: '大排档', tier: 'low' }, { name: '夜宵档', tier: 'low' }, { name: '农家乐', tier: 'mid' },
    { name: '私房菜馆', tier: 'mid' }, { name: '川味馆', tier: 'mid' }, { name: '湘菜馆', tier: 'mid' },
    { name: '粤菜馆', tier: 'mid' }, { name: '东北菜馆', tier: 'mid' }, { name: '茶餐厅', tier: 'mid' },
    { name: '日料店', tier: 'high' }, { name: '泰式餐厅', tier: 'high' }, { name: '意式餐厅', tier: 'high' },
    { name: '法式餐厅', tier: 'high' }, { name: '米其林后厨', tier: 'high' }, { name: '国宴厨房', tier: 'high' },
  ],
  general: [
    { name: '街头小贩', tier: 'low' }, { name: '转角茶摊', tier: 'low' }, { name: '巷口面馆', tier: 'low' },
    { name: '美食主播', tier: 'mid' }, { name: '美食博主工作室', tier: 'mid' }, { name: '美食家私宅', tier: 'mid' },
    { name: '美食评论家', tier: 'mid' }, { name: '深夜食堂', tier: 'mid' }, { name: '探店博主', tier: 'mid' },
    { name: '时令料理馆', tier: 'high' }, { name: '限定料理店', tier: 'high' }, { name: '名厨私藏馆', tier: 'high' },
    { name: '厨界传奇', tier: 'high' }, { name: '千年食府', tier: 'high' }, { name: '传说餐厅', tier: 'high' },
    { name: '神话餐厅', tier: 'high' }, { name: '天厨行宫', tier: 'high' }, { name: '食神居所', tier: 'high' },
    { name: '仙膳坊', tier: 'high' }, { name: '龙宫盛宴', tier: 'high' }, { name: '天宫御膳', tier: 'high' },
    { name: '太古食庙', tier: 'high' }, { name: '史前盛宴', tier: 'high' }, { name: '洪荒食宴', tier: 'high' },
  ],
}
// tier 按 reqLevel 段：1~30 low，31~65 mid，66~99 high
function tierFor(level) {
  if (level <= 30) return 'low'
  if (level <= 65) return 'mid'
  return 'high'
}
// ── 补充：扩充各主题候选名，避免 200 目标落到「美食秘境·N」兜底 ──────────
// 为各主题追加一批合理的自然店名（按 tier 分布），使总候选 ≥ 220（留余量）。
const EXTRA_NAMES = {
  seafood: [{ name: '小渔村', tier: 'low' }, { name: '鲜味档', tier: 'low' }, { name: '渔港食堂', tier: 'mid' }, { name: '海鲜排档', tier: 'mid' }, { name: '深海鲜舫', tier: 'high' }, { name: '海龙王宴', tier: 'high' }],
  meat: [{ name: '烤串摊', tier: 'low' }, { name: '卤味轩', tier: 'mid' }, { name: '烧肉居', tier: 'mid' }, { name: '刀削肉铺', tier: 'low' }, { name: '牛排馆', tier: 'high' }, { name: '御宴烤坊', tier: 'high' }],
  fungus: [{ name: '山珍斋', tier: 'mid' }, { name: '菌菇斋', tier: 'mid' }, { name: '松露坊', tier: 'high' }],
  root: [{ name: '药膳堂', tier: 'mid' }, { name: '滋补堂', tier: 'mid' }, { name: '山膳阁', tier: 'high' }],
  fruit: [{ name: '鲜果摊', tier: 'low' }, { name: '果品铺', tier: 'mid' }, { name: '时令果庄', tier: 'high' }, { name: '仙果斋', tier: 'high' }],
  vegetable: [{ name: '时蔬摊', tier: 'low' }, { name: '菜园坊', tier: 'mid' }, { name: '田园菜馆', tier: 'mid' }, { name: '百蔬居', tier: 'high' }],
  grain: [{ name: '面点铺', tier: 'low' }, { name: '粉面馆', tier: 'mid' }, { name: '面食坊', tier: 'mid' }, { name: '御面堂', tier: 'high' }],
  herb: [{ name: '花茶轩', tier: 'mid' }, { name: '香草坊', tier: 'mid' }, { name: '御香斋', tier: 'high' }],
  dairy: [{ name: '奶品铺', tier: 'low' }, { name: '奶酪轩', tier: 'mid' }, { name: '乳香阁', tier: 'high' }],
  spice: [{ name: '味料摊', tier: 'low' }, { name: '酱园', tier: 'mid' }, { name: '调香坊', tier: 'mid' }, { name: '天味斋', tier: 'high' }, { name: '御味轩', tier: 'high' }],
  drink: [{ name: '茶摊', tier: 'low' }, { name: '饮子铺', tier: 'low' }, { name: '茗茶居', tier: 'mid' }, { name: '果饮坊', tier: 'mid' }, { name: '琼浆阁', tier: 'high' }, { name: '玉液轩', tier: 'high' }],
  dessert: [{ name: '甜水铺', tier: 'low' }, { name: '糖巧摊', tier: 'low' }, { name: '酥点坊', tier: 'mid' }, { name: '甜馨居', tier: 'mid' }, { name: '御点斋', tier: 'high' }, { name: '云糕阁', tier: 'high' }],
  dish: [{ name: '小饭馆', tier: 'low' }, { name: '家常菜馆', tier: 'mid' }, { name: '风味馆', tier: 'mid' }, { name: '五味居', tier: 'mid' }, { name: '盛宴堂', tier: 'high' }, { name: '国色天香阁', tier: 'high' }, { name: '御膳房', tier: 'high' }],
  general: [{ name: '深夜饭堂', tier: 'mid' }, { name: '街角食堂', tier: 'low' }, { name: '天府食轩', tier: 'high' }, { name: '玲珑食府', tier: 'high' }],
}
// 补足 low tier 候选（low 等级目标较多，避免低等级卡片借用到中/高档名）
const LOW_EXTRA = {
  seafood: [{ name: '渔摊', tier: 'low' }], meat: [{ name: '肉摊', tier: 'low' }], fungus: [{ name: '菌摊', tier: 'low' }], root: [{ name: '薯芋摊', tier: 'low' }],
  fruit: [{ name: '果摊', tier: 'low' }], vegetable: [{ name: '菜摊', tier: 'low' }], grain: [{ name: '粮铺', tier: 'low' }, { name: '煎饼铺', tier: 'low' }],
  herb: [{ name: '草摊', tier: 'low' }], dairy: [{ name: '奶摊', tier: 'low' }], spice: [{ name: '味摊', tier: 'low' }, { name: '盐铺', tier: 'low' }],
  drink: [{ name: '茶水摊', tier: 'low' }, { name: '豆浆摊', tier: 'low' }], dessert: [{ name: '甜摊', tier: 'low' }, { name: '糕饼摊', tier: 'low' }],
  dish: [{ name: '小炒摊', tier: 'low' }, { name: '家常小馆', tier: 'low' }], general: [{ name: '路边摊', tier: 'low' }],
}
for (const [k, extras] of Object.entries(LOW_EXTRA)) {
  if (THEME_NAMES[k]) THEME_NAMES[k].push(...extras)
}
for (const [k, extras] of Object.entries(EXTRA_NAMES)) {
  if (THEME_NAMES[k]) THEME_NAMES[k].push(...extras)
}

// 按主题 + 等级段选一个未用名；同主题同 tier 优先，缺则同主题其它 tier，
// 再退 general 同 tier、再跨主题借同 tier 名（都是合理美食场景名，避免生硬兜底），最后才补「美食秘境·n」
const usedNames = new Set()
function pickName(theme, level, fallbackIdx) {
  const tier = tierFor(level)
  const cands = THEME_NAMES[theme] ?? THEME_NAMES.general
  // 其它主题的同 tier 候选（用于主题池用尽时跨主题借名）
  const otherTier = Object.values(THEME_NAMES).flat().filter((x) => x.tier === tier && !usedNames.has(x.name))
  const otherAll = Object.values(THEME_NAMES).flat().filter((x) => !usedNames.has(x.name))
  const order = [
    cands.filter((x) => x.tier === tier && !usedNames.has(x.name)),
    cands.filter((x) => x.tier !== tier && !usedNames.has(x.name)),
    THEME_NAMES.general.filter((x) => x.tier === tier && !usedNames.has(x.name)),
    otherTier,
    THEME_NAMES.general.filter((x) => x.tier !== tier && !usedNames.has(x.name)),
    otherAll,
  ]
  for (const list of order) {
    if (list.length) { const pick = list[Math.floor(mulberry32(0xabcdef + fallbackIdx)() * list.length)]; usedNames.add(pick.name); return pick.name }
  }
  const fallback = `美食秘境·${fallbackIdx}`
  usedNames.add(fallback)
  return fallback
}
// 统计主打掉落物类别（优先材料型 main，取最多的类别）
function themeOf(lootItems) {
  const cnt = {}
  for (const p of lootItems) {
    const it = ITEMS[p.id]
    const th = CATEGORY_THEME[it?.category]
    if (th) cnt[th] = (cnt[th] ?? 0) + 1
  }
  if (!Object.keys(cnt).length) return 'general'
  return Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0]
}

const targets = []
let idx = 0
// 生成 200 个：reqLevel 从 1 起，向 99 平滑推进（每级 2 个，末档补足 200）
const LEVEL_SPACING = []
for (let lv = 1; lv <= 99 && LEVEL_SPACING.length < 200; lv++) {
  LEVEL_SPACING.push(lv)
  if (lv <= 99 && LEVEL_SPACING.length < 200) LEVEL_SPACING.push(lv)
}
// 若仍未满 200（理论上已 198），补到 200（用最高级）
while (LEVEL_SPACING.length < 200) LEVEL_SPACING.push(99)

for (const reqLevel of LEVEL_SPACING) {
  const { intervalSec, xp, baseSuccess, failGold } = curve(reqLevel)
  const id = `explore_${String(idx + 1).padStart(3, '0')}`
  const loot = []
  // 金币 loot：chance 0.7，数额随 failGold 递增
  loot.push({ type: 'gold', min: Math.max(1, Math.round(failGold * 0.4)), max: Math.max(5, Math.round(failGold * 1.2)), chance: 0.7 })
  // 2~3 条物品 loot（等级带匹配、尽量覆盖全物品库；seed 基于目标序号保证确定性）
  const itemCount = idx % 2 === 0 ? 3 : 2
  const picked = pickLoot(reqLevel, itemCount, 0x9e37 + idx * 7919)
  picked.forEach((p, i) => {
    loot.push({ type: 'item', itemId: p.id, min: 1, max: i === 0 ? 2 : 1, chance: i === 0 ? 0.35 : 0.28 })
  })
  // 名字：按主打掉落物类别定主题，再按 reqLevel 段的 tier 选名（与掉落物呼应、贴合等级档次）
  const name = pickName(themeOf(picked), reqLevel, idx + 1)
  targets.push({ id, name, reqLevel, intervalSec, xp, baseSuccess, failGold, loot })
  idx++
}

// ── 5. 校验 ──────────
const levelVals = targets.map((t) => t.reqLevel)
const xpVals = targets.map((t) => t.xp)
const failVals = targets.map((t) => t.failGold)
const baseVals = targets.map((t) => t.baseSuccess)
const intervalVals = targets.map((t) => t.intervalSec)
const badIds = []
const overLevel = []
const nameSeen = new Set()
const dupNames = []
for (const t of targets) {
  if (nameSeen.has(t.name)) dupNames.push(t.name)
  nameSeen.add(t.name)
  for (const l of t.loot) {
    if (l.type === 'item' && !ITEMS[l.itemId]) { badIds.push(`${t.id}:${l.itemId}`); continue }
    if (l.type === 'item') {
      const ilv = itemLevel.get(l.itemId)
      if (ilv != null && ilv > t.reqLevel + 5) overLevel.push(`${t.id}(${t.reqLevel}) ${l.itemId}(L${ilv}) 超${ilv - t.reqLevel}级`)
    }
  }
}
if (overLevel.length) {
  console.log(`❌ 超纲 loot ${overLevel.length} 条，终止输出（需修复生成器）:`)
  overLevel.slice(0, 10).forEach((x) => console.log(' ', x))
  process.exit(1)
}
console.log(`生成目标数: ${targets.length}`)
console.log(`reqLevel 范围: ${levelVals[0]} ~ ${levelVals[levelVals.length - 1]}`)
console.log(`xp 范围: ${xpVals[0]} ~ ${xpVals[xpVals.length - 1]}`)
console.log(`failGold 范围: ${failVals[0]} ~ ${failVals[failVals.length - 1]}`)
console.log(`baseSuccess 范围: ${baseVals[0]} ~ ${baseVals[baseVals.length - 1]}`)
console.log(`intervalSec 范围: ${intervalVals[0]} ~ ${intervalVals[intervalVals.length - 1]}`)
console.log(`loot 物品 id 无效数: ${badIds.length}`)
console.log(`超纲(>卡片+5)数: ${overLevel.length}`)
console.log(`重名数: ${dupNames.length}`)
if (dupNames.length) console.log(`重名示例: ${dupNames.slice(0, 10).join(', ')}`)
if (badIds.length) console.log(`无效 id: ${badIds.slice(0, 10).join(', ')}`)

const out = `// 美食探索目标扩充（生成器产出，勿手改）— ${new Date().toISOString().slice(0, 10)}
// 由 scripts/gen_exploration_targets.mjs 生成：200 个探索目标，等级 1~99，
// intervalSec/xp 递增、baseSuccess 递减、failGold 递增，战利品按等级带匹配全物品库。
// 修改后重跑 scripts/gen_exploration_targets.mjs。
export const EXPLORATION_TARGETS_ALL = ${JSON.stringify(targets, null, 1)}
`
writeFileSync(join(__OUT_DIR, 'explorationTargets.js'), out, 'utf8')
console.log('已生成 src/game/data/explorationTargets.js')
