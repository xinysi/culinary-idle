// Lv101-120「补档」· 装备线（批次三，2026-09-29 用户授权 + 出图）
// 16 件 = 4 档 × 4 件（武器 / 身体 / 头盔 / 靴子），档位 Lv104 / 108 / 112 / 116。
//
// 🔴 数值口径（**与锻造 20 品质套完全同一条路**，别在这里手抄终点数值）：
//   · 物品的 `stats` 只写**主维度的占位 1**（`{attack:1}` / `{defense:1}`）——与 `smithSetExt.js` 里
//     那些 `{"attack":1}` / `{"defense":1}` 一模一样：启动时 `itemBalance.js` 会按
//     `center(等级)`（weapon `2+lv*0.37`、body/legs/boots `1+lv*0.28`、helmet `1+lv*0.18`）
//     **覆写主维度**，并按 `aux` 曲线补上 hpBonus/accuracy/evasion/critChance/speedBonus。
//     所以手写的次要属性会被覆盖，**写了也是白写**（本模块因此只写主维度）。
//   · `tier` = `equipTierFor(等级)`（104/108/112/116 都夹到 **10**）· `quality` = `equipQualityFor(等级)`
//     （>60 级恒 **神话**）——这两项必须手写：itemBalance 只对 `smithSetExt` 的表重算它们。
//   · `value`：既有顶档套 600~630 ⇒ 本批 660 / 680 / 700 / 720（随档单调）。
//
// 🔴 材料口径：**新料 + 盐矿 + 同档新木**（既有顶档套的形状是「矿×N + 盐矿×N」；木材那条线只在
//   `retargetTimberMaterials` 里对 `smithSetExt` 生效，手写配方要显式写木）。
//   全部满足「材料获取等级 ≤ 配方等级 + 5」：Lv102 料 → 104/108 档 ✓、Lv112 料 → 112/116 档 ✓。
//
// 🔴 为什么写在新模块而不是 push 进 `SMITHING_SET_RECIPES`：那张表是**生成器产物**
//   （`gen_smith_sets.mjs`，且文件头写明重跑前要清空导出、否则自引用污染）⇒ 一个字节都不能动。
//   本模块的两张表由 `CraftsmithingSkill` 与 `itemBalance` 各自 import 后**拼在右边**使用。
//
// 图：`public/images/items/equipment/<中文名>.png`（64×64 RGBA，用户 2026-09-29 出图，
//   **深底 + 发光描边**风格 ⇒ 入库时走 `process_item_images.py --bg dark` 分支，见该脚本头部说明）。

/** 四档（每档 4 件：武器/身体/头盔/靴子）。用**显式字段**而不是位置元组 —— 位置元组加一个字段就数错下标。 */
const BANDS = [
  {
    level: 104, value: 660, wood: 'late_wood_01', ore: 'late_min_01', woodQty: 3, oreQty: 5, saltQty: 3,
    pieces: { weapon: '陨砂短刃', body: '陨砂护胸', helmet: '陨砂面罩', boots: '陨砂踏靴' },
  },
  {
    level: 108, value: 680, wood: 'late_wood_01', ore: 'late_min_01', woodQty: 5, oreQty: 4, saltQty: 4,
    pieces: { weapon: '玄铁长刀', body: '玄铁战袍', helmet: '玄铁额冠', boots: '玄铁战履' },
  },
  {
    level: 112, value: 700, wood: 'late_wood_02', ore: 'late_min_02', woodQty: 3, oreQty: 5, saltQty: 3,
    pieces: { weapon: '赤霄重刃', body: '赤霄鳞甲', helmet: '赤霄龙盔', boots: '赤霄疾靴' },
  },
  {
    level: 116, value: 720, wood: 'late_wood_02', ore: 'late_min_02', woodQty: 6, oreQty: 6, saltQty: 5,
    pieces: { weapon: '天罡神兵', body: '天罡天衣', helmet: '天罡华冠', boots: '天罡云履' },
  },
]

const SLOTS = ['weapon', 'body', 'helmet', 'boots']
const CAT_LABEL = { weapon: '武器', body: '身体', helmet: '头盔', boots: '靴子' }

/** 装备 id：`lateGear<Lv><Slot>`（稳定、可读、与任何既有 id 不冲突） */
const idOf = (level, slot) => `lateGear${level}${slot[0].toUpperCase()}${slot.slice(1)}`

/** 装备物品定义（槽位主维度写占位 1，真正的数值由 itemBalance 启动时覆写） */
export const LATE_GEAR_ITEMS = BANDS.flatMap((b) =>
  SLOTS.map((slot) => ({
    id: idOf(b.level, slot),
    name: b.pieces[slot],
    type: 'equipment',
    category: slot, // 与既有装备同口径：category 就是槽位名（见 explorationGear.js 的同款说明）
    tier: 10, // equipTierFor(104~116) 全部夹到 10
    value: b.value,
    stackable: false,
    maxStack: 9999,
    slot,
    quality: '神话', // equipQualityFor(>60) 恒神话
    stats: slot === 'weapon' ? { attack: 1 } : { defense: 1 },
  })),
)

/** 锻造配方（`xp`/`successChance` 沿 `gen_expansion2.mjs` 的锻造式子：level×16 / 0.9−0.0035×level） */
export const LATE_GEAR_RECIPES = BANDS.flatMap((b) =>
  SLOTS.map((slot) => ({
    id: `lateg_${slot}_${b.level}`,
    name: b.pieces[slot],
    category: CAT_LABEL[slot],
    reqLevel: b.level,
    xp: b.level * 16,
    successChance: Math.max(0.5, Math.round((0.9 - b.level * 0.0035) * 100) / 100),
    ingredients: { [b.ore]: b.oreQty, [b.wood]: b.woodQty, saltOre: b.saltQty },
    output: { itemId: idOf(b.level, slot), qty: 1 },
  })),
)

/** 本批装备 id（觅珍厨具池排除用：18 档差异化的顶级装备不该从 500 金/抽里抽出来） */
export const LATE_GEAR_IDS = LATE_GEAR_ITEMS.map((it) => it.id)