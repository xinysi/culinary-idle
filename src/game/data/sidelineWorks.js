// 副业四支（v2.10.0，2026-09-16）——陶艺 / 编织 / 刺绣 / 蜡烛
//
// 定位（用户 2026-09-16 决策，与木工同一条设计线）：
// **副业不产食材，产「经营侧的乘区与独占品」。** 制作类把食材变成能吃能用的东西；
// 副业把**采集原料**变成**采集拿不到的、只能自己做的**经营侧加成。
// 每个副业**只接一条乘区出口**（唯一出口 = 可审计、不会散落各处）：
//
//   | 副业 | 产物 | 出口（唯一） | 每件 | 满级合计 |
//   | --- | --- | --- | --- | --- |
//   | 陶艺 | 陶器 | `player.cellarSlotValueMax()`（地窖单槽基础价值上限） | +1500 | 16000 → 31000 |
//   | 编织 | 织物 | `restaurantHourlyIncome` 的小费因子 | +2% | +20% |
//   | 刺绣 | 绣品 | `michelinScore()` 的「招牌绣屏」分项 | +12 分 | +120 分 |
//   | 蜡烛 | 蜡烛 | 夜市狂潮窗口时长（`marketEvents.js` 的 `nightMarketExtraHours`） | +1h | 16:00→次日 06:00 |
//
// 三条共用纪律（与木工一致，C33 有守卫）：
// 1. **不吃食灵经验加成**（`spiritTiers.js` 的 `effect.xpPct` 是显式枚举，不含这四个 id）；
//    **不进入山海食经**（线↔技能 1:1 白名单）。
// 2. 产物是**副业独占品**：不进任何抽卡池 / 礼包池 / 交易所 / 商队货舱，也不被自动出售
//    （过滤清单见 `SIDELINE_ITEM_CATEGORIES` 的 5 个消费方）。
// 3. **配方以「同档木材」为基材**（伐木是全部副业的共同前置），另加一味该副业的专属辅料：
//    陶艺=矿物（釉料）、编织=茎叶类蔬菜（植物纤维）、刺绣=水果（果染）、蜡烛=肉类（熬脂）。
//    辅料一律取「等级 ≤ 配方等级 + 5」的既有物品，且木材与辅料都满足该式 ⇒
//    `raiseRecipeLevels` 对它们是**恒等变换**（实测 `h − 5 ≤ reqLevel` 全部成立，C33 有「零漂移」断言）。

import { timberOfLevel } from './timbers.js'
import { WOODWORK_CATEGORY, WOODWORKING_RECIPES } from './woodworking.js'

/** 副业产物的物品类别 —— **「副业独占品」的单一来源清单**（木工的 furniture + 本模块四个）。
 *  消费方：`gameShopPools`（礼包池 + 珍馐阁）/ `mijianDraws`（抽卡池）/ `automation`（自动出售）/
 *  `caravan`（商队货舱）。交易所是显式 allow-list，天然不含这些类别。
 *  ⚠️ 新增副业一律往这里加，别在别处再抄一份类别字符串。 */
export const SIDELINE_ITEM_CATEGORIES = [WOODWORK_CATEGORY, 'pottery', 'textile', 'embroidery', 'candle']

/**
 * 效果轴定义：每个副业**作品**（每件一次）贡献的那条轴。
 * `perItem` = 单件增量；`label/amountLabel` 供 UI 与图鉴文案复用。
 */
export const SIDELINE_AXES = {
  cellarValue: { label: '地窖单槽价值上限', amountLabel: (v) => `${v.toLocaleString()} 金币`, perItem: 1500 },
  tipPct: { label: '餐厅小费', amountLabel: (v) => `+${v}%`, perItem: 2 },
  michelinScore: { label: '米其林评分', amountLabel: (v) => `+${v} 分`, perItem: 12 },
  nightHours: { label: '夜市狂潮时长', amountLabel: (v) => `+${v} 小时`, perItem: 1 },
}

// ══════════════════════════════════════════════════════════════════════════════
// 量产阶梯（v2.11.0，2026-09-17）——回答「练满级必然做出几十万件，绝大多数用不掉」
//
// 用户实测提问：「要升满级肯定要制作很多个吧，那也不可能全部都用到」。
// 这个量级是算过的：升到 100 级需要 **3,182,176,592** 经验（曲线按「99→100 = 3 亿」缩放），
// 用最高档配方也要 **≈263 万次**、叠满经验加成后仍是**几万到十几万次**。
// ⇒ 任何「把具体物件用掉」的设计（每槽配一件陶器、每件绣品换一次招牌…）吸收量都是个位数到几十件，
//   对几十万件的产量**等于没设计**。所以产物不该被设计成「要被用掉」，而该按**数量**计价：
//   **喂进一条深阶梯，边练级边推进，一件都不浪费。**
//
// 三层分工：
//   1. **作品**（每件一次，加成大）—— 收集向，10 件
//   2. **量产阶梯**（吃任意产物，按档位计点，加成小但深）—— 量产向，12 档
//   3. **回收**（多余产物半价卖回 = 材料整包卖掉）—— 满档后的兜底（见 valueBalance 的说明）
//
// ⚠️ **绝不能把阶梯/轴挂到「当前技能等级」上**：`prestigeSkill` 在满 100 级时把等级重置为
//    `1 + carry`（carry = ⌊100×0.05⌋ = 5 ⇒ **回到 6 级**）。挂等级 = **转生自罚**，玩家会永远不敢
//    转生这五支，而转生是全局主要长期目标（每层 +20% 经验、上限抬到 120、还给轮回印记）。
//    阶梯吃的是**累计投入点**（只增不减、转生不碰）⇒ 转生只赚不亏。C34 有**行为断言**钉住这条：
//    把五支的技能等级全改成 1，五条轴的派生值必须**一分不变**。
// ══════════════════════════════════════════════════════════════════════════════

/** 阶梯门槛（累计**点**，12 档，×2.5 递增；末档 ≈ 与练到 100 级的产量同量级） */
export const LADDER_TIERS = [10, 25, 60, 150, 400, 1000, 2500, 6000, 15000, 40000, 100000, 250000]

/** 计点：**按档位加权**，`点 = 1 + ⌊配方等级/10⌋` ⇒ Lv1 陶碗 1 点、Lv91 龙凤陶瓮 10 点。
 *  （一件一律 1 点会让高段产物被当柴烧——那正是「高段配方」最不该有的待遇。） */
export function pointsOfLevel(level) {
  return 1 + Math.floor(Math.max(0, level || 0) / 10)
}

/** 累计点 → 已达成档位（0~12；0 = 还没到第一档） */
export function ladderTierOf(points) {
  let tier = 0
  for (const t of LADDER_TIERS) if ((points || 0) >= t) tier++
  return tier
}

/** 下一档还差多少点（已满返回 null） */
export function ladderNextOf(points) {
  for (const t of LADDER_TIERS) if ((points || 0) < t) return { need: t, left: t - (points || 0) }
  return null
}

/** 累计点 → 该轴的阶梯加成合计 */
export function ladderTotalOf(skillId, points) {
  const cfg = SIDELINE_LADDERS.find((l) => l.skill === skillId)
  if (!cfg) return 0
  return Math.round(ladderTierOf(points) * cfg.perTier * 1000) / 1000
}

/**
 * 五支的量产阶梯配置（**含木工**）。
 * `axis` 指阶梯加在哪条轴上；木工的产物已经是「手工装潢」（走 restaurant.decor），
 * 所以它的阶梯加在 `decorPct`（装潢加成）上，而不是自己的新轴。
 */
export const SIDELINE_LADDERS = [
  { skill: 'woodworking', name: '木工', axis: 'decorPct', perTier: 2, unit: (v) => `装潢加成 +${v}%` },
  { skill: 'pottery', name: '陶艺', axis: 'cellarValue', perTier: 750, unit: (v) => `地窖单槽上限 +${v.toLocaleString()}` },
  { skill: 'weaving', name: '编织', axis: 'tipPct', perTier: 1.5, unit: (v) => `小费 +${v}%` },
  { skill: 'embroidery', name: '刺绣', axis: 'michelinScore', perTier: 10, unit: (v) => `招牌分 +${v}` },
  // 蜡烛：**时长**已封顶 +8h（再延就失去「时段」意义），所以阶梯给它加**倍率**
  { skill: 'candles', name: '蜡烛制作', axis: 'nightMult', perTier: 0.03, unit: (v) => `夜市倍率 +${v.toFixed(2)}` },
]

/** 阶梯轴 → 文案（供 UI/效果总览复用） */
export const LADDER_AXIS_LABEL = {
  decorPct: '手工装潢效果',
  cellarValue: '地窖单槽价值上限',
  tipPct: '餐厅小费',
  michelinScore: '米其林招牌分',
  nightMult: '夜市狂潮倍率',
}

/** 每支的产物（含木工）与「一件值多少点」——`feedSideline` 的唯一数据来源。
 *  ⚠️ 必须在下面的配方表展开**之后**才求值（它是 const，不是惰性函数）→ 定义在文件末尾。 */

/** 五支的技能 id（阶梯口径；`SIDELINE_SKILL_IDS` 只含"有自己轴"的四支，两者刻意不同） */
export const SIDELINE_LADDER_SKILL_IDS = SIDELINE_LADDERS.map((l) => l.skill)

/** 10 级一档的常用阶梯（陶艺/编织/刺绣），与 20 档木材天然咬合 */
const LADDER10 = [1, 11, 21, 31, 41, 51, 61, 71, 81, 91]
/** 蜡烛只有 8 件：12 级一档，铺满 Lv1~85 */
const LADDER8 = [1, 13, 25, 37, 49, 61, 73, 85]

/**
 * 四支副业的定义表。`rows` 每行 = `[等级, 物品名, 辅料 id, 木材数量, 辅料数量]`，
 * 木材由 `timberOfLevel(等级)` 自动取该档（不手抄，改档位映射只改一处）。
 * 辅料的选择口径见文件头注释第 3 条。
 */
const DEFS = {
  pottery: {
    skill: 'pottery', name: '陶艺', icon: '🏺', category: 'pottery', catLabel: '陶器',
    axis: 'cellarValue', materialNote: '窑火用木料、釉料取矿物；做成后给地窖扩容（单槽能陈酿更贵的酒）',
    rows: [
      [1, '陶碗', 'ironOre', 2, 2],
      [11, '陶盘', 'steelOre', 2, 2],
      [21, '陶酒壶', 'mithrilOre', 3, 2],
      [31, '陶砂锅', 'adamantOre', 3, 2],
      [41, '陶坛', 'darkIronOre', 3, 2],
      [51, '青瓷花瓶', 'meteoriteOre', 4, 2],
      [61, '彩瓷盖罐', 'dragonScaleOre', 4, 2],
      [71, '彩釉花瓶', 'giltOre', 4, 2],
      [81, '青瓷盘', 'excavation_ext_26', 5, 2],
      [91, '龙凤陶瓮', 'excavation_ext_29', 5, 2],
    ],
  },
  weaving: {
    skill: 'weaving', name: '编织', icon: '🧶', category: 'textile', catLabel: '织物',
    axis: 'tipPct', materialNote: '竹木条作骨、茎叶类取纤维；做成后常客小费更高',
    rows: [
      [1, '竹席', 'foraging_ext_15_young', 2, 2],
      [11, '竹编方篮', 'foraging_ext2_19_young', 2, 2],
      [21, '竹编提篮', 'rosemary_young', 3, 2],
      [31, '棉麻叠布', 'foraging_ext2_10', 3, 2],
      [41, '亚麻桌布', 'pumpkin', 3, 2],
      [51, '布艺窗帘', 'seaweed', 4, 2],
      [61, '锦纹靠垫', 'seaweed', 4, 2],
      [71, '织锦挂毯', 'seaweed', 4, 2],
      [81, '棕丝蓑衣', 'foraging_ext_26', 5, 2],
      [91, '云锦织锦', 'foraging_ext_29', 5, 2],
    ],
  },
  embroidery: {
    skill: 'embroidery', name: '刺绣', icon: '🪡', category: 'embroidery', catLabel: '绣品',
    axis: 'michelinScore', materialNote: '绣架用木料、染料取果染；做成后进米其林的「招牌绣屏」评分',
    rows: [
      [1, '绣花手帕', 'foraging_ext_02', 2, 2],
      [11, '刺绣团扇', 'foraging_ext_05', 2, 2],
      [21, '绣花香囊', 'hamimelon', 3, 2],
      [31, '刺绣插屏', 'banana', 3, 2],
      [41, '龙纹挂旗', 'foraging_ext_14', 3, 2],
      [51, '龙纹锦袍', 'foraging_ext_17', 4, 2],
      [61, '云纹氅衣', 'foraging_ext_20', 4, 2],
      [71, '绣花鞋', 'foraging_ext2_23', 4, 2],
      [81, '金线官袍', 'foraging_ext2_26', 5, 2],
      [91, '百鸟绣卷', 'foraging_ext2_29', 5, 2],
    ],
  },
  candles: {
    skill: 'candles', name: '蜡烛制作', icon: '🕯️', category: 'candle', catLabel: '蜡烛',
    axis: 'nightHours', materialNote: '烛芯用木料、蜡取动物脂；做成后夜市狂潮的营业时段更长',
    rows: [
      [1, '素蜡烛', 'hunting_ext_02', 2, 2],
      [13, '朱红烛', 'hunting_ext_06', 2, 2],
      [25, '绿叶香烛', 'hunting_ext_09', 3, 2],
      [37, '龙凤喜烛', 'hunting_ext_13', 3, 2],
      [49, '八角宫灯', 'hunting_ext_16', 3, 2],
      [61, '香薰浮烛', 'bearMeat', 4, 2],
      [73, '幽蓝寒烛', 'hunting_ext_24', 4, 2],
      [85, '满福金烛', 'hunting_ext_27', 5, 2],
    ],
  },
}

/** 效果轴 → 该轴的满级合计（守卫与文案共用；避免各处手算） */
export const SIDELINE_AXIS_TOTALS = Object.fromEntries(
  Object.entries(DEFS).map(([k, d]) => [d.axis, { skill: k, axis: d.axis, perItem: SIDELINE_AXES[d.axis].perItem, count: d.rows.length, total: SIDELINE_AXES[d.axis].perItem * d.rows.length }]),
)

/** 展开后的物品定义（合并进 ITEMS） */
export const SIDELINE_ITEMS = []
/** 展开后的配方（供各技能实例使用） */
export const SIDELINE_RECIPES = {}
/** 每个产物的归属：itemId → { skill, axis, perItem, nextLevel … }（图鉴/UI/存档校验共用） */
export const SIDELINE_WORKS = {}
/** 四个技能的定义（SkillView 之外的地方读这里取中文名/类别；`SKILL_DEFS` 里也有一份，两边由守卫对齐） */
export const SIDELINE_SKILL_LIST = []

for (const [key, d] of Object.entries(DEFS)) {
  const axis = SIDELINE_AXES[d.axis]
  SIDELINE_RECIPES[key] = []
  SIDELINE_SKILL_LIST.push({ id: d.skill, name: d.name, icon: d.icon, category: d.category, catLabel: d.catLabel, axis: d.axis, works: d.rows.length, materialNote: d.materialNote })
  for (const [level, itemName, auxId, woodQty, auxQty] of d.rows) {
    const id = `${key}_${level}`
    const w = timberOfLevel(level)
    SIDELINE_ITEMS.push({
      id,
      name: itemName,
      type: 'ingredient',
      category: d.category,
      tier: Math.min(10, Math.ceil(level / 10)),
      value: Math.round(2 + level * 2.5),
      stackable: true,
      maxStack: 9999,
    })
    SIDELINE_RECIPES[key].push({
      id: `${key.slice(0, 2)}_${level}`,
      name: itemName,
      category: d.catLabel,
      reqLevel: level,
      xp: Math.round(25 + level * 13),
      successChance: Math.max(0.55, 0.95 - level * 0.0044),
      ingredients: { [w.id]: woodQty, [auxId]: auxQty },
      output: { itemId: id, qty: 1 },
    })
    SIDELINE_WORKS[id] = { itemId: id, name: itemName, catLabel: d.catLabel, skill: d.skill, skillName: d.name, axis: d.axis, amount: axis.perItem, level, woodId: w.id, woodName: w.name, auxId, auxQty, woodQty }
  }
}

/** 该产物是不是副业作品（有定义即有作品） */
export function sidelineWorkOf(itemId) {
  return SIDELINE_WORKS[itemId] ?? null
}

/** 某物品是否属于副业独占类别（furniture 由木工的 woodworking.js 定义，此处单列） */
export function isSidelineCategory(category) {
  return SIDELINE_ITEM_CATEGORIES.includes(category)
}

/** 副业技能 id 列表（守卫与内容同步共用） */
export const SIDELINE_SKILL_IDS = SIDELINE_SKILL_LIST.map((s) => s.id)

/**
 * 每支（**含木工**）的产物与「一件值多少点」——`player.feedSideline()` 的唯一数据来源。
 * 定义在文件末尾：它读的 `SIDELINE_RECIPES` 由上面的 DEFS 循环展开，早求值会拿到空表。
 */
export const SIDELINE_PRODUCTS = (() => {
  const out = {}
  for (const [skill, rows] of Object.entries(SIDELINE_RECIPES)) {
    out[skill] = rows.map((r) => ({ itemId: r.output.itemId, name: r.name, points: pointsOfLevel(r.reqLevel) }))
  }
  // 木工：产物定义在 woodworking.js（它的作品 = 手工装潢，走 restaurant.decor，不在 sidelineWorks 里）
  out.woodworking = WOODWORKING_RECIPES.map((r) => ({ itemId: r.output.itemId, name: r.name, points: pointsOfLevel(r.reqLevel) }))
  return out
})()

/** 某产物属于哪一支（`feedSideline` 反查用；非副业产物返回 null） */
export function sidelineSkillOfItem(itemId) {
  for (const [skill, list] of Object.entries(SIDELINE_PRODUCTS)) {
    const hit = list.find((x) => x.itemId === itemId)
    if (hit) return { skill, points: hit.points, name: hit.name }
  }
  return null
}
