// 山海食经 · 收集科技树（生成器 scripts/gen/gen_shanhai_tree.mjs 产出，2026-10-01，勿手改）
//
// 口径：12 条收集线 × 10 环（前 5 环各 3 节点、第 6~10 环各 5 节点）= 552 节点；**纯条件点亮**（不消耗资源）。
// 条件只用已持久化的玩家状态：该线可收集物品的已收集件数 + 该技能等级 + 该技能精通总级数（req.kind 恒为 'codex'）。
// 前 6 环＝收集/等级曲线；第 7 环＝该技能 100 级；第 8~10 环＝精通总级数达满分 60% / 80% / 100%
//   （2026-09-29 从「转生 1/5/10 次」改过来：精通是**动作轴**，实测只被 XP 乘区压 1.11×，
//    而转生/等级是经验轴、会被压 59× —— 长线挂在这条轴上才不会被 high-buff 玩家一小时刷完）。
// 🔴 **线级缩放**：门槛单位是「该线精通总级数 = 卡数 × 100」，而各线「一张卡」的时间量纲不同
//   （稼穑一张卡 = 3750 次收获 ÷ 地块数 × 生长秒数 = 10~65 小时）⇒ 稼穑按 SHANHAI_PATH_MASTERY_SCALE 缩放
//   （分支环与汇金环都缩；汇金取两侧较低者），否则全树天花板由它一条线单独决定。
// 奖励只用固定数值：inventoryCap / bankCap / coldStorageCap / offlineH / flatYield / gold（无任何百分比）。
// 第 6~10 环**正中间**那个节点 = 金币节点（数额见 GOLD_BY_RING）。
// 节点图标：iconItem（该线该深度位置的物品 id，画布用 public/images/items 的物品图渲染；icon 为 emoji 兜底）。
// 阈值为**按该线物品总数取比例**（0.06 / 0.15 / 0.3 / 0.5 / 0.7 / 0.9 / 0.9 / 0.9 / 0.9 / 0.9），物品增删后重跑本脚本即可同步。

export const SHANHAI_PATHS = [
  {
    "id": "pick",
    "skill": "foraging",
    "name": "采撷",
    "icon": "🌾",
    "desc": "152 件可收集",
    "total": 152
  },
  {
    "id": "fish",
    "skill": "fishing",
    "name": "渔获",
    "icon": "🎣",
    "desc": "83 件可收集",
    "total": 83
  },
  {
    "id": "hunt",
    "skill": "hunting",
    "name": "山猎",
    "icon": "🏹",
    "desc": "80 件可收集",
    "total": 80
  },
  {
    "id": "dig",
    "skill": "excavation",
    "name": "掘藏",
    "icon": "⛏️",
    "desc": "58 件可收集",
    "total": 58
  },
  {
    "id": "farm",
    "skill": "farming",
    "name": "稼穑",
    "icon": "🚜",
    "desc": "205 件可收集",
    "total": 205
  },
  {
    "id": "cook",
    "skill": "cooking",
    "name": "烹煮",
    "icon": "🍳",
    "desc": "305 件可收集",
    "total": 305
  },
  {
    "id": "bake",
    "skill": "baking",
    "name": "烘焙",
    "icon": "🥖",
    "desc": "102 件可收集",
    "total": 102
  },
  {
    "id": "brew",
    "skill": "brewing",
    "name": "酿造",
    "icon": "🍶",
    "desc": "132 件可收集",
    "total": 132
  },
  {
    "id": "spice",
    "skill": "spiceMixing",
    "name": "调味",
    "icon": "🧂",
    "desc": "99 件可收集",
    "total": 99
  },
  {
    "id": "smith",
    "skill": "craftsmithing",
    "name": "锻造",
    "icon": "🔨",
    "desc": "381 件可收集",
    "total": 381
  },
  {
    "id": "wood",
    "skill": "woodcutting",
    "name": "伐薪",
    "icon": "🪓",
    "desc": "22 件可收集",
    "total": 22
  },
  {
    "id": "ore",
    "skill": "mining",
    "name": "矿脉",
    "icon": "⛏️",
    "desc": "45 件可收集",
    "total": 45
  }
]

/** 每环的展示名与门槛（文案用；数值门槛已写进各节点 req） */
export const SHANHAI_RINGS = [
  {
    "ring": 1,
    "name": "初识",
    "level": 0,
    "prestige": 0,
    "masteryPct": 0
  },
  {
    "ring": 2,
    "name": "渐熟",
    "level": 0,
    "prestige": 0,
    "masteryPct": 0
  },
  {
    "ring": 3,
    "name": "通晓",
    "level": 0,
    "prestige": 0,
    "masteryPct": 0
  },
  {
    "ring": 4,
    "name": "精研",
    "level": 20,
    "prestige": 0,
    "masteryPct": 0
  },
  {
    "ring": 5,
    "name": "大成",
    "level": 45,
    "prestige": 0,
    "masteryPct": 0
  },
  {
    "ring": 6,
    "name": "化境",
    "level": 75,
    "prestige": 0,
    "masteryPct": 0
  },
  {
    "ring": 7,
    "name": "圆满",
    "level": 100,
    "prestige": 0,
    "masteryPct": 0
  },
  {
    "ring": 8,
    "name": "轮回",
    "level": 0,
    "prestige": 0,
    "masteryPct": 0.6
  },
  {
    "ring": 9,
    "name": "历劫",
    "level": 0,
    "prestige": 0,
    "masteryPct": 0.8
  },
  {
    "ring": 10,
    "name": "悟道",
    "level": 0,
    "prestige": 0,
    "masteryPct": 1
  }
]

/** 线级精通门槛缩放（基准比例的乘数；未列出的线 = 1）。**只有被授权的线能在表里**，守卫会核。
 *  稼穑 0.25：它的「一张卡」= 3750 次收获 ÷ 地块数 × 生长秒数（10~65 小时），是其它线的 10~20 倍量纲
 *  ⇒ 不缩放的话全树天花板由它一条线决定（实测 151.2 天 vs 第二名 40.2 天）。理由详见生成器同名字段。 */
export const SHANHAI_PATH_MASTERY_SCALE = {
  "farm": 0.5
}

export const SHANHAI_NODES = [
  {
    "id": "pick11",
    "path": "pick",
    "ring": 1,
    "name": "采撷·初识录",
    "icon": "🌱",
    "iconItem": "foraging_ext2_01",
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "count": 10,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "采撷线收集 10 件 → 背包格数 +1"
  },
  {
    "id": "pick12",
    "path": "pick",
    "ring": 1,
    "name": "采撷·初识谱",
    "icon": "🌱",
    "iconItem": "garlic_young",
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "count": 10,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "采撷线收集 10 件 → 背包格数 +1"
  },
  {
    "id": "pick13",
    "path": "pick",
    "ring": 1,
    "name": "采撷·初识典",
    "icon": "🌱",
    "iconItem": "hamimelon_young",
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "count": 10,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "采撷线收集 10 件 → 背包格数 +1"
  },
  {
    "id": "pick21",
    "path": "pick",
    "ring": 2,
    "name": "采撷·渐熟录",
    "icon": "🍃",
    "iconItem": "rosella_young",
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "count": 23,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "采撷线收集 23 件 → 背包格数 +1"
  },
  {
    "id": "pick22",
    "path": "pick",
    "ring": 2,
    "name": "采撷·渐熟谱",
    "icon": "🍃",
    "iconItem": "foraging_ext_02",
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "count": 23,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "采撷线收集 23 件 → 背包格数 +1"
  },
  {
    "id": "pick23",
    "path": "pick",
    "ring": 2,
    "name": "采撷·渐熟典",
    "icon": "🍃",
    "iconItem": "strawberry_young",
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "count": 23,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "采撷线收集 23 件 → 背包格数 +1"
  },
  {
    "id": "pick31",
    "path": "pick",
    "ring": 3,
    "name": "采撷·通晓录",
    "icon": "🌿",
    "iconItem": "cucumber",
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "count": 46,
      "level": 0
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "采撷线收集 46 件 → 厨藏格数 +1"
  },
  {
    "id": "pick32",
    "path": "pick",
    "ring": 3,
    "name": "采撷·通晓谱",
    "icon": "🌿",
    "iconItem": "jasmine_young",
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "count": 46,
      "level": 0
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "采撷线收集 46 件 → 厨藏格数 +1"
  },
  {
    "id": "pick33",
    "path": "pick",
    "ring": 3,
    "name": "采撷·通晓典",
    "icon": "🌿",
    "iconItem": "soybean",
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "count": 46,
      "level": 0
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "采撷线收集 46 件 → 厨藏格数 +1"
  },
  {
    "id": "pick41",
    "path": "pick",
    "ring": 4,
    "name": "采撷·精研录",
    "icon": "🍀",
    "iconItem": "pumpkin_young",
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "count": 76,
      "level": 20
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "采撷线收集 76 件、采撷技能达 20 级 → 厨藏格数 +1"
  },
  {
    "id": "pick42",
    "path": "pick",
    "ring": 4,
    "name": "采撷·精研谱",
    "icon": "🍀",
    "iconItem": "strawberry",
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "count": 76,
      "level": 20
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "采撷线收集 76 件、采撷技能达 20 级 → 厨藏格数 +1"
  },
  {
    "id": "pick43",
    "path": "pick",
    "ring": 4,
    "name": "采撷·精研典",
    "icon": "🍀",
    "iconItem": "redBean",
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "count": 76,
      "level": 20
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "采撷线收集 76 件、采撷技能达 20 级 → 厨藏格数 +1"
  },
  {
    "id": "pick51",
    "path": "pick",
    "ring": 5,
    "name": "采撷·大成录",
    "icon": "🌾",
    "iconItem": "pepper",
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "count": 107,
      "level": 45
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "采撷线收集 107 件、采撷技能达 45 级 → 厨藏格数 +1"
  },
  {
    "id": "pick52",
    "path": "pick",
    "ring": 5,
    "name": "采撷·大成谱",
    "icon": "🌾",
    "iconItem": "sodaWater",
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "count": 107,
      "level": 45
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "采撷线收集 107 件、采撷技能达 45 级 → 厨藏格数 +1"
  },
  {
    "id": "pick53",
    "path": "pick",
    "ring": 5,
    "name": "采撷·大成典",
    "icon": "🌾",
    "iconItem": "bayLeaf",
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "count": 107,
      "level": 45
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "采撷线收集 107 件、采撷技能达 45 级 → 厨藏格数 +1"
  },
  {
    "id": "pick61",
    "path": "pick",
    "ring": 6,
    "name": "采撷·化境录",
    "icon": "🌳",
    "iconItem": "foraging_ext_12",
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "count": 137,
      "level": 75
    },
    "effect": {
      "field": "offlineH",
      "amount": 1
    },
    "desc": "采撷线收集 137 件、采撷技能达 75 级 → 离线收益时长上限 +1 小时"
  },
  {
    "id": "pick62",
    "path": "pick",
    "ring": 6,
    "name": "采撷·化境谱",
    "icon": "🌳",
    "iconItem": "tsaoKo",
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "count": 137,
      "level": 75
    },
    "effect": {
      "field": "flatYield",
      "amount": 1
    },
    "desc": "采撷线收集 137 件、采撷技能达 75 级 → 采撷每次动作额外 +1 件"
  },
  {
    "id": "pick63",
    "path": "pick",
    "ring": 6,
    "name": "采撷·化境典",
    "icon": "🌳",
    "iconItem": "amomum",
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "count": 137,
      "level": 75
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "采撷线收集 137 件、采撷技能达 75 级 → 冷库格数 +1"
  },
  {
    "id": "pick64",
    "path": "pick",
    "ring": 6,
    "name": "采撷·化境章",
    "icon": "🌳",
    "iconItem": "foraging_ext_14",
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "count": 137,
      "level": 75
    },
    "effect": {
      "field": "bankCap",
      "amount": 2
    },
    "desc": "采撷线收集 137 件、采撷技能达 75 级 → 厨藏格数 +2"
  },
  {
    "id": "pick65",
    "path": "pick",
    "ring": 6,
    "name": "采撷·化境卷",
    "icon": "🌳",
    "iconItem": "chenpi",
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "count": 137,
      "level": 75
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "采撷线收集 137 件、采撷技能达 75 级 → 背包格数 +1"
  },
  {
    "id": "pick71",
    "path": "pick",
    "ring": 7,
    "name": "采撷·圆满录",
    "icon": "🍄",
    "iconItem": "foraging_ext2_16",
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "count": 137,
      "level": 100
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "采撷线收集 137 件、采撷技能达 100 级 → 背包格数 +2"
  },
  {
    "id": "pick72",
    "path": "pick",
    "ring": 7,
    "name": "采撷·圆满谱",
    "icon": "🍄",
    "iconItem": "sansho",
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "count": 137,
      "level": 100
    },
    "effect": {
      "field": "flatYield",
      "amount": 1
    },
    "desc": "采撷线收集 137 件、采撷技能达 100 级 → 采撷每次动作额外 +1 件"
  },
  {
    "id": "pick73",
    "path": "pick",
    "ring": 7,
    "name": "采撷·圆满典",
    "icon": "🍄",
    "iconItem": "foraging_ext_17",
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "count": 137,
      "level": 100
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "采撷线收集 137 件、采撷技能达 100 级 → 冷库格数 +1"
  },
  {
    "id": "pick74",
    "path": "pick",
    "ring": 7,
    "name": "采撷·圆满章",
    "icon": "🍄",
    "iconItem": "foraging_ext2_18",
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "count": 137,
      "level": 100
    },
    "effect": {
      "field": "bankCap",
      "amount": 2
    },
    "desc": "采撷线收集 137 件、采撷技能达 100 级 → 厨藏格数 +2"
  },
  {
    "id": "pick75",
    "path": "pick",
    "ring": 7,
    "name": "采撷·圆满卷",
    "icon": "🍄",
    "iconItem": "oregano",
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "count": 137,
      "level": 100
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "采撷线收集 137 件、采撷技能达 100 级 → 背包格数 +1"
  },
  {
    "id": "pick81",
    "path": "pick",
    "ring": 8,
    "name": "采撷·轮回录",
    "icon": "🌰",
    "iconItem": "parsley",
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "count": 137,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "采撷线收集 137 件、采撷技能精通总级数达满分 60%（按动作次数涨） → 背包格数 +2"
  },
  {
    "id": "pick82",
    "path": "pick",
    "ring": 8,
    "name": "采撷·轮回谱",
    "icon": "🌰",
    "iconItem": "foraging_ext2_20",
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "count": 137,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "bankCap",
      "amount": 3
    },
    "desc": "采撷线收集 137 件、采撷技能精通总级数达满分 60%（按动作次数涨） → 厨藏格数 +3"
  },
  {
    "id": "pick83",
    "path": "pick",
    "ring": 8,
    "name": "采撷·轮回典",
    "icon": "🌰",
    "iconItem": "foraging_ext2_21",
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "count": 137,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "采撷线收集 137 件、采撷技能精通总级数达满分 60%（按动作次数涨） → 冷库格数 +1"
  },
  {
    "id": "pick84",
    "path": "pick",
    "ring": 8,
    "name": "采撷·轮回章",
    "icon": "🌰",
    "iconItem": "foraging_ext2_22",
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "count": 137,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "bankCap",
      "amount": 2
    },
    "desc": "采撷线收集 137 件、采撷技能精通总级数达满分 60%（按动作次数涨） → 厨藏格数 +2"
  },
  {
    "id": "pick85",
    "path": "pick",
    "ring": 8,
    "name": "采撷·轮回卷",
    "icon": "🌰",
    "iconItem": "foraging_ext2_23",
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "count": 137,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "采撷线收集 137 件、采撷技能精通总级数达满分 60%（按动作次数涨） → 背包格数 +1"
  },
  {
    "id": "pick91",
    "path": "pick",
    "ring": 9,
    "name": "采撷·历劫录",
    "icon": "🪴",
    "iconItem": "truffle",
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "count": 137,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 3
    },
    "desc": "采撷线收集 137 件、采撷技能精通总级数达满分 80%（按动作次数涨） → 背包格数 +3"
  },
  {
    "id": "pick92",
    "path": "pick",
    "ring": 9,
    "name": "采撷·历劫谱",
    "icon": "🪴",
    "iconItem": "foraging_ext2_26",
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "count": 137,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "bankCap",
      "amount": 4
    },
    "desc": "采撷线收集 137 件、采撷技能精通总级数达满分 80%（按动作次数涨） → 厨藏格数 +4"
  },
  {
    "id": "pick93",
    "path": "pick",
    "ring": 9,
    "name": "采撷·历劫典",
    "icon": "🪴",
    "iconItem": "foraging_ext2_27",
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "count": 137,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "采撷线收集 137 件、采撷技能精通总级数达满分 80%（按动作次数涨） → 冷库格数 +1"
  },
  {
    "id": "pick94",
    "path": "pick",
    "ring": 9,
    "name": "采撷·历劫章",
    "icon": "🪴",
    "iconItem": "spiritFruit",
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "count": 137,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "bankCap",
      "amount": 3
    },
    "desc": "采撷线收集 137 件、采撷技能精通总级数达满分 80%（按动作次数涨） → 厨藏格数 +3"
  },
  {
    "id": "pick95",
    "path": "pick",
    "ring": 9,
    "name": "采撷·历劫卷",
    "icon": "🪴",
    "iconItem": "foraging_ext_28",
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "count": 137,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "采撷线收集 137 件、采撷技能精通总级数达满分 80%（按动作次数涨） → 背包格数 +2"
  },
  {
    "id": "pick101",
    "path": "pick",
    "ring": 10,
    "name": "采撷·悟道录",
    "icon": "🌲",
    "iconItem": "foraging_ext2_30",
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "count": 137,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 3
    },
    "desc": "采撷线收集 137 件、采撷技能精通总级数达满分 100%（按动作次数涨） → 背包格数 +3"
  },
  {
    "id": "pick102",
    "path": "pick",
    "ring": 10,
    "name": "采撷·悟道谱",
    "icon": "🌲",
    "iconItem": "late_for_01",
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "count": 137,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "bankCap",
      "amount": 5
    },
    "desc": "采撷线收集 137 件、采撷技能精通总级数达满分 100%（按动作次数涨） → 厨藏格数 +5"
  },
  {
    "id": "pick103",
    "path": "pick",
    "ring": 10,
    "name": "采撷·悟道典",
    "icon": "🌲",
    "iconItem": "gap_for_103",
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "count": 137,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "offlineH",
      "amount": 1
    },
    "desc": "采撷线收集 137 件、采撷技能精通总级数达满分 100%（按动作次数涨） → 离线收益时长上限 +1 小时（全树最后一小时）"
  },
  {
    "id": "pick104",
    "path": "pick",
    "ring": 10,
    "name": "采撷·悟道章",
    "icon": "🌲",
    "iconItem": "gap_for_109",
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "count": 137,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "bankCap",
      "amount": 3
    },
    "desc": "采撷线收集 137 件、采撷技能精通总级数达满分 100%（按动作次数涨） → 厨藏格数 +3"
  },
  {
    "id": "pick105",
    "path": "pick",
    "ring": 10,
    "name": "采撷·悟道卷",
    "icon": "🌲",
    "iconItem": "gap_for_113",
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "count": 137,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "采撷线收集 137 件、采撷技能精通总级数达满分 100%（按动作次数涨） → 背包格数 +2"
  },
  {
    "id": "fish11",
    "path": "fish",
    "ring": 1,
    "name": "渔获·初识录",
    "icon": "🐟",
    "iconItem": "fishing_ext_01",
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "count": 5,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "渔获线收集 5 件 → 背包格数 +1"
  },
  {
    "id": "fish12",
    "path": "fish",
    "ring": 1,
    "name": "渔获·初识谱",
    "icon": "🐟",
    "iconItem": "fishing_ext2_02",
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "count": 5,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "渔获线收集 5 件 → 背包格数 +1"
  },
  {
    "id": "fish13",
    "path": "fish",
    "ring": 1,
    "name": "渔获·初识典",
    "icon": "🐟",
    "iconItem": "carp",
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "count": 5,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "渔获线收集 5 件 → 背包格数 +1"
  },
  {
    "id": "fish21",
    "path": "fish",
    "ring": 2,
    "name": "渔获·渐熟录",
    "icon": "🐠",
    "iconItem": "fishing_ext2_04",
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "count": 13,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "渔获线收集 13 件 → 背包格数 +1"
  },
  {
    "id": "fish22",
    "path": "fish",
    "ring": 2,
    "name": "渔获·渐熟谱",
    "icon": "🐠",
    "iconItem": "fishing_ext_04",
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "count": 13,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "渔获线收集 13 件 → 背包格数 +1"
  },
  {
    "id": "fish23",
    "path": "fish",
    "ring": 2,
    "name": "渔获·渐熟典",
    "icon": "🐠",
    "iconItem": "fishing_ext2_05",
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "count": 13,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "渔获线收集 13 件 → 背包格数 +1"
  },
  {
    "id": "fish31",
    "path": "fish",
    "ring": 3,
    "name": "渔获·通晓录",
    "icon": "🦐",
    "iconItem": "fishing_ext2_08",
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "count": 25,
      "level": 0
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "渔获线收集 25 件 → 厨藏格数 +1"
  },
  {
    "id": "fish32",
    "path": "fish",
    "ring": 3,
    "name": "渔获·通晓谱",
    "icon": "🦐",
    "iconItem": "tuna",
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "count": 25,
      "level": 0
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "渔获线收集 25 件 → 厨藏格数 +1"
  },
  {
    "id": "fish33",
    "path": "fish",
    "ring": 3,
    "name": "渔获·通晓典",
    "icon": "🦐",
    "iconItem": "fishing_ext2_09",
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "count": 25,
      "level": 0
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "渔获线收集 25 件 → 厨藏格数 +1"
  },
  {
    "id": "fish41",
    "path": "fish",
    "ring": 4,
    "name": "渔获·精研录",
    "icon": "🦀",
    "iconItem": "fishing_ext2_12",
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "count": 42,
      "level": 20
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "渔获线收集 42 件、渔获技能达 20 级 → 厨藏格数 +1"
  },
  {
    "id": "fish42",
    "path": "fish",
    "ring": 4,
    "name": "渔获·精研谱",
    "icon": "🦀",
    "iconItem": "fishing_ext2_13",
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "count": 42,
      "level": 20
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "渔获线收集 42 件、渔获技能达 20 级 → 厨藏格数 +1"
  },
  {
    "id": "fish43",
    "path": "fish",
    "ring": 4,
    "name": "渔获·精研典",
    "icon": "🦀",
    "iconItem": "fishing_ext_13",
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "count": 42,
      "level": 20
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "渔获线收集 42 件、渔获技能达 20 级 → 厨藏格数 +1"
  },
  {
    "id": "fish51",
    "path": "fish",
    "ring": 5,
    "name": "渔获·大成录",
    "icon": "🐙",
    "iconItem": "fishing_ext_16",
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "count": 59,
      "level": 45
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "渔获线收集 59 件、渔获技能达 45 级 → 厨藏格数 +1"
  },
  {
    "id": "fish52",
    "path": "fish",
    "ring": 5,
    "name": "渔获·大成谱",
    "icon": "🐙",
    "iconItem": "crab",
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "count": 59,
      "level": 45
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "渔获线收集 59 件、渔获技能达 45 级 → 厨藏格数 +1"
  },
  {
    "id": "fish53",
    "path": "fish",
    "ring": 5,
    "name": "渔获·大成典",
    "icon": "🐙",
    "iconItem": "fishing_ext_17",
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "count": 59,
      "level": 45
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "渔获线收集 59 件、渔获技能达 45 级 → 厨藏格数 +1"
  },
  {
    "id": "fish61",
    "path": "fish",
    "ring": 6,
    "name": "渔获·化境录",
    "icon": "🐋",
    "iconItem": "abalone",
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "count": 75,
      "level": 75
    },
    "effect": {
      "field": "offlineH",
      "amount": 1
    },
    "desc": "渔获线收集 75 件、渔获技能达 75 级 → 离线收益时长上限 +1 小时"
  },
  {
    "id": "fish62",
    "path": "fish",
    "ring": 6,
    "name": "渔获·化境谱",
    "icon": "🐋",
    "iconItem": "fishing_ext2_20",
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "count": 75,
      "level": 75
    },
    "effect": {
      "field": "flatYield",
      "amount": 1
    },
    "desc": "渔获线收集 75 件、渔获技能达 75 级 → 渔获每次动作额外 +1 件"
  },
  {
    "id": "fish63",
    "path": "fish",
    "ring": 6,
    "name": "渔获·化境典",
    "icon": "🐋",
    "iconItem": "fishing_ext_20",
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "count": 75,
      "level": 75
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "渔获线收集 75 件、渔获技能达 75 级 → 冷库格数 +1"
  },
  {
    "id": "fish64",
    "path": "fish",
    "ring": 6,
    "name": "渔获·化境章",
    "icon": "🐋",
    "iconItem": "fishing_ext2_21",
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "count": 75,
      "level": 75
    },
    "effect": {
      "field": "bankCap",
      "amount": 2
    },
    "desc": "渔获线收集 75 件、渔获技能达 75 级 → 厨藏格数 +2"
  },
  {
    "id": "fish65",
    "path": "fish",
    "ring": 6,
    "name": "渔获·化境卷",
    "icon": "🐋",
    "iconItem": "fishing_ext2_22",
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "count": 75,
      "level": 75
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "渔获线收集 75 件、渔获技能达 75 级 → 背包格数 +1"
  },
  {
    "id": "fish71",
    "path": "fish",
    "ring": 7,
    "name": "渔获·圆满录",
    "icon": "🦑",
    "iconItem": "fishing_ext2_23",
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "count": 75,
      "level": 100
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "渔获线收集 75 件、渔获技能达 100 级 → 背包格数 +2"
  },
  {
    "id": "fish72",
    "path": "fish",
    "ring": 7,
    "name": "渔获·圆满谱",
    "icon": "🦑",
    "iconItem": "fishing_ext_23",
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "count": 75,
      "level": 100
    },
    "effect": {
      "field": "flatYield",
      "amount": 1
    },
    "desc": "渔获线收集 75 件、渔获技能达 100 级 → 渔获每次动作额外 +1 件"
  },
  {
    "id": "fish73",
    "path": "fish",
    "ring": 7,
    "name": "渔获·圆满典",
    "icon": "🦑",
    "iconItem": "seaCucumber",
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "count": 75,
      "level": 100
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "渔获线收集 75 件、渔获技能达 100 级 → 冷库格数 +1"
  },
  {
    "id": "fish74",
    "path": "fish",
    "ring": 7,
    "name": "渔获·圆满章",
    "icon": "🦑",
    "iconItem": "fishing_ext_24",
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "count": 75,
      "level": 100
    },
    "effect": {
      "field": "bankCap",
      "amount": 2
    },
    "desc": "渔获线收集 75 件、渔获技能达 100 级 → 厨藏格数 +2"
  },
  {
    "id": "fish75",
    "path": "fish",
    "ring": 7,
    "name": "渔获·圆满卷",
    "icon": "🦑",
    "iconItem": "blackMarlin",
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "count": 75,
      "level": 100
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "渔获线收集 75 件、渔获技能达 100 级 → 背包格数 +1"
  },
  {
    "id": "fish81",
    "path": "fish",
    "ring": 8,
    "name": "渔获·轮回录",
    "icon": "🐚",
    "iconItem": "fishing_ext_25",
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "count": 75,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "渔获线收集 75 件、渔获技能精通总级数达满分 60%（按动作次数涨） → 背包格数 +2"
  },
  {
    "id": "fish82",
    "path": "fish",
    "ring": 8,
    "name": "渔获·轮回谱",
    "icon": "🐚",
    "iconItem": "fishing_ext2_26",
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "count": 75,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "bankCap",
      "amount": 3
    },
    "desc": "渔获线收集 75 件、渔获技能精通总级数达满分 60%（按动作次数涨） → 厨藏格数 +3"
  },
  {
    "id": "fish83",
    "path": "fish",
    "ring": 8,
    "name": "渔获·轮回典",
    "icon": "🐚",
    "iconItem": "fishing_ext_26",
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "count": 75,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "渔获线收集 75 件、渔获技能精通总级数达满分 60%（按动作次数涨） → 冷库格数 +1"
  },
  {
    "id": "fish84",
    "path": "fish",
    "ring": 8,
    "name": "渔获·轮回章",
    "icon": "🐚",
    "iconItem": "fishing_ext2_27",
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "count": 75,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "bankCap",
      "amount": 2
    },
    "desc": "渔获线收集 75 件、渔获技能精通总级数达满分 60%（按动作次数涨） → 厨藏格数 +2"
  },
  {
    "id": "fish85",
    "path": "fish",
    "ring": 8,
    "name": "渔获·轮回卷",
    "icon": "🐚",
    "iconItem": "fishing_ext_27",
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "count": 75,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "渔获线收集 75 件、渔获技能精通总级数达满分 60%（按动作次数涨） → 背包格数 +1"
  },
  {
    "id": "fish91",
    "path": "fish",
    "ring": 9,
    "name": "渔获·历劫录",
    "icon": "🦞",
    "iconItem": "fishing_ext_28",
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "count": 75,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 3
    },
    "desc": "渔获线收集 75 件、渔获技能精通总级数达满分 80%（按动作次数涨） → 背包格数 +3"
  },
  {
    "id": "fish92",
    "path": "fish",
    "ring": 9,
    "name": "渔获·历劫谱",
    "icon": "🦞",
    "iconItem": "fishing_ext2_29",
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "count": 75,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "bankCap",
      "amount": 4
    },
    "desc": "渔获线收集 75 件、渔获技能精通总级数达满分 80%（按动作次数涨） → 厨藏格数 +4"
  },
  {
    "id": "fish93",
    "path": "fish",
    "ring": 9,
    "name": "渔获·历劫典",
    "icon": "🦞",
    "iconItem": "fishing_ext_29",
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "count": 75,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "渔获线收集 75 件、渔获技能精通总级数达满分 80%（按动作次数涨） → 冷库格数 +1"
  },
  {
    "id": "fish94",
    "path": "fish",
    "ring": 9,
    "name": "渔获·历劫章",
    "icon": "🦞",
    "iconItem": "grouper",
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "count": 75,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "bankCap",
      "amount": 3
    },
    "desc": "渔获线收集 75 件、渔获技能精通总级数达满分 80%（按动作次数涨） → 厨藏格数 +3"
  },
  {
    "id": "fish95",
    "path": "fish",
    "ring": 9,
    "name": "渔获·历劫卷",
    "icon": "🦞",
    "iconItem": "fishing_ext_30",
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "count": 75,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "渔获线收集 75 件、渔获技能精通总级数达满分 80%（按动作次数涨） → 背包格数 +2"
  },
  {
    "id": "fish101",
    "path": "fish",
    "ring": 10,
    "name": "渔获·悟道录",
    "icon": "🐳",
    "iconItem": "gap_fish_101",
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "count": 75,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 3
    },
    "desc": "渔获线收集 75 件、渔获技能精通总级数达满分 100%（按动作次数涨） → 背包格数 +3"
  },
  {
    "id": "fish102",
    "path": "fish",
    "ring": 10,
    "name": "渔获·悟道谱",
    "icon": "🐳",
    "iconItem": "late_fish_01",
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "count": 75,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "bankCap",
      "amount": 5
    },
    "desc": "渔获线收集 75 件、渔获技能精通总级数达满分 100%（按动作次数涨） → 厨藏格数 +5"
  },
  {
    "id": "fish103",
    "path": "fish",
    "ring": 10,
    "name": "渔获·悟道典",
    "icon": "🐳",
    "iconItem": "gap_fish_107",
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "count": 75,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 2
    },
    "desc": "渔获线收集 75 件、渔获技能精通总级数达满分 100%（按动作次数涨） → 冷库格数 +2"
  },
  {
    "id": "fish104",
    "path": "fish",
    "ring": 10,
    "name": "渔获·悟道章",
    "icon": "🐳",
    "iconItem": "gap_fish_109",
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "count": 75,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "bankCap",
      "amount": 3
    },
    "desc": "渔获线收集 75 件、渔获技能精通总级数达满分 100%（按动作次数涨） → 厨藏格数 +3"
  },
  {
    "id": "fish105",
    "path": "fish",
    "ring": 10,
    "name": "渔获·悟道卷",
    "icon": "🐳",
    "iconItem": "late_fish_02",
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "count": 75,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "渔获线收集 75 件、渔获技能精通总级数达满分 100%（按动作次数涨） → 背包格数 +2"
  },
  {
    "id": "hunt11",
    "path": "hunt",
    "ring": 1,
    "name": "山猎·初识录",
    "icon": "🐇",
    "iconItem": "rabbitMeat",
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "count": 5,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "山猎线收集 5 件 → 背包格数 +1"
  },
  {
    "id": "hunt12",
    "path": "hunt",
    "ring": 1,
    "name": "山猎·初识谱",
    "icon": "🐇",
    "iconItem": "hunting_ext2_02",
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "count": 5,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "山猎线收集 5 件 → 背包格数 +1"
  },
  {
    "id": "hunt13",
    "path": "hunt",
    "ring": 1,
    "name": "山猎·初识典",
    "icon": "🐇",
    "iconItem": "hunting_ext_02",
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "count": 5,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "山猎线收集 5 件 → 背包格数 +1"
  },
  {
    "id": "hunt21",
    "path": "hunt",
    "ring": 2,
    "name": "山猎·渐熟录",
    "icon": "🦌",
    "iconItem": "hunting_ext2_04",
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "count": 12,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "山猎线收集 12 件 → 背包格数 +1"
  },
  {
    "id": "hunt22",
    "path": "hunt",
    "ring": 2,
    "name": "山猎·渐熟谱",
    "icon": "🦌",
    "iconItem": "hunting_ext_04",
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "count": 12,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "山猎线收集 12 件 → 背包格数 +1"
  },
  {
    "id": "hunt23",
    "path": "hunt",
    "ring": 2,
    "name": "山猎·渐熟典",
    "icon": "🦌",
    "iconItem": "hunting_ext_05",
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "count": 12,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "山猎线收集 12 件 → 背包格数 +1"
  },
  {
    "id": "hunt31",
    "path": "hunt",
    "ring": 3,
    "name": "山猎·通晓录",
    "icon": "🐗",
    "iconItem": "hunting_ext_08",
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "count": 24,
      "level": 0
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "山猎线收集 24 件 → 厨藏格数 +1"
  },
  {
    "id": "hunt32",
    "path": "hunt",
    "ring": 3,
    "name": "山猎·通晓谱",
    "icon": "🐗",
    "iconItem": "venison",
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "count": 24,
      "level": 0
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "山猎线收集 24 件 → 厨藏格数 +1"
  },
  {
    "id": "hunt33",
    "path": "hunt",
    "ring": 3,
    "name": "山猎·通晓典",
    "icon": "🐗",
    "iconItem": "hunting_ext2_09",
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "count": 24,
      "level": 0
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "山猎线收集 24 件 → 厨藏格数 +1"
  },
  {
    "id": "hunt41",
    "path": "hunt",
    "ring": 4,
    "name": "山猎·精研录",
    "icon": "🐻",
    "iconItem": "hunting_ext2_12",
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "count": 40,
      "level": 20
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "山猎线收集 40 件、山猎技能达 20 级 → 厨藏格数 +1"
  },
  {
    "id": "hunt42",
    "path": "hunt",
    "ring": 4,
    "name": "山猎·精研谱",
    "icon": "🐻",
    "iconItem": "hunting_ext_12",
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "count": 40,
      "level": 20
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "山猎线收集 40 件、山猎技能达 20 级 → 厨藏格数 +1"
  },
  {
    "id": "hunt43",
    "path": "hunt",
    "ring": 4,
    "name": "山猎·精研典",
    "icon": "🐻",
    "iconItem": "hunting_ext_13",
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "count": 40,
      "level": 20
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "山猎线收集 40 件、山猎技能达 20 级 → 厨藏格数 +1"
  },
  {
    "id": "hunt51",
    "path": "hunt",
    "ring": 5,
    "name": "山猎·大成录",
    "icon": "🦅",
    "iconItem": "hunting_ext_16",
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "count": 56,
      "level": 45
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "山猎线收集 56 件、山猎技能达 45 级 → 厨藏格数 +1"
  },
  {
    "id": "hunt52",
    "path": "hunt",
    "ring": 5,
    "name": "山猎·大成谱",
    "icon": "🦅",
    "iconItem": "crocodileMeat",
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "count": 56,
      "level": 45
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "山猎线收集 56 件、山猎技能达 45 级 → 厨藏格数 +1"
  },
  {
    "id": "hunt53",
    "path": "hunt",
    "ring": 5,
    "name": "山猎·大成典",
    "icon": "🦅",
    "iconItem": "hunting_ext2_17",
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "count": 56,
      "level": 45
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "山猎线收集 56 件、山猎技能达 45 级 → 厨藏格数 +1"
  },
  {
    "id": "hunt61",
    "path": "hunt",
    "ring": 6,
    "name": "山猎·化境录",
    "icon": "🐉",
    "iconItem": "bearMeat",
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "count": 72,
      "level": 75
    },
    "effect": {
      "field": "offlineH",
      "amount": 1
    },
    "desc": "山猎线收集 72 件、山猎技能达 75 级 → 离线收益时长上限 +1 小时"
  },
  {
    "id": "hunt62",
    "path": "hunt",
    "ring": 6,
    "name": "山猎·化境谱",
    "icon": "🐉",
    "iconItem": "hunting_ext2_20",
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "count": 72,
      "level": 75
    },
    "effect": {
      "field": "flatYield",
      "amount": 1
    },
    "desc": "山猎线收集 72 件、山猎技能达 75 级 → 山猎每次动作额外 +1 件"
  },
  {
    "id": "hunt63",
    "path": "hunt",
    "ring": 6,
    "name": "山猎·化境典",
    "icon": "🐉",
    "iconItem": "hunting_ext_20",
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "count": 72,
      "level": 75
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "山猎线收集 72 件、山猎技能达 75 级 → 冷库格数 +1"
  },
  {
    "id": "hunt64",
    "path": "hunt",
    "ring": 6,
    "name": "山猎·化境章",
    "icon": "🐉",
    "iconItem": "hunting_ext_21",
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "count": 72,
      "level": 75
    },
    "effect": {
      "field": "bankCap",
      "amount": 2
    },
    "desc": "山猎线收集 72 件、山猎技能达 75 级 → 厨藏格数 +2"
  },
  {
    "id": "hunt65",
    "path": "hunt",
    "ring": 6,
    "name": "山猎·化境卷",
    "icon": "🐉",
    "iconItem": "cougarMeat",
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "count": 72,
      "level": 75
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "山猎线收集 72 件、山猎技能达 75 级 → 背包格数 +1"
  },
  {
    "id": "hunt71",
    "path": "hunt",
    "ring": 7,
    "name": "山猎·圆满录",
    "icon": "🦊",
    "iconItem": "hunting_ext2_23",
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "count": 72,
      "level": 100
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "山猎线收集 72 件、山猎技能达 100 级 → 背包格数 +2"
  },
  {
    "id": "hunt72",
    "path": "hunt",
    "ring": 7,
    "name": "山猎·圆满谱",
    "icon": "🦊",
    "iconItem": "hunting_ext_23",
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "count": 72,
      "level": 100
    },
    "effect": {
      "field": "flatYield",
      "amount": 1
    },
    "desc": "山猎线收集 72 件、山猎技能达 100 级 → 山猎每次动作额外 +1 件"
  },
  {
    "id": "hunt73",
    "path": "hunt",
    "ring": 7,
    "name": "山猎·圆满典",
    "icon": "🦊",
    "iconItem": "hunting_ext2_24",
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "count": 72,
      "level": 100
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "山猎线收集 72 件、山猎技能达 100 级 → 冷库格数 +1"
  },
  {
    "id": "hunt74",
    "path": "hunt",
    "ring": 7,
    "name": "山猎·圆满章",
    "icon": "🦊",
    "iconItem": "hunting_ext_24",
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "count": 72,
      "level": 100
    },
    "effect": {
      "field": "bankCap",
      "amount": 2
    },
    "desc": "山猎线收集 72 件、山猎技能达 100 级 → 厨藏格数 +2"
  },
  {
    "id": "hunt75",
    "path": "hunt",
    "ring": 7,
    "name": "山猎·圆满卷",
    "icon": "🦊",
    "iconItem": "hunting_ext2_25",
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "count": 72,
      "level": 100
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "山猎线收集 72 件、山猎技能达 100 级 → 背包格数 +1"
  },
  {
    "id": "hunt81",
    "path": "hunt",
    "ring": 8,
    "name": "山猎·轮回录",
    "icon": "🐺",
    "iconItem": "rhinoMeat",
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "count": 72,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "山猎线收集 72 件、山猎技能精通总级数达满分 60%（按动作次数涨） → 背包格数 +2"
  },
  {
    "id": "hunt82",
    "path": "hunt",
    "ring": 8,
    "name": "山猎·轮回谱",
    "icon": "🐺",
    "iconItem": "hunting_ext2_26",
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "count": 72,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "bankCap",
      "amount": 3
    },
    "desc": "山猎线收集 72 件、山猎技能精通总级数达满分 60%（按动作次数涨） → 厨藏格数 +3"
  },
  {
    "id": "hunt83",
    "path": "hunt",
    "ring": 8,
    "name": "山猎·轮回典",
    "icon": "🐺",
    "iconItem": "hunting_ext_26",
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "count": 72,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "山猎线收集 72 件、山猎技能精通总级数达满分 60%（按动作次数涨） → 冷库格数 +1"
  },
  {
    "id": "hunt84",
    "path": "hunt",
    "ring": 8,
    "name": "山猎·轮回章",
    "icon": "🐺",
    "iconItem": "hunting_ext_27",
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "count": 72,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "bankCap",
      "amount": 2
    },
    "desc": "山猎线收集 72 件、山猎技能精通总级数达满分 60%（按动作次数涨） → 厨藏格数 +2"
  },
  {
    "id": "hunt85",
    "path": "hunt",
    "ring": 8,
    "name": "山猎·轮回卷",
    "icon": "🐺",
    "iconItem": "hunting_ext2_28",
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "count": 72,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "山猎线收集 72 件、山猎技能精通总级数达满分 60%（按动作次数涨） → 背包格数 +1"
  },
  {
    "id": "hunt91",
    "path": "hunt",
    "ring": 9,
    "name": "山猎·历劫录",
    "icon": "🦉",
    "iconItem": "dragonMeat",
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "count": 72,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 3
    },
    "desc": "山猎线收集 72 件、山猎技能精通总级数达满分 80%（按动作次数涨） → 背包格数 +3"
  },
  {
    "id": "hunt92",
    "path": "hunt",
    "ring": 9,
    "name": "山猎·历劫谱",
    "icon": "🦉",
    "iconItem": "hunting_ext2_29",
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "count": 72,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "bankCap",
      "amount": 4
    },
    "desc": "山猎线收集 72 件、山猎技能精通总级数达满分 80%（按动作次数涨） → 厨藏格数 +4"
  },
  {
    "id": "hunt93",
    "path": "hunt",
    "ring": 9,
    "name": "山猎·历劫典",
    "icon": "🦉",
    "iconItem": "yetiMeat",
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "count": 72,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "山猎线收集 72 件、山猎技能精通总级数达满分 80%（按动作次数涨） → 冷库格数 +1"
  },
  {
    "id": "hunt94",
    "path": "hunt",
    "ring": 9,
    "name": "山猎·历劫章",
    "icon": "🦉",
    "iconItem": "hunting_ext2_30",
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "count": 72,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "bankCap",
      "amount": 3
    },
    "desc": "山猎线收集 72 件、山猎技能精通总级数达满分 80%（按动作次数涨） → 厨藏格数 +3"
  },
  {
    "id": "hunt95",
    "path": "hunt",
    "ring": 9,
    "name": "山猎·历劫卷",
    "icon": "🦉",
    "iconItem": "hunting_ext_30",
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "count": 72,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "山猎线收集 72 件、山猎技能精通总级数达满分 80%（按动作次数涨） → 背包格数 +2"
  },
  {
    "id": "hunt101",
    "path": "hunt",
    "ring": 10,
    "name": "山猎·悟道录",
    "icon": "🦬",
    "iconItem": "late_hun_01",
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "count": 72,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 3
    },
    "desc": "山猎线收集 72 件、山猎技能精通总级数达满分 100%（按动作次数涨） → 背包格数 +3"
  },
  {
    "id": "hunt102",
    "path": "hunt",
    "ring": 10,
    "name": "山猎·悟道谱",
    "icon": "🦬",
    "iconItem": "gap_hun_107",
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "count": 72,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "bankCap",
      "amount": 5
    },
    "desc": "山猎线收集 72 件、山猎技能精通总级数达满分 100%（按动作次数涨） → 厨藏格数 +5"
  },
  {
    "id": "hunt103",
    "path": "hunt",
    "ring": 10,
    "name": "山猎·悟道典",
    "icon": "🦬",
    "iconItem": "gap_hun_109",
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "count": 72,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 2
    },
    "desc": "山猎线收集 72 件、山猎技能精通总级数达满分 100%（按动作次数涨） → 冷库格数 +2"
  },
  {
    "id": "hunt104",
    "path": "hunt",
    "ring": 10,
    "name": "山猎·悟道章",
    "icon": "🦬",
    "iconItem": "late_hun_02",
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "count": 72,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "bankCap",
      "amount": 3
    },
    "desc": "山猎线收集 72 件、山猎技能精通总级数达满分 100%（按动作次数涨） → 厨藏格数 +3"
  },
  {
    "id": "hunt105",
    "path": "hunt",
    "ring": 10,
    "name": "山猎·悟道卷",
    "icon": "🦬",
    "iconItem": "gap_hun_113",
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "count": 72,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "山猎线收集 72 件、山猎技能精通总级数达满分 100%（按动作次数涨） → 背包格数 +2"
  },
  {
    "id": "dig11",
    "path": "dig",
    "ring": 1,
    "name": "掘藏·初识录",
    "icon": "🪨",
    "iconItem": "excavation_ext_01",
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "count": 4,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "掘藏线收集 4 件 → 背包格数 +1"
  },
  {
    "id": "dig12",
    "path": "dig",
    "ring": 1,
    "name": "掘藏·初识谱",
    "icon": "🪨",
    "iconItem": "potato",
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "count": 4,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "掘藏线收集 4 件 → 背包格数 +1"
  },
  {
    "id": "dig13",
    "path": "dig",
    "ring": 1,
    "name": "掘藏·初识典",
    "icon": "🪨",
    "iconItem": "excavation_ext2_02",
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "count": 4,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "掘藏线收集 4 件 → 背包格数 +1"
  },
  {
    "id": "dig21",
    "path": "dig",
    "ring": 2,
    "name": "掘藏·渐熟录",
    "icon": "🔶",
    "iconItem": "excavation_ext2_03",
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "count": 9,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "掘藏线收集 9 件 → 背包格数 +1"
  },
  {
    "id": "dig22",
    "path": "dig",
    "ring": 2,
    "name": "掘藏·渐熟谱",
    "icon": "🔶",
    "iconItem": "excavation_ext_03",
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "count": 9,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "掘藏线收集 9 件 → 背包格数 +1"
  },
  {
    "id": "dig23",
    "path": "dig",
    "ring": 2,
    "name": "掘藏·渐熟典",
    "icon": "🔶",
    "iconItem": "excavation_ext2_04",
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "count": 9,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "掘藏线收集 9 件 → 背包格数 +1"
  },
  {
    "id": "dig31",
    "path": "dig",
    "ring": 3,
    "name": "掘藏·通晓录",
    "icon": "💎",
    "iconItem": "excavation_ext_06",
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "count": 18,
      "level": 0
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "掘藏线收集 18 件 → 厨藏格数 +1"
  },
  {
    "id": "dig32",
    "path": "dig",
    "ring": 3,
    "name": "掘藏·通晓谱",
    "icon": "💎",
    "iconItem": "onion",
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "count": 18,
      "level": 0
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "掘藏线收集 18 件 → 厨藏格数 +1"
  },
  {
    "id": "dig33",
    "path": "dig",
    "ring": 3,
    "name": "掘藏·通晓典",
    "icon": "💎",
    "iconItem": "excavation_ext2_07",
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "count": 18,
      "level": 0
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "掘藏线收集 18 件 → 厨藏格数 +1"
  },
  {
    "id": "dig41",
    "path": "dig",
    "ring": 4,
    "name": "掘藏·精研录",
    "icon": "🪙",
    "iconItem": "excavation_ext_09",
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "count": 29,
      "level": 20
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "掘藏线收集 29 件、掘藏技能达 20 级 → 厨藏格数 +1"
  },
  {
    "id": "dig42",
    "path": "dig",
    "ring": 4,
    "name": "掘藏·精研谱",
    "icon": "🪙",
    "iconItem": "garlic",
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "count": 29,
      "level": 20
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "掘藏线收集 29 件、掘藏技能达 20 级 → 厨藏格数 +1"
  },
  {
    "id": "dig43",
    "path": "dig",
    "ring": 4,
    "name": "掘藏·精研典",
    "icon": "🪙",
    "iconItem": "garlic",
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "count": 29,
      "level": 20
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "掘藏线收集 29 件、掘藏技能达 20 级 → 厨藏格数 +1"
  },
  {
    "id": "dig51",
    "path": "dig",
    "ring": 5,
    "name": "掘藏·大成录",
    "icon": "🔷",
    "iconItem": "excavation_ext_12",
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "count": 41,
      "level": 45
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "掘藏线收集 41 件、掘藏技能达 45 级 → 厨藏格数 +1"
  },
  {
    "id": "dig52",
    "path": "dig",
    "ring": 5,
    "name": "掘藏·大成谱",
    "icon": "🔷",
    "iconItem": "excavation_ext_12",
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "count": 41,
      "level": 45
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "掘藏线收集 41 件、掘藏技能达 45 级 → 厨藏格数 +1"
  },
  {
    "id": "dig53",
    "path": "dig",
    "ring": 5,
    "name": "掘藏·大成典",
    "icon": "🔷",
    "iconItem": "ginger",
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "count": 41,
      "level": 45
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "掘藏线收集 41 件、掘藏技能达 45 级 → 厨藏格数 +1"
  },
  {
    "id": "dig61",
    "path": "dig",
    "ring": 6,
    "name": "掘藏·化境录",
    "icon": "🏆",
    "iconItem": "yam",
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "count": 53,
      "level": 75
    },
    "effect": {
      "field": "offlineH",
      "amount": 1
    },
    "desc": "掘藏线收集 53 件、掘藏技能达 75 级 → 离线收益时长上限 +1 小时"
  },
  {
    "id": "dig62",
    "path": "dig",
    "ring": 6,
    "name": "掘藏·化境谱",
    "icon": "🏆",
    "iconItem": "excavation_ext_16",
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "count": 53,
      "level": 75
    },
    "effect": {
      "field": "flatYield",
      "amount": 1
    },
    "desc": "掘藏线收集 53 件、掘藏技能达 75 级 → 掘藏每次动作额外 +1 件"
  },
  {
    "id": "dig63",
    "path": "dig",
    "ring": 6,
    "name": "掘藏·化境典",
    "icon": "🏆",
    "iconItem": "excavation_ext_17",
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "count": 53,
      "level": 75
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "掘藏线收集 53 件、掘藏技能达 75 级 → 冷库格数 +1"
  },
  {
    "id": "dig64",
    "path": "dig",
    "ring": 6,
    "name": "掘藏·化境章",
    "icon": "🏆",
    "iconItem": "excavation_ext_18",
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "count": 53,
      "level": 75
    },
    "effect": {
      "field": "bankCap",
      "amount": 2
    },
    "desc": "掘藏线收集 53 件、掘藏技能达 75 级 → 厨藏格数 +2"
  },
  {
    "id": "dig65",
    "path": "dig",
    "ring": 6,
    "name": "掘藏·化境卷",
    "icon": "🏆",
    "iconItem": "lingzhi",
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "count": 53,
      "level": 75
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "掘藏线收集 53 件、掘藏技能达 75 级 → 背包格数 +1"
  },
  {
    "id": "dig71",
    "path": "dig",
    "ring": 7,
    "name": "掘藏·圆满录",
    "icon": "🧱",
    "iconItem": "excavation_ext_20",
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "count": 53,
      "level": 100
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "掘藏线收集 53 件、掘藏技能达 100 级 → 背包格数 +2"
  },
  {
    "id": "dig72",
    "path": "dig",
    "ring": 7,
    "name": "掘藏·圆满谱",
    "icon": "🧱",
    "iconItem": "excavation_ext_21",
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "count": 53,
      "level": 100
    },
    "effect": {
      "field": "flatYield",
      "amount": 1
    },
    "desc": "掘藏线收集 53 件、掘藏技能达 100 级 → 掘藏每次动作额外 +1 件"
  },
  {
    "id": "dig73",
    "path": "dig",
    "ring": 7,
    "name": "掘藏·圆满典",
    "icon": "🧱",
    "iconItem": "ginseng",
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "count": 53,
      "level": 100
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "掘藏线收集 53 件、掘藏技能达 100 级 → 冷库格数 +1"
  },
  {
    "id": "dig74",
    "path": "dig",
    "ring": 7,
    "name": "掘藏·圆满章",
    "icon": "🧱",
    "iconItem": "rockCoreRoot",
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "count": 53,
      "level": 100
    },
    "effect": {
      "field": "bankCap",
      "amount": 2
    },
    "desc": "掘藏线收集 53 件、掘藏技能达 100 级 → 厨藏格数 +2"
  },
  {
    "id": "dig75",
    "path": "dig",
    "ring": 7,
    "name": "掘藏·圆满卷",
    "icon": "🧱",
    "iconItem": "jadePithRoot",
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "count": 53,
      "level": 100
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "掘藏线收集 53 件、掘藏技能达 100 级 → 背包格数 +1"
  },
  {
    "id": "dig81",
    "path": "dig",
    "ring": 8,
    "name": "掘藏·轮回录",
    "icon": "⛰️",
    "iconItem": "cloudFungus",
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "count": 53,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "掘藏线收集 53 件、掘藏技能精通总级数达满分 60%（按动作次数涨） → 背包格数 +2"
  },
  {
    "id": "dig82",
    "path": "dig",
    "ring": 8,
    "name": "掘藏·轮回谱",
    "icon": "⛰️",
    "iconItem": "bloodFungus",
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "count": 53,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "bankCap",
      "amount": 3
    },
    "desc": "掘藏线收集 53 件、掘藏技能精通总级数达满分 60%（按动作次数涨） → 厨藏格数 +3"
  },
  {
    "id": "dig83",
    "path": "dig",
    "ring": 8,
    "name": "掘藏·轮回典",
    "icon": "⛰️",
    "iconItem": "dragonRoot",
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "count": 53,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "掘藏线收集 53 件、掘藏技能精通总级数达满分 60%（按动作次数涨） → 冷库格数 +1"
  },
  {
    "id": "dig84",
    "path": "dig",
    "ring": 8,
    "name": "掘藏·轮回章",
    "icon": "⛰️",
    "iconItem": "taiSui",
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "count": 53,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "bankCap",
      "amount": 2
    },
    "desc": "掘藏线收集 53 件、掘藏技能精通总级数达满分 60%（按动作次数涨） → 厨藏格数 +2"
  },
  {
    "id": "dig85",
    "path": "dig",
    "ring": 8,
    "name": "掘藏·轮回卷",
    "icon": "⛰️",
    "iconItem": "vermilionGrass",
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "count": 53,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "掘藏线收集 53 件、掘藏技能精通总级数达满分 60%（按动作次数涨） → 背包格数 +1"
  },
  {
    "id": "dig91",
    "path": "dig",
    "ring": 9,
    "name": "掘藏·历劫录",
    "icon": "🗿",
    "iconItem": "mysticRoot",
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "count": 53,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 3
    },
    "desc": "掘藏线收集 53 件、掘藏技能精通总级数达满分 80%（按动作次数涨） → 背包格数 +3"
  },
  {
    "id": "dig92",
    "path": "dig",
    "ring": 9,
    "name": "掘藏·历劫谱",
    "icon": "🗿",
    "iconItem": "gap_exc_101",
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "count": 53,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "bankCap",
      "amount": 4
    },
    "desc": "掘藏线收集 53 件、掘藏技能精通总级数达满分 80%（按动作次数涨） → 厨藏格数 +4"
  },
  {
    "id": "dig93",
    "path": "dig",
    "ring": 9,
    "name": "掘藏·历劫典",
    "icon": "🗿",
    "iconItem": "late_exc_01",
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "count": 53,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "掘藏线收集 53 件、掘藏技能精通总级数达满分 80%（按动作次数涨） → 冷库格数 +1"
  },
  {
    "id": "dig94",
    "path": "dig",
    "ring": 9,
    "name": "掘藏·历劫章",
    "icon": "🗿",
    "iconItem": "gap_exc_103",
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "count": 53,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "bankCap",
      "amount": 3
    },
    "desc": "掘藏线收集 53 件、掘藏技能精通总级数达满分 80%（按动作次数涨） → 厨藏格数 +3"
  },
  {
    "id": "dig95",
    "path": "dig",
    "ring": 9,
    "name": "掘藏·历劫卷",
    "icon": "🗿",
    "iconItem": "gap_exc_107",
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "count": 53,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "掘藏线收集 53 件、掘藏技能精通总级数达满分 80%（按动作次数涨） → 背包格数 +2"
  },
  {
    "id": "dig101",
    "path": "dig",
    "ring": 10,
    "name": "掘藏·悟道录",
    "icon": "👑",
    "iconItem": "gap_exc_109",
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "count": 53,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 3
    },
    "desc": "掘藏线收集 53 件、掘藏技能精通总级数达满分 100%（按动作次数涨） → 背包格数 +3"
  },
  {
    "id": "dig102",
    "path": "dig",
    "ring": 10,
    "name": "掘藏·悟道谱",
    "icon": "👑",
    "iconItem": "late_exc_02",
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "count": 53,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "bankCap",
      "amount": 5
    },
    "desc": "掘藏线收集 53 件、掘藏技能精通总级数达满分 100%（按动作次数涨） → 厨藏格数 +5"
  },
  {
    "id": "dig103",
    "path": "dig",
    "ring": 10,
    "name": "掘藏·悟道典",
    "icon": "👑",
    "iconItem": "gap_exc_113",
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "count": 53,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 2
    },
    "desc": "掘藏线收集 53 件、掘藏技能精通总级数达满分 100%（按动作次数涨） → 冷库格数 +2"
  },
  {
    "id": "dig104",
    "path": "dig",
    "ring": 10,
    "name": "掘藏·悟道章",
    "icon": "👑",
    "iconItem": "gap_exc_115",
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "count": 53,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "bankCap",
      "amount": 3
    },
    "desc": "掘藏线收集 53 件、掘藏技能精通总级数达满分 100%（按动作次数涨） → 厨藏格数 +3"
  },
  {
    "id": "dig105",
    "path": "dig",
    "ring": 10,
    "name": "掘藏·悟道卷",
    "icon": "👑",
    "iconItem": "gap_exc_115",
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "count": 53,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "掘藏线收集 53 件、掘藏技能精通总级数达满分 100%（按动作次数涨） → 背包格数 +2"
  },
  {
    "id": "farm11",
    "path": "farm",
    "ring": 1,
    "name": "稼穑·初识录",
    "icon": "🌰",
    "iconItem": "excavation_ext_01",
    "req": {
      "kind": "codex",
      "skill": "farming",
      "count": 13,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "稼穑线收集 13 件 → 背包格数 +1"
  },
  {
    "id": "farm12",
    "path": "farm",
    "ring": 1,
    "name": "稼穑·初识谱",
    "icon": "🌰",
    "iconItem": "garlic_young",
    "req": {
      "kind": "codex",
      "skill": "farming",
      "count": 13,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "稼穑线收集 13 件 → 背包格数 +1"
  },
  {
    "id": "farm13",
    "path": "farm",
    "ring": 1,
    "name": "稼穑·初识典",
    "icon": "🌰",
    "iconItem": "peppercorn_young",
    "req": {
      "kind": "codex",
      "skill": "farming",
      "count": 13,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "稼穑线收集 13 件 → 背包格数 +1"
  },
  {
    "id": "farm21",
    "path": "farm",
    "ring": 2,
    "name": "稼穑·渐熟录",
    "icon": "🥬",
    "iconItem": "excavation_ext2_02",
    "req": {
      "kind": "codex",
      "skill": "farming",
      "count": 31,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "稼穑线收集 31 件 → 背包格数 +1"
  },
  {
    "id": "farm22",
    "path": "farm",
    "ring": 2,
    "name": "稼穑·渐熟谱",
    "icon": "🥬",
    "iconItem": "foraging_ext_02",
    "req": {
      "kind": "codex",
      "skill": "farming",
      "count": 31,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "稼穑线收集 31 件 → 背包格数 +1"
  },
  {
    "id": "farm23",
    "path": "farm",
    "ring": 2,
    "name": "稼穑·渐熟典",
    "icon": "🥬",
    "iconItem": "rice",
    "req": {
      "kind": "codex",
      "skill": "farming",
      "count": 31,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "稼穑线收集 31 件 → 背包格数 +1"
  },
  {
    "id": "farm31",
    "path": "farm",
    "ring": 3,
    "name": "稼穑·通晓录",
    "icon": "🎃",
    "iconItem": "chrysanthemum",
    "req": {
      "kind": "codex",
      "skill": "farming",
      "count": 62,
      "level": 0
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "稼穑线收集 62 件 → 厨藏格数 +1"
  },
  {
    "id": "farm32",
    "path": "farm",
    "ring": 3,
    "name": "稼穑·通晓谱",
    "icon": "🎃",
    "iconItem": "jasmine_young",
    "req": {
      "kind": "codex",
      "skill": "farming",
      "count": 62,
      "level": 0
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "稼穑线收集 62 件 → 厨藏格数 +1"
  },
  {
    "id": "farm33",
    "path": "farm",
    "ring": 3,
    "name": "稼穑·通晓典",
    "icon": "🎃",
    "iconItem": "foraging_ext2_05",
    "req": {
      "kind": "codex",
      "skill": "farming",
      "count": 62,
      "level": 0
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "稼穑线收集 62 件 → 厨藏格数 +1"
  },
  {
    "id": "farm41",
    "path": "farm",
    "ring": 4,
    "name": "稼穑·精研录",
    "icon": "🍉",
    "iconItem": "mushroom",
    "req": {
      "kind": "codex",
      "skill": "farming",
      "count": 103,
      "level": 20
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "稼穑线收集 103 件、稼穑技能达 20 级 → 厨藏格数 +1"
  },
  {
    "id": "farm42",
    "path": "farm",
    "ring": 4,
    "name": "稼穑·精研谱",
    "icon": "🍉",
    "iconItem": "rosemary_young",
    "req": {
      "kind": "codex",
      "skill": "farming",
      "count": 103,
      "level": 20
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "稼穑线收集 103 件、稼穑技能达 20 级 → 厨藏格数 +1"
  },
  {
    "id": "farm43",
    "path": "farm",
    "ring": 4,
    "name": "稼穑·精研典",
    "icon": "🍉",
    "iconItem": "foraging_ext2_07",
    "req": {
      "kind": "codex",
      "skill": "farming",
      "count": 103,
      "level": 20
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "稼穑线收集 103 件、稼穑技能达 20 级 → 厨藏格数 +1"
  },
  {
    "id": "farm51",
    "path": "farm",
    "ring": 5,
    "name": "稼穑·大成录",
    "icon": "🌻",
    "iconItem": "eggplant",
    "req": {
      "kind": "codex",
      "skill": "farming",
      "count": 144,
      "level": 45
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "稼穑线收集 144 件、稼穑技能达 45 级 → 厨藏格数 +1"
  },
  {
    "id": "farm52",
    "path": "farm",
    "ring": 5,
    "name": "稼穑·大成谱",
    "icon": "🌻",
    "iconItem": "grape",
    "req": {
      "kind": "codex",
      "skill": "farming",
      "count": 144,
      "level": 45
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "稼穑线收集 144 件、稼穑技能达 45 级 → 厨藏格数 +1"
  },
  {
    "id": "farm53",
    "path": "farm",
    "ring": 5,
    "name": "稼穑·大成典",
    "icon": "🌻",
    "iconItem": "sodaWater",
    "req": {
      "kind": "codex",
      "skill": "farming",
      "count": 144,
      "level": 45
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "稼穑线收集 144 件、稼穑技能达 45 级 → 厨藏格数 +1"
  },
  {
    "id": "farm61",
    "path": "farm",
    "ring": 6,
    "name": "稼穑·化境录",
    "icon": "🍇",
    "iconItem": "clove",
    "req": {
      "kind": "codex",
      "skill": "farming",
      "count": 185,
      "level": 75
    },
    "effect": {
      "field": "offlineH",
      "amount": 1
    },
    "desc": "稼穑线收集 185 件、稼穑技能达 75 级 → 离线收益时长上限 +1 小时"
  },
  {
    "id": "farm62",
    "path": "farm",
    "ring": 6,
    "name": "稼穑·化境谱",
    "icon": "🍇",
    "iconItem": "excavation_ext2_12",
    "req": {
      "kind": "codex",
      "skill": "farming",
      "count": 185,
      "level": 75
    },
    "effect": {
      "field": "flatYield",
      "amount": 1
    },
    "desc": "稼穑线收集 185 件、稼穑技能达 75 级 → 稼穑每次动作额外 +1 件"
  },
  {
    "id": "farm63",
    "path": "farm",
    "ring": 6,
    "name": "稼穑·化境典",
    "icon": "🍇",
    "iconItem": "foraging_ext_12",
    "req": {
      "kind": "codex",
      "skill": "farming",
      "count": 185,
      "level": 75
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "稼穑线收集 185 件、稼穑技能达 75 级 → 冷库格数 +1"
  },
  {
    "id": "farm64",
    "path": "farm",
    "ring": 6,
    "name": "稼穑·化境章",
    "icon": "🍇",
    "iconItem": "pumpkin",
    "req": {
      "kind": "codex",
      "skill": "farming",
      "count": 185,
      "level": 75
    },
    "effect": {
      "field": "bankCap",
      "amount": 2
    },
    "desc": "稼穑线收集 185 件、稼穑技能达 75 级 → 厨藏格数 +2"
  },
  {
    "id": "farm65",
    "path": "farm",
    "ring": 6,
    "name": "稼穑·化境卷",
    "icon": "🍇",
    "iconItem": "foraging_ext_13",
    "req": {
      "kind": "codex",
      "skill": "farming",
      "count": 185,
      "level": 75
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "稼穑线收集 185 件、稼穑技能达 75 级 → 背包格数 +1"
  },
  {
    "id": "farm71",
    "path": "farm",
    "ring": 7,
    "name": "稼穑·圆满录",
    "icon": "🍅",
    "iconItem": "excavation_ext_15",
    "req": {
      "kind": "codex",
      "skill": "farming",
      "count": 185,
      "level": 100
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "稼穑线收集 185 件、稼穑技能达 100 级 → 背包格数 +2"
  },
  {
    "id": "farm72",
    "path": "farm",
    "ring": 7,
    "name": "稼穑·圆满谱",
    "icon": "🍅",
    "iconItem": "turmeric",
    "req": {
      "kind": "codex",
      "skill": "farming",
      "count": 185,
      "level": 100
    },
    "effect": {
      "field": "flatYield",
      "amount": 1
    },
    "desc": "稼穑线收集 185 件、稼穑技能达 100 级 → 稼穑每次动作额外 +1 件"
  },
  {
    "id": "farm73",
    "path": "farm",
    "ring": 7,
    "name": "稼穑·圆满典",
    "icon": "🍅",
    "iconItem": "vanilla",
    "req": {
      "kind": "codex",
      "skill": "farming",
      "count": 185,
      "level": 100
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "稼穑线收集 185 件、稼穑技能达 100 级 → 冷库格数 +1"
  },
  {
    "id": "farm74",
    "path": "farm",
    "ring": 7,
    "name": "稼穑·圆满章",
    "icon": "🍅",
    "iconItem": "foraging_ext2_16",
    "req": {
      "kind": "codex",
      "skill": "farming",
      "count": 185,
      "level": 100
    },
    "effect": {
      "field": "bankCap",
      "amount": 2
    },
    "desc": "稼穑线收集 185 件、稼穑技能达 100 级 → 厨藏格数 +2"
  },
  {
    "id": "farm75",
    "path": "farm",
    "ring": 7,
    "name": "稼穑·圆满卷",
    "icon": "🍅",
    "iconItem": "seaweed",
    "req": {
      "kind": "codex",
      "skill": "farming",
      "count": 185,
      "level": 100
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "稼穑线收集 185 件、稼穑技能达 100 级 → 背包格数 +1"
  },
  {
    "id": "farm81",
    "path": "farm",
    "ring": 8,
    "name": "稼穑·轮回录",
    "icon": "🥕",
    "iconItem": "excavation_ext_18",
    "req": {
      "kind": "codex",
      "skill": "farming",
      "count": 185,
      "level": 0,
      "masteryPct": 0.3
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "稼穑线收集 185 件、稼穑技能精通总级数达满分 30%（按动作次数涨） → 背包格数 +2"
  },
  {
    "id": "farm82",
    "path": "farm",
    "ring": 8,
    "name": "稼穑·轮回谱",
    "icon": "🥕",
    "iconItem": "oregano",
    "req": {
      "kind": "codex",
      "skill": "farming",
      "count": 185,
      "level": 0,
      "masteryPct": 0.3
    },
    "effect": {
      "field": "bankCap",
      "amount": 3
    },
    "desc": "稼穑线收集 185 件、稼穑技能精通总级数达满分 30%（按动作次数涨） → 厨藏格数 +3"
  },
  {
    "id": "farm83",
    "path": "farm",
    "ring": 8,
    "name": "稼穑·轮回典",
    "icon": "🥕",
    "iconItem": "sage",
    "req": {
      "kind": "codex",
      "skill": "farming",
      "count": 185,
      "level": 0,
      "masteryPct": 0.3
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "稼穑线收集 185 件、稼穑技能精通总级数达满分 30%（按动作次数涨） → 冷库格数 +1"
  },
  {
    "id": "farm84",
    "path": "farm",
    "ring": 8,
    "name": "稼穑·轮回章",
    "icon": "🥕",
    "iconItem": "foraging_ext_19",
    "req": {
      "kind": "codex",
      "skill": "farming",
      "count": 185,
      "level": 0,
      "masteryPct": 0.3
    },
    "effect": {
      "field": "bankCap",
      "amount": 2
    },
    "desc": "稼穑线收集 185 件、稼穑技能精通总级数达满分 30%（按动作次数涨） → 厨藏格数 +2"
  },
  {
    "id": "farm85",
    "path": "farm",
    "ring": 8,
    "name": "稼穑·轮回卷",
    "icon": "🥕",
    "iconItem": "excavation_ext_20",
    "req": {
      "kind": "codex",
      "skill": "farming",
      "count": 185,
      "level": 0,
      "masteryPct": 0.3
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "稼穑线收集 185 件、稼穑技能精通总级数达满分 30%（按动作次数涨） → 背包格数 +1"
  },
  {
    "id": "farm91",
    "path": "farm",
    "ring": 9,
    "name": "稼穑·历劫录",
    "icon": "🌽",
    "iconItem": "foraging_ext_21",
    "req": {
      "kind": "codex",
      "skill": "farming",
      "count": 185,
      "level": 0,
      "masteryPct": 0.4
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 3
    },
    "desc": "稼穑线收集 185 件、稼穑技能精通总级数达满分 40%（按动作次数涨） → 背包格数 +3"
  },
  {
    "id": "farm92",
    "path": "farm",
    "ring": 9,
    "name": "稼穑·历劫谱",
    "icon": "🌽",
    "iconItem": "foraging_ext_22",
    "req": {
      "kind": "codex",
      "skill": "farming",
      "count": 185,
      "level": 0,
      "masteryPct": 0.4
    },
    "effect": {
      "field": "bankCap",
      "amount": 4
    },
    "desc": "稼穑线收集 185 件、稼穑技能精通总级数达满分 40%（按动作次数涨） → 厨藏格数 +4"
  },
  {
    "id": "farm93",
    "path": "farm",
    "ring": 9,
    "name": "稼穑·历劫典",
    "icon": "🌽",
    "iconItem": "saffron",
    "req": {
      "kind": "codex",
      "skill": "farming",
      "count": 185,
      "level": 0,
      "masteryPct": 0.4
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "稼穑线收集 185 件、稼穑技能精通总级数达满分 40%（按动作次数涨） → 冷库格数 +1"
  },
  {
    "id": "farm94",
    "path": "farm",
    "ring": 9,
    "name": "稼穑·历劫章",
    "icon": "🌽",
    "iconItem": "truffle",
    "req": {
      "kind": "codex",
      "skill": "farming",
      "count": 185,
      "level": 0,
      "masteryPct": 0.4
    },
    "effect": {
      "field": "bankCap",
      "amount": 3
    },
    "desc": "稼穑线收集 185 件、稼穑技能精通总级数达满分 40%（按动作次数涨） → 厨藏格数 +3"
  },
  {
    "id": "farm95",
    "path": "farm",
    "ring": 9,
    "name": "稼穑·历劫卷",
    "icon": "🌽",
    "iconItem": "dragonPepper",
    "req": {
      "kind": "codex",
      "skill": "farming",
      "count": 185,
      "level": 0,
      "masteryPct": 0.4
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "稼穑线收集 185 件、稼穑技能精通总级数达满分 40%（按动作次数涨） → 背包格数 +2"
  },
  {
    "id": "farm101",
    "path": "farm",
    "ring": 10,
    "name": "稼穑·悟道录",
    "icon": "🍒",
    "iconItem": "foraging_ext_27",
    "req": {
      "kind": "codex",
      "skill": "farming",
      "count": 185,
      "level": 0,
      "masteryPct": 0.5
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 3
    },
    "desc": "稼穑线收集 185 件、稼穑技能精通总级数达满分 50%（按动作次数涨） → 背包格数 +3"
  },
  {
    "id": "farm102",
    "path": "farm",
    "ring": 10,
    "name": "稼穑·悟道谱",
    "icon": "🍒",
    "iconItem": "foraging_ext2_28",
    "req": {
      "kind": "codex",
      "skill": "farming",
      "count": 185,
      "level": 0,
      "masteryPct": 0.5
    },
    "effect": {
      "field": "bankCap",
      "amount": 5
    },
    "desc": "稼穑线收集 185 件、稼穑技能精通总级数达满分 50%（按动作次数涨） → 厨藏格数 +5"
  },
  {
    "id": "farm103",
    "path": "farm",
    "ring": 10,
    "name": "稼穑·悟道典",
    "icon": "🍒",
    "iconItem": "foraging_ext_29",
    "req": {
      "kind": "codex",
      "skill": "farming",
      "count": 185,
      "level": 0,
      "masteryPct": 0.5
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 2
    },
    "desc": "稼穑线收集 185 件、稼穑技能精通总级数达满分 50%（按动作次数涨） → 冷库格数 +2"
  },
  {
    "id": "farm104",
    "path": "farm",
    "ring": 10,
    "name": "稼穑·悟道章",
    "icon": "🍒",
    "iconItem": "gap_far_101",
    "req": {
      "kind": "codex",
      "skill": "farming",
      "count": 185,
      "level": 0,
      "masteryPct": 0.5
    },
    "effect": {
      "field": "bankCap",
      "amount": 3
    },
    "desc": "稼穑线收集 185 件、稼穑技能精通总级数达满分 50%（按动作次数涨） → 厨藏格数 +3"
  },
  {
    "id": "farm105",
    "path": "farm",
    "ring": 10,
    "name": "稼穑·悟道卷",
    "icon": "🍒",
    "iconItem": "gap_far_113",
    "req": {
      "kind": "codex",
      "skill": "farming",
      "count": 185,
      "level": 0,
      "masteryPct": 0.5
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "稼穑线收集 185 件、稼穑技能精通总级数达满分 50%（按动作次数涨） → 背包格数 +2"
  },
  {
    "id": "cook11",
    "path": "cook",
    "ring": 1,
    "name": "烹煮·初识录",
    "icon": "🍚",
    "iconItem": "wildDish_554",
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "count": 19,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "烹煮线收集 19 件 → 背包格数 +1"
  },
  {
    "id": "cook12",
    "path": "cook",
    "ring": 1,
    "name": "烹煮·初识谱",
    "icon": "🍚",
    "iconItem": "greenRadishSalad",
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "count": 19,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "烹煮线收集 19 件 → 背包格数 +1"
  },
  {
    "id": "cook13",
    "path": "cook",
    "ring": 1,
    "name": "烹煮·初识典",
    "icon": "🍚",
    "iconItem": "wildDish_3",
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "count": 19,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "烹煮线收集 19 件 → 背包格数 +1"
  },
  {
    "id": "cook21",
    "path": "cook",
    "ring": 2,
    "name": "烹煮·渐熟录",
    "icon": "🍜",
    "iconItem": "beetSalad",
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "count": 46,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "烹煮线收集 46 件 → 背包格数 +1"
  },
  {
    "id": "cook22",
    "path": "cook",
    "ring": 2,
    "name": "烹煮·渐熟谱",
    "icon": "🍜",
    "iconItem": "wildDish_32",
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "count": 46,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "烹煮线收集 46 件 → 背包格数 +1"
  },
  {
    "id": "cook23",
    "path": "cook",
    "ring": 2,
    "name": "烹煮·渐熟典",
    "icon": "🍜",
    "iconItem": "cooking_ext2_06",
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "count": 46,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "烹煮线收集 46 件 → 背包格数 +1"
  },
  {
    "id": "cook31",
    "path": "cook",
    "ring": 3,
    "name": "烹煮·通晓录",
    "icon": "🍲",
    "iconItem": "swordfishSteak",
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "count": 92,
      "level": 0
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "烹煮线收集 92 件 → 厨藏格数 +1"
  },
  {
    "id": "cook32",
    "path": "cook",
    "ring": 3,
    "name": "烹煮·通晓谱",
    "icon": "🍲",
    "iconItem": "wildDish_8",
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "count": 92,
      "level": 0
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "烹煮线收集 92 件 → 厨藏格数 +1"
  },
  {
    "id": "cook33",
    "path": "cook",
    "ring": 3,
    "name": "烹煮·通晓典",
    "icon": "🍲",
    "iconItem": "yuxiangPork",
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "count": 92,
      "level": 0
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "烹煮线收集 92 件 → 厨藏格数 +1"
  },
  {
    "id": "cook41",
    "path": "cook",
    "ring": 4,
    "name": "烹煮·精研录",
    "icon": "🥘",
    "iconItem": "cookDown_20",
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "count": 153,
      "level": 20
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "烹煮线收集 153 件、烹煮技能达 20 级 → 厨藏格数 +1"
  },
  {
    "id": "cook42",
    "path": "cook",
    "ring": 4,
    "name": "烹煮·精研谱",
    "icon": "🥘",
    "iconItem": "hairtailFry",
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "count": 153,
      "level": 20
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "烹煮线收集 153 件、烹煮技能达 20 级 → 厨藏格数 +1"
  },
  {
    "id": "cook43",
    "path": "cook",
    "ring": 4,
    "name": "烹煮·精研典",
    "icon": "🥘",
    "iconItem": "wildDish_11",
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "count": 153,
      "level": 20
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "烹煮线收集 153 件、烹煮技能达 20 级 → 厨藏格数 +1"
  },
  {
    "id": "cook51",
    "path": "cook",
    "ring": 5,
    "name": "烹煮·大成录",
    "icon": "🍱",
    "iconItem": "wildDish_42",
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "count": 214,
      "level": 45
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "烹煮线收集 214 件、烹煮技能达 45 级 → 厨藏格数 +1"
  },
  {
    "id": "cook52",
    "path": "cook",
    "ring": 5,
    "name": "烹煮·大成谱",
    "icon": "🍱",
    "iconItem": "lobsterCongee",
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "count": 214,
      "level": 45
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "烹煮线收集 214 件、烹煮技能达 45 级 → 厨藏格数 +1"
  },
  {
    "id": "cook53",
    "path": "cook",
    "ring": 5,
    "name": "烹煮·大成典",
    "icon": "🍱",
    "iconItem": "wildDish_43",
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "count": 214,
      "level": 45
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "烹煮线收集 214 件、烹煮技能达 45 级 → 厨藏格数 +1"
  },
  {
    "id": "cook61",
    "path": "cook",
    "ring": 6,
    "name": "烹煮·化境录",
    "icon": "🍽️",
    "iconItem": "kelpSoup",
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "count": 275,
      "level": 75
    },
    "effect": {
      "field": "bankCap",
      "amount": 4
    },
    "desc": "烹煮线收集 275 件、烹煮技能达 75 级 → 厨藏格数 +4"
  },
  {
    "id": "cook62",
    "path": "cook",
    "ring": 6,
    "name": "烹煮·化境谱",
    "icon": "🍽️",
    "iconItem": "cookDown_26",
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "count": 275,
      "level": 75
    },
    "effect": {
      "field": "bankCap",
      "amount": 4
    },
    "desc": "烹煮线收集 275 件、烹煮技能达 75 级 → 厨藏格数 +4"
  },
  {
    "id": "cook63",
    "path": "cook",
    "ring": 6,
    "name": "烹煮·化境典",
    "icon": "🍽️",
    "iconItem": "cooking_ext2_20",
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "count": 275,
      "level": 75
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "烹煮线收集 275 件、烹煮技能达 75 级 → 冷库格数 +1"
  },
  {
    "id": "cook64",
    "path": "cook",
    "ring": 6,
    "name": "烹煮·化境章",
    "icon": "🍽️",
    "iconItem": "cookDown_27",
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "count": 275,
      "level": 75
    },
    "effect": {
      "field": "bankCap",
      "amount": 2
    },
    "desc": "烹煮线收集 275 件、烹煮技能达 75 级 → 厨藏格数 +2"
  },
  {
    "id": "cook65",
    "path": "cook",
    "ring": 6,
    "name": "烹煮·化境卷",
    "icon": "🍽️",
    "iconItem": "wildDish_20",
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "count": 275,
      "level": 75
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "烹煮线收集 275 件、烹煮技能达 75 级 → 背包格数 +1"
  },
  {
    "id": "cook71",
    "path": "cook",
    "ring": 7,
    "name": "烹煮·圆满录",
    "icon": "🍛",
    "iconItem": "manhanSingle",
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "count": 275,
      "level": 100
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "烹煮线收集 275 件、烹煮技能达 100 级 → 背包格数 +2"
  },
  {
    "id": "cook72",
    "path": "cook",
    "ring": 7,
    "name": "烹煮·圆满谱",
    "icon": "🍛",
    "iconItem": "wildDish_21",
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "count": 275,
      "level": 100
    },
    "effect": {
      "field": "bankCap",
      "amount": 4
    },
    "desc": "烹煮线收集 275 件、烹煮技能达 100 级 → 厨藏格数 +4"
  },
  {
    "id": "cook73",
    "path": "cook",
    "ring": 7,
    "name": "烹煮·圆满典",
    "icon": "🍛",
    "iconItem": "cookDown_29",
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "count": 275,
      "level": 100
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "烹煮线收集 275 件、烹煮技能达 100 级 → 冷库格数 +1"
  },
  {
    "id": "cook74",
    "path": "cook",
    "ring": 7,
    "name": "烹煮·圆满章",
    "icon": "🍛",
    "iconItem": "cooking_ext_23",
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "count": 275,
      "level": 100
    },
    "effect": {
      "field": "bankCap",
      "amount": 2
    },
    "desc": "烹煮线收集 275 件、烹煮技能达 100 级 → 厨藏格数 +2"
  },
  {
    "id": "cook75",
    "path": "cook",
    "ring": 7,
    "name": "烹煮·圆满卷",
    "icon": "🍛",
    "iconItem": "bloodClamSalad",
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "count": 275,
      "level": 100
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "烹煮线收集 275 件、烹煮技能达 100 级 → 背包格数 +1"
  },
  {
    "id": "cook81",
    "path": "cook",
    "ring": 8,
    "name": "烹煮·轮回录",
    "icon": "🥟",
    "iconItem": "arkShellGinger",
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "count": 275,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "烹煮线收集 275 件、烹煮技能精通总级数达满分 60%（按动作次数涨） → 背包格数 +2"
  },
  {
    "id": "cook82",
    "path": "cook",
    "ring": 8,
    "name": "烹煮·轮回谱",
    "icon": "🥟",
    "iconItem": "dragonHotpot",
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "count": 275,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "bankCap",
      "amount": 3
    },
    "desc": "烹煮线收集 275 件、烹煮技能精通总级数达满分 60%（按动作次数涨） → 厨藏格数 +3"
  },
  {
    "id": "cook83",
    "path": "cook",
    "ring": 8,
    "name": "烹煮·轮回典",
    "icon": "🥟",
    "iconItem": "wildDish_52",
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "count": 275,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "烹煮线收集 275 件、烹煮技能精通总级数达满分 60%（按动作次数涨） → 冷库格数 +1"
  },
  {
    "id": "cook84",
    "path": "cook",
    "ring": 8,
    "name": "烹煮·轮回章",
    "icon": "🥟",
    "iconItem": "geoduckSteam",
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "count": 275,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "bankCap",
      "amount": 2
    },
    "desc": "烹煮线收集 275 件、烹煮技能精通总级数达满分 60%（按动作次数涨） → 厨藏格数 +2"
  },
  {
    "id": "cook85",
    "path": "cook",
    "ring": 8,
    "name": "烹煮·轮回卷",
    "icon": "🥟",
    "iconItem": "wildDish_25",
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "count": 275,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "烹煮线收集 275 件、烹煮技能精通总级数达满分 60%（按动作次数涨） → 背包格数 +1"
  },
  {
    "id": "cook91",
    "path": "cook",
    "ring": 9,
    "name": "烹煮·历劫录",
    "icon": "🍢",
    "iconItem": "cooking_ext2_27",
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "count": 275,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 3
    },
    "desc": "烹煮线收集 275 件、烹煮技能精通总级数达满分 80%（按动作次数涨） → 背包格数 +3"
  },
  {
    "id": "cook92",
    "path": "cook",
    "ring": 9,
    "name": "烹煮·历劫谱",
    "icon": "🍢",
    "iconItem": "catfishStew",
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "count": 275,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "bankCap",
      "amount": 4
    },
    "desc": "烹煮线收集 275 件、烹煮技能精通总级数达满分 80%（按动作次数涨） → 厨藏格数 +4"
  },
  {
    "id": "cook93",
    "path": "cook",
    "ring": 9,
    "name": "烹煮·历劫典",
    "icon": "🍢",
    "iconItem": "legendaryManHan",
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "count": 275,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "烹煮线收集 275 件、烹煮技能精通总级数达满分 80%（按动作次数涨） → 冷库格数 +1"
  },
  {
    "id": "cook94",
    "path": "cook",
    "ring": 9,
    "name": "烹煮·历劫章",
    "icon": "🍢",
    "iconItem": "wildDish_55",
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "count": 275,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "bankCap",
      "amount": 3
    },
    "desc": "烹煮线收集 275 件、烹煮技能精通总级数达满分 80%（按动作次数涨） → 厨藏格数 +3"
  },
  {
    "id": "cook95",
    "path": "cook",
    "ring": 9,
    "name": "烹煮·历劫卷",
    "icon": "🍢",
    "iconItem": "flowerCrabSteam",
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "count": 275,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "烹煮线收集 275 件、烹煮技能精通总级数达满分 80%（按动作次数涨） → 背包格数 +2"
  },
  {
    "id": "cook101",
    "path": "cook",
    "ring": 10,
    "name": "烹煮·悟道录",
    "icon": "🥗",
    "iconItem": "porcupineBraised",
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "count": 275,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 3
    },
    "desc": "烹煮线收集 275 件、烹煮技能精通总级数达满分 100%（按动作次数涨） → 背包格数 +3"
  },
  {
    "id": "cook102",
    "path": "cook",
    "ring": 10,
    "name": "烹煮·悟道谱",
    "icon": "🥗",
    "iconItem": "cooking_ext2_30",
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "count": 275,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "bankCap",
      "amount": 5
    },
    "desc": "烹煮线收集 275 件、烹煮技能精通总级数达满分 100%（按动作次数涨） → 厨藏格数 +5"
  },
  {
    "id": "cook103",
    "path": "cook",
    "ring": 10,
    "name": "烹煮·悟道典",
    "icon": "🥗",
    "iconItem": "loachSoup",
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "count": 275,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 2
    },
    "desc": "烹煮线收集 275 件、烹煮技能精通总级数达满分 100%（按动作次数涨） → 冷库格数 +2"
  },
  {
    "id": "cook104",
    "path": "cook",
    "ring": 10,
    "name": "烹煮·悟道章",
    "icon": "🥗",
    "iconItem": "late_coo_01",
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "count": 275,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "bankCap",
      "amount": 3
    },
    "desc": "烹煮线收集 275 件、烹煮技能精通总级数达满分 100%（按动作次数涨） → 厨藏格数 +3"
  },
  {
    "id": "cook105",
    "path": "cook",
    "ring": 10,
    "name": "烹煮·悟道卷",
    "icon": "🥗",
    "iconItem": "late_coo_02",
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "count": 275,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "烹煮线收集 275 件、烹煮技能精通总级数达满分 100%（按动作次数涨） → 背包格数 +2"
  },
  {
    "id": "bake11",
    "path": "bake",
    "ring": 1,
    "name": "烘焙·初识录",
    "icon": "🍞",
    "iconItem": "whiteBread",
    "req": {
      "kind": "codex",
      "skill": "baking",
      "count": 7,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "烘焙线收集 7 件 → 背包格数 +1"
  },
  {
    "id": "bake12",
    "path": "bake",
    "ring": 1,
    "name": "烘焙·初识谱",
    "icon": "🍞",
    "iconItem": "baking_ext2_02",
    "req": {
      "kind": "codex",
      "skill": "baking",
      "count": 7,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "烘焙线收集 7 件 → 背包格数 +1"
  },
  {
    "id": "bake13",
    "path": "bake",
    "ring": 1,
    "name": "烘焙·初识典",
    "icon": "🍞",
    "iconItem": "baking_ext2_03",
    "req": {
      "kind": "codex",
      "skill": "baking",
      "count": 7,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "烘焙线收集 7 件 → 背包格数 +1"
  },
  {
    "id": "bake21",
    "path": "bake",
    "ring": 2,
    "name": "烘焙·渐熟录",
    "icon": "🥐",
    "iconItem": "cornTortilla",
    "req": {
      "kind": "codex",
      "skill": "baking",
      "count": 16,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "烘焙线收集 16 件 → 背包格数 +1"
  },
  {
    "id": "bake22",
    "path": "bake",
    "ring": 2,
    "name": "烘焙·渐熟谱",
    "icon": "🥐",
    "iconItem": "baking_ext_03",
    "req": {
      "kind": "codex",
      "skill": "baking",
      "count": 16,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "烘焙线收集 16 件 → 背包格数 +1"
  },
  {
    "id": "bake23",
    "path": "bake",
    "ring": 2,
    "name": "烘焙·渐熟典",
    "icon": "🥐",
    "iconItem": "baking_ext2_04",
    "req": {
      "kind": "codex",
      "skill": "baking",
      "count": 16,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "烘焙线收集 16 件 → 背包格数 +1"
  },
  {
    "id": "bake31",
    "path": "bake",
    "ring": 3,
    "name": "烘焙·通晓录",
    "icon": "🥨",
    "iconItem": "baking_ext2_10",
    "req": {
      "kind": "codex",
      "skill": "baking",
      "count": 31,
      "level": 0
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "烘焙线收集 31 件 → 厨藏格数 +1"
  },
  {
    "id": "bake32",
    "path": "bake",
    "ring": 3,
    "name": "烘焙·通晓谱",
    "icon": "🥨",
    "iconItem": "baking_ext_10",
    "req": {
      "kind": "codex",
      "skill": "baking",
      "count": 31,
      "level": 0
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "烘焙线收集 31 件 → 厨藏格数 +1"
  },
  {
    "id": "bake33",
    "path": "bake",
    "ring": 3,
    "name": "烘焙·通晓典",
    "icon": "🥨",
    "iconItem": "baking_ext_11",
    "req": {
      "kind": "codex",
      "skill": "baking",
      "count": 31,
      "level": 0
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "烘焙线收集 31 件 → 厨藏格数 +1"
  },
  {
    "id": "bake41",
    "path": "bake",
    "ring": 4,
    "name": "烘焙·精研录",
    "icon": "🧁",
    "iconItem": "bakeDown_7",
    "req": {
      "kind": "codex",
      "skill": "baking",
      "count": 51,
      "level": 20
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "烘焙线收集 51 件、烘焙技能达 20 级 → 厨藏格数 +1"
  },
  {
    "id": "bake42",
    "path": "bake",
    "ring": 4,
    "name": "烘焙·精研谱",
    "icon": "🧁",
    "iconItem": "bakeDown_8",
    "req": {
      "kind": "codex",
      "skill": "baking",
      "count": 51,
      "level": 20
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "烘焙线收集 51 件、烘焙技能达 20 级 → 厨藏格数 +1"
  },
  {
    "id": "bake43",
    "path": "bake",
    "ring": 4,
    "name": "烘焙·精研典",
    "icon": "🧁",
    "iconItem": "baking_ext_13",
    "req": {
      "kind": "codex",
      "skill": "baking",
      "count": 51,
      "level": 20
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "烘焙线收集 51 件、烘焙技能达 20 级 → 厨藏格数 +1"
  },
  {
    "id": "bake51",
    "path": "bake",
    "ring": 5,
    "name": "烘焙·大成录",
    "icon": "🎂",
    "iconItem": "bakeDown_13",
    "req": {
      "kind": "codex",
      "skill": "baking",
      "count": 72,
      "level": 45
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "烘焙线收集 72 件、烘焙技能达 45 级 → 厨藏格数 +1"
  },
  {
    "id": "bake52",
    "path": "bake",
    "ring": 5,
    "name": "烘焙·大成谱",
    "icon": "🎂",
    "iconItem": "bakeDown_21",
    "req": {
      "kind": "codex",
      "skill": "baking",
      "count": 72,
      "level": 45
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "烘焙线收集 72 件、烘焙技能达 45 级 → 厨藏格数 +1"
  },
  {
    "id": "bake53",
    "path": "bake",
    "ring": 5,
    "name": "烘焙·大成典",
    "icon": "🎂",
    "iconItem": "baking_ext2_12",
    "req": {
      "kind": "codex",
      "skill": "baking",
      "count": 72,
      "level": 45
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "烘焙线收集 72 件、烘焙技能达 45 级 → 厨藏格数 +1"
  },
  {
    "id": "bake61",
    "path": "bake",
    "ring": 6,
    "name": "烘焙·化境录",
    "icon": "🥮",
    "iconItem": "bakeDown_16",
    "req": {
      "kind": "codex",
      "skill": "baking",
      "count": 92,
      "level": 75
    },
    "effect": {
      "field": "bankCap",
      "amount": 4
    },
    "desc": "烘焙线收集 92 件、烘焙技能达 75 级 → 厨藏格数 +4"
  },
  {
    "id": "bake62",
    "path": "bake",
    "ring": 6,
    "name": "烘焙·化境谱",
    "icon": "🥮",
    "iconItem": "baking_ext2_17",
    "req": {
      "kind": "codex",
      "skill": "baking",
      "count": 92,
      "level": 75
    },
    "effect": {
      "field": "bankCap",
      "amount": 4
    },
    "desc": "烘焙线收集 92 件、烘焙技能达 75 级 → 厨藏格数 +4"
  },
  {
    "id": "bake63",
    "path": "bake",
    "ring": 6,
    "name": "烘焙·化境典",
    "icon": "🥮",
    "iconItem": "rosemaryBread",
    "req": {
      "kind": "codex",
      "skill": "baking",
      "count": 92,
      "level": 75
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "烘焙线收集 92 件、烘焙技能达 75 级 → 冷库格数 +1"
  },
  {
    "id": "bake64",
    "path": "bake",
    "ring": 6,
    "name": "烘焙·化境章",
    "icon": "🥮",
    "iconItem": "bakeDown_17",
    "req": {
      "kind": "codex",
      "skill": "baking",
      "count": 92,
      "level": 75
    },
    "effect": {
      "field": "bankCap",
      "amount": 2
    },
    "desc": "烘焙线收集 92 件、烘焙技能达 75 级 → 厨藏格数 +2"
  },
  {
    "id": "bake65",
    "path": "bake",
    "ring": 6,
    "name": "烘焙·化境卷",
    "icon": "🥮",
    "iconItem": "baking_ext_18",
    "req": {
      "kind": "codex",
      "skill": "baking",
      "count": 92,
      "level": 75
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "烘焙线收集 92 件、烘焙技能达 75 级 → 背包格数 +1"
  },
  {
    "id": "bake71",
    "path": "bake",
    "ring": 7,
    "name": "烘焙·圆满录",
    "icon": "🥯",
    "iconItem": "baking_ext_19",
    "req": {
      "kind": "codex",
      "skill": "baking",
      "count": 92,
      "level": 100
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "烘焙线收集 92 件、烘焙技能达 100 级 → 背包格数 +2"
  },
  {
    "id": "bake72",
    "path": "bake",
    "ring": 7,
    "name": "烘焙·圆满谱",
    "icon": "🥯",
    "iconItem": "bakeDown_18",
    "req": {
      "kind": "codex",
      "skill": "baking",
      "count": 92,
      "level": 100
    },
    "effect": {
      "field": "bankCap",
      "amount": 4
    },
    "desc": "烘焙线收集 92 件、烘焙技能达 100 级 → 厨藏格数 +4"
  },
  {
    "id": "bake73",
    "path": "bake",
    "ring": 7,
    "name": "烘焙·圆满典",
    "icon": "🥯",
    "iconItem": "bakeDown_24",
    "req": {
      "kind": "codex",
      "skill": "baking",
      "count": 92,
      "level": 100
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "烘焙线收集 92 件、烘焙技能达 100 级 → 冷库格数 +1"
  },
  {
    "id": "bake74",
    "path": "bake",
    "ring": 7,
    "name": "烘焙·圆满章",
    "icon": "🥯",
    "iconItem": "baking_ext2_20",
    "req": {
      "kind": "codex",
      "skill": "baking",
      "count": 92,
      "level": 100
    },
    "effect": {
      "field": "bankCap",
      "amount": 2
    },
    "desc": "烘焙线收集 92 件、烘焙技能达 100 级 → 厨藏格数 +2"
  },
  {
    "id": "bake75",
    "path": "bake",
    "ring": 7,
    "name": "烘焙·圆满卷",
    "icon": "🥯",
    "iconItem": "bakeDown_25",
    "req": {
      "kind": "codex",
      "skill": "baking",
      "count": 92,
      "level": 100
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "烘焙线收集 92 件、烘焙技能达 100 级 → 背包格数 +1"
  },
  {
    "id": "bake81",
    "path": "bake",
    "ring": 8,
    "name": "烘焙·轮回录",
    "icon": "🍰",
    "iconItem": "bakeDown_26",
    "req": {
      "kind": "codex",
      "skill": "baking",
      "count": 92,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "烘焙线收集 92 件、烘焙技能精通总级数达满分 60%（按动作次数涨） → 背包格数 +2"
  },
  {
    "id": "bake82",
    "path": "bake",
    "ring": 8,
    "name": "烘焙·轮回谱",
    "icon": "🍰",
    "iconItem": "baking_ext2_22",
    "req": {
      "kind": "codex",
      "skill": "baking",
      "count": 92,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "bankCap",
      "amount": 3
    },
    "desc": "烘焙线收集 92 件、烘焙技能精通总级数达满分 60%（按动作次数涨） → 厨藏格数 +3"
  },
  {
    "id": "bake83",
    "path": "bake",
    "ring": 8,
    "name": "烘焙·轮回典",
    "icon": "🍰",
    "iconItem": "baking_ext2_23",
    "req": {
      "kind": "codex",
      "skill": "baking",
      "count": 92,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "烘焙线收集 92 件、烘焙技能精通总级数达满分 60%（按动作次数涨） → 冷库格数 +1"
  },
  {
    "id": "bake84",
    "path": "bake",
    "ring": 8,
    "name": "烘焙·轮回章",
    "icon": "🍰",
    "iconItem": "baking_ext_23",
    "req": {
      "kind": "codex",
      "skill": "baking",
      "count": 92,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "bankCap",
      "amount": 2
    },
    "desc": "烘焙线收集 92 件、烘焙技能精通总级数达满分 60%（按动作次数涨） → 厨藏格数 +2"
  },
  {
    "id": "bake85",
    "path": "bake",
    "ring": 8,
    "name": "烘焙·轮回卷",
    "icon": "🍰",
    "iconItem": "baking_ext2_24",
    "req": {
      "kind": "codex",
      "skill": "baking",
      "count": 92,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "烘焙线收集 92 件、烘焙技能精通总级数达满分 60%（按动作次数涨） → 背包格数 +1"
  },
  {
    "id": "bake91",
    "path": "bake",
    "ring": 9,
    "name": "烘焙·历劫录",
    "icon": "🧇",
    "iconItem": "baking_ext_25",
    "req": {
      "kind": "codex",
      "skill": "baking",
      "count": 92,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 3
    },
    "desc": "烘焙线收集 92 件、烘焙技能精通总级数达满分 80%（按动作次数涨） → 背包格数 +3"
  },
  {
    "id": "bake92",
    "path": "bake",
    "ring": 9,
    "name": "烘焙·历劫谱",
    "icon": "🧇",
    "iconItem": "baking_ext2_26",
    "req": {
      "kind": "codex",
      "skill": "baking",
      "count": 92,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "bankCap",
      "amount": 4
    },
    "desc": "烘焙线收集 92 件、烘焙技能精通总级数达满分 80%（按动作次数涨） → 厨藏格数 +4"
  },
  {
    "id": "bake93",
    "path": "bake",
    "ring": 9,
    "name": "烘焙·历劫典",
    "icon": "🧇",
    "iconItem": "baking_ext2_27",
    "req": {
      "kind": "codex",
      "skill": "baking",
      "count": 92,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "烘焙线收集 92 件、烘焙技能精通总级数达满分 80%（按动作次数涨） → 冷库格数 +1"
  },
  {
    "id": "bake94",
    "path": "bake",
    "ring": 9,
    "name": "烘焙·历劫章",
    "icon": "🧇",
    "iconItem": "baking_ext_27",
    "req": {
      "kind": "codex",
      "skill": "baking",
      "count": 92,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "bankCap",
      "amount": 3
    },
    "desc": "烘焙线收集 92 件、烘焙技能精通总级数达满分 80%（按动作次数涨） → 厨藏格数 +3"
  },
  {
    "id": "bake95",
    "path": "bake",
    "ring": 9,
    "name": "烘焙·历劫卷",
    "icon": "🧇",
    "iconItem": "baking_ext_28",
    "req": {
      "kind": "codex",
      "skill": "baking",
      "count": 92,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "烘焙线收集 92 件、烘焙技能精通总级数达满分 80%（按动作次数涨） → 背包格数 +2"
  },
  {
    "id": "bake101",
    "path": "bake",
    "ring": 10,
    "name": "烘焙·悟道录",
    "icon": "🥞",
    "iconItem": "baking_ext_29",
    "req": {
      "kind": "codex",
      "skill": "baking",
      "count": 92,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 3
    },
    "desc": "烘焙线收集 92 件、烘焙技能精通总级数达满分 100%（按动作次数涨） → 背包格数 +3"
  },
  {
    "id": "bake102",
    "path": "bake",
    "ring": 10,
    "name": "烘焙·悟道谱",
    "icon": "🥞",
    "iconItem": "baking_ext2_30",
    "req": {
      "kind": "codex",
      "skill": "baking",
      "count": 92,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "bankCap",
      "amount": 5
    },
    "desc": "烘焙线收集 92 件、烘焙技能精通总级数达满分 100%（按动作次数涨） → 厨藏格数 +5"
  },
  {
    "id": "bake103",
    "path": "bake",
    "ring": 10,
    "name": "烘焙·悟道典",
    "icon": "🥞",
    "iconItem": "gap_bak_101",
    "req": {
      "kind": "codex",
      "skill": "baking",
      "count": 92,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 2
    },
    "desc": "烘焙线收集 92 件、烘焙技能精通总级数达满分 100%（按动作次数涨） → 冷库格数 +2"
  },
  {
    "id": "bake104",
    "path": "bake",
    "ring": 10,
    "name": "烘焙·悟道章",
    "icon": "🥞",
    "iconItem": "gap_bak_103",
    "req": {
      "kind": "codex",
      "skill": "baking",
      "count": 92,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "bankCap",
      "amount": 3
    },
    "desc": "烘焙线收集 92 件、烘焙技能精通总级数达满分 100%（按动作次数涨） → 厨藏格数 +3"
  },
  {
    "id": "bake105",
    "path": "bake",
    "ring": 10,
    "name": "烘焙·悟道卷",
    "icon": "🥞",
    "iconItem": "gap_bak_115",
    "req": {
      "kind": "codex",
      "skill": "baking",
      "count": 92,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "烘焙线收集 92 件、烘焙技能精通总级数达满分 100%（按动作次数涨） → 背包格数 +2"
  },
  {
    "id": "brew11",
    "path": "brew",
    "ring": 1,
    "name": "酿造·初识录",
    "icon": "🍵",
    "iconItem": "brewing_ext_01",
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "count": 8,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "酿造线收集 8 件 → 背包格数 +1"
  },
  {
    "id": "brew12",
    "path": "brew",
    "ring": 1,
    "name": "酿造·初识谱",
    "icon": "🍵",
    "iconItem": "brewing_ext2_02",
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "count": 8,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "酿造线收集 8 件 → 背包格数 +1"
  },
  {
    "id": "brew13",
    "path": "brew",
    "ring": 1,
    "name": "酿造·初识典",
    "icon": "🍵",
    "iconItem": "brewing_ext2_81",
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "count": 8,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "酿造线收集 8 件 → 背包格数 +1"
  },
  {
    "id": "brew21",
    "path": "brew",
    "ring": 2,
    "name": "酿造·渐熟录",
    "icon": "🧃",
    "iconItem": "herbalTea",
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "count": 20,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "酿造线收集 20 件 → 背包格数 +1"
  },
  {
    "id": "brew22",
    "path": "brew",
    "ring": 2,
    "name": "酿造·渐熟谱",
    "icon": "🧃",
    "iconItem": "brewing_ext2_05",
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "count": 20,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "酿造线收集 20 件 → 背包格数 +1"
  },
  {
    "id": "brew23",
    "path": "brew",
    "ring": 2,
    "name": "酿造·渐熟典",
    "icon": "🧃",
    "iconItem": "brewing_ext2_83",
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "count": 20,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "酿造线收集 20 件 → 背包格数 +1"
  },
  {
    "id": "brew31",
    "path": "brew",
    "ring": 3,
    "name": "酿造·通晓录",
    "icon": "🍺",
    "iconItem": "brewing_ext2_08",
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "count": 40,
      "level": 0
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "酿造线收集 40 件 → 厨藏格数 +1"
  },
  {
    "id": "brew32",
    "path": "brew",
    "ring": 3,
    "name": "酿造·通晓谱",
    "icon": "🍺",
    "iconItem": "cherryJuice",
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "count": 40,
      "level": 0
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "酿造线收集 40 件 → 厨藏格数 +1"
  },
  {
    "id": "brew33",
    "path": "brew",
    "ring": 3,
    "name": "酿造·通晓典",
    "icon": "🍺",
    "iconItem": "strawberryJuice",
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "count": 40,
      "level": 0
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "酿造线收集 40 件 → 厨藏格数 +1"
  },
  {
    "id": "brew41",
    "path": "brew",
    "ring": 4,
    "name": "酿造·精研录",
    "icon": "🍷",
    "iconItem": "brewing_ext_11",
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "count": 66,
      "level": 20
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "酿造线收集 66 件、酿造技能达 20 级 → 厨藏格数 +1"
  },
  {
    "id": "brew42",
    "path": "brew",
    "ring": 4,
    "name": "酿造·精研谱",
    "icon": "🍷",
    "iconItem": "brewing_ext2_87",
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "count": 66,
      "level": 20
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "酿造线收集 66 件、酿造技能达 20 级 → 厨藏格数 +1"
  },
  {
    "id": "brew43",
    "path": "brew",
    "ring": 4,
    "name": "酿造·精研典",
    "icon": "🍷",
    "iconItem": "brewing_ext2_12",
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "count": 66,
      "level": 20
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "酿造线收集 66 件、酿造技能达 20 级 → 厨藏格数 +1"
  },
  {
    "id": "brew51",
    "path": "brew",
    "ring": 5,
    "name": "酿造·大成录",
    "icon": "🥂",
    "iconItem": "lycheeJuice",
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "count": 93,
      "level": 45
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "酿造线收集 93 件、酿造技能达 45 级 → 厨藏格数 +1"
  },
  {
    "id": "brew52",
    "path": "brew",
    "ring": 5,
    "name": "酿造·大成谱",
    "icon": "🥂",
    "iconItem": "brewing_ext_15",
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "count": 93,
      "level": 45
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "酿造线收集 93 件、酿造技能达 45 级 → 厨藏格数 +1"
  },
  {
    "id": "brew53",
    "path": "brew",
    "ring": 5,
    "name": "酿造·大成典",
    "icon": "🥂",
    "iconItem": "yamJuice",
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "count": 93,
      "level": 45
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "酿造线收集 93 件、酿造技能达 45 级 → 厨藏格数 +1"
  },
  {
    "id": "brew61",
    "path": "brew",
    "ring": 6,
    "name": "酿造·化境录",
    "icon": "🍾",
    "iconItem": "nectarineWine",
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "count": 119,
      "level": 75
    },
    "effect": {
      "field": "bankCap",
      "amount": 4
    },
    "desc": "酿造线收集 119 件、酿造技能达 75 级 → 厨藏格数 +4"
  },
  {
    "id": "brew62",
    "path": "brew",
    "ring": 6,
    "name": "酿造·化境谱",
    "icon": "🍾",
    "iconItem": "brewing_ext_19",
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "count": 119,
      "level": 75
    },
    "effect": {
      "field": "bankCap",
      "amount": 4
    },
    "desc": "酿造线收集 119 件、酿造技能达 75 级 → 厨藏格数 +4"
  },
  {
    "id": "brew63",
    "path": "brew",
    "ring": 6,
    "name": "酿造·化境典",
    "icon": "🍾",
    "iconItem": "brewing_ext2_20",
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "count": 119,
      "level": 75
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "酿造线收集 119 件、酿造技能达 75 级 → 冷库格数 +1"
  },
  {
    "id": "brew64",
    "path": "brew",
    "ring": 6,
    "name": "酿造·化境章",
    "icon": "🍾",
    "iconItem": "brewing_ext2_93",
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "count": 119,
      "level": 75
    },
    "effect": {
      "field": "bankCap",
      "amount": 2
    },
    "desc": "酿造线收集 119 件、酿造技能达 75 级 → 厨藏格数 +2"
  },
  {
    "id": "brew65",
    "path": "brew",
    "ring": 6,
    "name": "酿造·化境卷",
    "icon": "🍾",
    "iconItem": "mandarinWine",
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "count": 119,
      "level": 75
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "酿造线收集 119 件、酿造技能达 75 级 → 背包格数 +1"
  },
  {
    "id": "brew71",
    "path": "brew",
    "ring": 7,
    "name": "酿造·圆满录",
    "icon": "🍹",
    "iconItem": "kumquatWine",
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "count": 119,
      "level": 100
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "酿造线收集 119 件、酿造技能达 100 级 → 背包格数 +2"
  },
  {
    "id": "brew72",
    "path": "brew",
    "ring": 7,
    "name": "酿造·圆满谱",
    "icon": "🍹",
    "iconItem": "brewing_ext_22",
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "count": 119,
      "level": 100
    },
    "effect": {
      "field": "bankCap",
      "amount": 4
    },
    "desc": "酿造线收集 119 件、酿造技能达 100 级 → 厨藏格数 +4"
  },
  {
    "id": "brew73",
    "path": "brew",
    "ring": 7,
    "name": "酿造·圆满典",
    "icon": "🍹",
    "iconItem": "brewing_ext2_23",
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "count": 119,
      "level": 100
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "酿造线收集 119 件、酿造技能达 100 级 → 冷库格数 +1"
  },
  {
    "id": "brew74",
    "path": "brew",
    "ring": 7,
    "name": "酿造·圆满章",
    "icon": "🍹",
    "iconItem": "brewing_ext2_95",
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "count": 119,
      "level": 100
    },
    "effect": {
      "field": "bankCap",
      "amount": 2
    },
    "desc": "酿造线收集 119 件、酿造技能达 100 级 → 厨藏格数 +2"
  },
  {
    "id": "brew75",
    "path": "brew",
    "ring": 7,
    "name": "酿造·圆满卷",
    "icon": "🍹",
    "iconItem": "custardAppleWine",
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "count": 119,
      "level": 100
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "酿造线收集 119 件、酿造技能达 100 级 → 背包格数 +1"
  },
  {
    "id": "brew81",
    "path": "brew",
    "ring": 8,
    "name": "酿造·轮回录",
    "icon": "🥤",
    "iconItem": "sugarAppleWine",
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "count": 119,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "酿造线收集 119 件、酿造技能精通总级数达满分 60%（按动作次数涨） → 背包格数 +2"
  },
  {
    "id": "brew82",
    "path": "brew",
    "ring": 8,
    "name": "酿造·轮回谱",
    "icon": "🥤",
    "iconItem": "brewing_ext_25",
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "count": 119,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "bankCap",
      "amount": 3
    },
    "desc": "酿造线收集 119 件、酿造技能精通总级数达满分 60%（按动作次数涨） → 厨藏格数 +3"
  },
  {
    "id": "brew83",
    "path": "brew",
    "ring": 8,
    "name": "酿造·轮回典",
    "icon": "🥤",
    "iconItem": "jackfruitWine",
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "count": 119,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "酿造线收集 119 件、酿造技能精通总级数达满分 60%（按动作次数涨） → 冷库格数 +1"
  },
  {
    "id": "brew84",
    "path": "brew",
    "ring": 8,
    "name": "酿造·轮回章",
    "icon": "🥤",
    "iconItem": "brewing_ext2_91",
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "count": 119,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "bankCap",
      "amount": 2
    },
    "desc": "酿造线收集 119 件、酿造技能精通总级数达满分 60%（按动作次数涨） → 厨藏格数 +2"
  },
  {
    "id": "brew85",
    "path": "brew",
    "ring": 8,
    "name": "酿造·轮回卷",
    "icon": "🥤",
    "iconItem": "brewing_ext2_97",
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "count": 119,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "酿造线收集 119 件、酿造技能精通总级数达满分 60%（按动作次数涨） → 背包格数 +1"
  },
  {
    "id": "brew91",
    "path": "brew",
    "ring": 9,
    "name": "酿造·历劫录",
    "icon": "🧉",
    "iconItem": "brewing_ext2_27",
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "count": 119,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 3
    },
    "desc": "酿造线收集 119 件、酿造技能精通总级数达满分 80%（按动作次数涨） → 背包格数 +3"
  },
  {
    "id": "brew92",
    "path": "brew",
    "ring": 9,
    "name": "酿造·历劫谱",
    "icon": "🧉",
    "iconItem": "brewing_ext2_98",
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "count": 119,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "bankCap",
      "amount": 4
    },
    "desc": "酿造线收集 119 件、酿造技能精通总级数达满分 80%（按动作次数涨） → 厨藏格数 +4"
  },
  {
    "id": "brew93",
    "path": "brew",
    "ring": 9,
    "name": "酿造·历劫典",
    "icon": "🧉",
    "iconItem": "yaconWine",
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "count": 119,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "酿造线收集 119 件、酿造技能精通总级数达满分 80%（按动作次数涨） → 冷库格数 +1"
  },
  {
    "id": "brew94",
    "path": "brew",
    "ring": 9,
    "name": "酿造·历劫章",
    "icon": "🧉",
    "iconItem": "brewing_ext_28",
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "count": 119,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "bankCap",
      "amount": 3
    },
    "desc": "酿造线收集 119 件、酿造技能精通总级数达满分 80%（按动作次数涨） → 厨藏格数 +3"
  },
  {
    "id": "brew95",
    "path": "brew",
    "ring": 9,
    "name": "酿造·历劫卷",
    "icon": "🧉",
    "iconItem": "brewing_ext2_29",
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "count": 119,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "酿造线收集 119 件、酿造技能精通总级数达满分 80%（按动作次数涨） → 背包格数 +2"
  },
  {
    "id": "brew101",
    "path": "brew",
    "ring": 10,
    "name": "酿造·悟道录",
    "icon": "🍸",
    "iconItem": "oliveWine",
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "count": 119,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 3
    },
    "desc": "酿造线收集 119 件、酿造技能精通总级数达满分 100%（按动作次数涨） → 背包格数 +3"
  },
  {
    "id": "brew102",
    "path": "brew",
    "ring": 10,
    "name": "酿造·悟道谱",
    "icon": "🍸",
    "iconItem": "brewing_ext2_30",
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "count": 119,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "bankCap",
      "amount": 5
    },
    "desc": "酿造线收集 119 件、酿造技能精通总级数达满分 100%（按动作次数涨） → 厨藏格数 +5"
  },
  {
    "id": "brew103",
    "path": "brew",
    "ring": 10,
    "name": "酿造·悟道典",
    "icon": "🍸",
    "iconItem": "jujubeWine",
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "count": 119,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 2
    },
    "desc": "酿造线收集 119 件、酿造技能精通总级数达满分 100%（按动作次数涨） → 冷库格数 +2"
  },
  {
    "id": "brew104",
    "path": "brew",
    "ring": 10,
    "name": "酿造·悟道章",
    "icon": "🍸",
    "iconItem": "gap_bre_113",
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "count": 119,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "bankCap",
      "amount": 3
    },
    "desc": "酿造线收集 119 件、酿造技能精通总级数达满分 100%（按动作次数涨） → 厨藏格数 +3"
  },
  {
    "id": "brew105",
    "path": "brew",
    "ring": 10,
    "name": "酿造·悟道卷",
    "icon": "🍸",
    "iconItem": "late_bre_02",
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "count": 119,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "酿造线收集 119 件、酿造技能精通总级数达满分 100%（按动作次数涨） → 背包格数 +2"
  },
  {
    "id": "spice11",
    "path": "spice",
    "ring": 1,
    "name": "调味·初识录",
    "icon": "🧄",
    "iconItem": "spiceMixing_ext2_02",
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "count": 6,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "调味线收集 6 件 → 背包格数 +1"
  },
  {
    "id": "spice12",
    "path": "spice",
    "ring": 1,
    "name": "调味·初识谱",
    "icon": "🧄",
    "iconItem": "banxiaPowder",
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "count": 6,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "调味线收集 6 件 → 背包格数 +1"
  },
  {
    "id": "spice13",
    "path": "spice",
    "ring": 1,
    "name": "调味·初识典",
    "icon": "🧄",
    "iconItem": "pepperSalt",
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "count": 6,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "调味线收集 6 件 → 背包格数 +1"
  },
  {
    "id": "spice21",
    "path": "spice",
    "ring": 2,
    "name": "调味·渐熟录",
    "icon": "🌶️",
    "iconItem": "riceVinegar",
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "count": 15,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "调味线收集 15 件 → 背包格数 +1"
  },
  {
    "id": "spice22",
    "path": "spice",
    "ring": 2,
    "name": "调味·渐熟谱",
    "icon": "🌶️",
    "iconItem": "cangzhuPowder",
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "count": 15,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "调味线收集 15 件 → 背包格数 +1"
  },
  {
    "id": "spice23",
    "path": "spice",
    "ring": 2,
    "name": "调味·渐熟典",
    "icon": "🌶️",
    "iconItem": "fiveSpice",
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "count": 15,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "调味线收集 15 件 → 背包格数 +1"
  },
  {
    "id": "spice31",
    "path": "spice",
    "ring": 3,
    "name": "调味·通晓录",
    "icon": "🫚",
    "iconItem": "spiceMixing_ext_03",
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "count": 30,
      "level": 0
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "调味线收集 30 件 → 厨藏格数 +1"
  },
  {
    "id": "spice32",
    "path": "spice",
    "ring": 3,
    "name": "调味·通晓谱",
    "icon": "🫚",
    "iconItem": "whitePepper",
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "count": 30,
      "level": 0
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "调味线收集 30 件 → 厨藏格数 +1"
  },
  {
    "id": "spice33",
    "path": "spice",
    "ring": 3,
    "name": "调味·通晓典",
    "icon": "🫚",
    "iconItem": "spiceMixing_ext_04",
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "count": 30,
      "level": 0
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "调味线收集 30 件 → 厨藏格数 +1"
  },
  {
    "id": "spice41",
    "path": "spice",
    "ring": 4,
    "name": "调味·精研录",
    "icon": "🥄",
    "iconItem": "spiceMixing_ext_07",
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "count": 50,
      "level": 20
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "调味线收集 50 件、调味技能达 20 级 → 厨藏格数 +1"
  },
  {
    "id": "spice42",
    "path": "spice",
    "ring": 4,
    "name": "调味·精研谱",
    "icon": "🥄",
    "iconItem": "shanzhuyuPowder",
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "count": 50,
      "level": 20
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "调味线收集 50 件、调味技能达 20 级 → 厨藏格数 +1"
  },
  {
    "id": "spice43",
    "path": "spice",
    "ring": 4,
    "name": "调味·精研典",
    "icon": "🥄",
    "iconItem": "spiceMixing_ext_12",
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "count": 50,
      "level": 20
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "调味线收集 50 件、调味技能达 20 级 → 厨藏格数 +1"
  },
  {
    "id": "spice51",
    "path": "spice",
    "ring": 5,
    "name": "调味·大成录",
    "icon": "🫙",
    "iconItem": "spiceMixing_ext_14",
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "count": 70,
      "level": 45
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "调味线收集 70 件、调味技能达 45 级 → 厨藏格数 +1"
  },
  {
    "id": "spice52",
    "path": "spice",
    "ring": 5,
    "name": "调味·大成谱",
    "icon": "🫙",
    "iconItem": "baizhuPowder",
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "count": 70,
      "level": 45
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "调味线收集 70 件、调味技能达 45 级 → 厨藏格数 +1"
  },
  {
    "id": "spice53",
    "path": "spice",
    "ring": 5,
    "name": "调味·大成典",
    "icon": "🫙",
    "iconItem": "spiceMixing_ext2_03",
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "count": 70,
      "level": 45
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "调味线收集 70 件、调味技能达 45 级 → 厨藏格数 +1"
  },
  {
    "id": "spice61",
    "path": "spice",
    "ring": 6,
    "name": "调味·化境录",
    "icon": "⚗️",
    "iconItem": "dangguiPowder",
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "count": 90,
      "level": 75
    },
    "effect": {
      "field": "bankCap",
      "amount": 4
    },
    "desc": "调味线收集 90 件、调味技能达 75 级 → 厨藏格数 +4"
  },
  {
    "id": "spice62",
    "path": "spice",
    "ring": 6,
    "name": "调味·化境谱",
    "icon": "⚗️",
    "iconItem": "chuanxiongPowder",
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "count": 90,
      "level": 75
    },
    "effect": {
      "field": "bankCap",
      "amount": 4
    },
    "desc": "调味线收集 90 件、调味技能达 75 级 → 厨藏格数 +4"
  },
  {
    "id": "spice63",
    "path": "spice",
    "ring": 6,
    "name": "调味·化境典",
    "icon": "⚗️",
    "iconItem": "spiceMixing_ext2_17",
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "count": 90,
      "level": 75
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "调味线收集 90 件、调味技能达 75 级 → 冷库格数 +1"
  },
  {
    "id": "spice64",
    "path": "spice",
    "ring": 6,
    "name": "调味·化境章",
    "icon": "⚗️",
    "iconItem": "spiceMixing_ext_17",
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "count": 90,
      "level": 75
    },
    "effect": {
      "field": "bankCap",
      "amount": 2
    },
    "desc": "调味线收集 90 件、调味技能达 75 级 → 厨藏格数 +2"
  },
  {
    "id": "spice65",
    "path": "spice",
    "ring": 6,
    "name": "调味·化境卷",
    "icon": "⚗️",
    "iconItem": "spiceMixing_ext_18",
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "count": 90,
      "level": 75
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "调味线收集 90 件、调味技能达 75 级 → 背包格数 +1"
  },
  {
    "id": "spice71",
    "path": "spice",
    "ring": 7,
    "name": "调味·圆满录",
    "icon": "🧊",
    "iconItem": "tianmaPowder",
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "count": 90,
      "level": 100
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "调味线收集 90 件、调味技能达 100 级 → 背包格数 +2"
  },
  {
    "id": "spice72",
    "path": "spice",
    "ring": 7,
    "name": "调味·圆满谱",
    "icon": "🧊",
    "iconItem": "shihuPowder",
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "count": 90,
      "level": 100
    },
    "effect": {
      "field": "bankCap",
      "amount": 4
    },
    "desc": "调味线收集 90 件、调味技能达 100 级 → 厨藏格数 +4"
  },
  {
    "id": "spice73",
    "path": "spice",
    "ring": 7,
    "name": "调味·圆满典",
    "icon": "🧊",
    "iconItem": "spiceMixing_ext_20",
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "count": 90,
      "level": 100
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "调味线收集 90 件、调味技能达 100 级 → 冷库格数 +1"
  },
  {
    "id": "spice74",
    "path": "spice",
    "ring": 7,
    "name": "调味·圆满章",
    "icon": "🧊",
    "iconItem": "huangjingPowder",
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "count": 90,
      "level": 100
    },
    "effect": {
      "field": "bankCap",
      "amount": 2
    },
    "desc": "调味线收集 90 件、调味技能达 100 级 → 厨藏格数 +2"
  },
  {
    "id": "spice75",
    "path": "spice",
    "ring": 7,
    "name": "调味·圆满卷",
    "icon": "🧊",
    "iconItem": "spiceMixing_ext_21",
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "count": 90,
      "level": 100
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "调味线收集 90 件、调味技能达 100 级 → 背包格数 +1"
  },
  {
    "id": "spice81",
    "path": "spice",
    "ring": 8,
    "name": "调味·轮回录",
    "icon": "🫒",
    "iconItem": "fossilSpice",
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "count": 90,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "调味线收集 90 件、调味技能精通总级数达满分 60%（按动作次数涨） → 背包格数 +2"
  },
  {
    "id": "spice82",
    "path": "spice",
    "ring": 8,
    "name": "调味·轮回谱",
    "icon": "🫒",
    "iconItem": "saffronPowder",
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "count": 90,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "bankCap",
      "amount": 3
    },
    "desc": "调味线收集 90 件、调味技能精通总级数达满分 60%（按动作次数涨） → 厨藏格数 +3"
  },
  {
    "id": "spice83",
    "path": "spice",
    "ring": 8,
    "name": "调味·轮回典",
    "icon": "🫒",
    "iconItem": "spiceMixing_ext2_22",
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "count": 90,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "调味线收集 90 件、调味技能精通总级数达满分 60%（按动作次数涨） → 冷库格数 +1"
  },
  {
    "id": "spice84",
    "path": "spice",
    "ring": 8,
    "name": "调味·轮回章",
    "icon": "🫒",
    "iconItem": "spiceMixing_ext2_10",
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "count": 90,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "bankCap",
      "amount": 2
    },
    "desc": "调味线收集 90 件、调味技能精通总级数达满分 60%（按动作次数涨） → 厨藏格数 +2"
  },
  {
    "id": "spice85",
    "path": "spice",
    "ring": 8,
    "name": "调味·轮回卷",
    "icon": "🫒",
    "iconItem": "spiceMixing_ext2_23",
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "count": 90,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "调味线收集 90 件、调味技能精通总级数达满分 60%（按动作次数涨） → 背包格数 +1"
  },
  {
    "id": "spice91",
    "path": "spice",
    "ring": 9,
    "name": "调味·历劫录",
    "icon": "🥜",
    "iconItem": "spiceMixing_ext_24",
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "count": 90,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 3
    },
    "desc": "调味线收集 90 件、调味技能精通总级数达满分 80%（按动作次数涨） → 背包格数 +3"
  },
  {
    "id": "spice92",
    "path": "spice",
    "ring": 9,
    "name": "调味·历劫谱",
    "icon": "🥜",
    "iconItem": "spiceMixing_ext2_25",
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "count": 90,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "bankCap",
      "amount": 4
    },
    "desc": "调味线收集 90 件、调味技能精通总级数达满分 80%（按动作次数涨） → 厨藏格数 +4"
  },
  {
    "id": "spice93",
    "path": "spice",
    "ring": 9,
    "name": "调味·历劫典",
    "icon": "🥜",
    "iconItem": "spiceMixing_ext_25",
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "count": 90,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "调味线收集 90 件、调味技能精通总级数达满分 80%（按动作次数涨） → 冷库格数 +1"
  },
  {
    "id": "spice94",
    "path": "spice",
    "ring": 9,
    "name": "调味·历劫章",
    "icon": "🥜",
    "iconItem": "spiceMixing_ext_26",
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "count": 90,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "bankCap",
      "amount": 3
    },
    "desc": "调味线收集 90 件、调味技能精通总级数达满分 80%（按动作次数涨） → 厨藏格数 +3"
  },
  {
    "id": "spice95",
    "path": "spice",
    "ring": 9,
    "name": "调味·历劫卷",
    "icon": "🥜",
    "iconItem": "spiceMixing_ext2_27",
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "count": 90,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "调味线收集 90 件、调味技能精通总级数达满分 80%（按动作次数涨） → 背包格数 +2"
  },
  {
    "id": "spice101",
    "path": "spice",
    "ring": 10,
    "name": "调味·悟道录",
    "icon": "🍋",
    "iconItem": "spiceMixing_ext2_28",
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "count": 90,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 3
    },
    "desc": "调味线收集 90 件、调味技能精通总级数达满分 100%（按动作次数涨） → 背包格数 +3"
  },
  {
    "id": "spice102",
    "path": "spice",
    "ring": 10,
    "name": "调味·悟道谱",
    "icon": "🍋",
    "iconItem": "spiceMixing_ext2_29",
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "count": 90,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "bankCap",
      "amount": 5
    },
    "desc": "调味线收集 90 件、调味技能精通总级数达满分 100%（按动作次数涨） → 厨藏格数 +5"
  },
  {
    "id": "spice103",
    "path": "spice",
    "ring": 10,
    "name": "调味·悟道典",
    "icon": "🍋",
    "iconItem": "spiceMixing_ext_29",
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "count": 90,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 2
    },
    "desc": "调味线收集 90 件、调味技能精通总级数达满分 100%（按动作次数涨） → 冷库格数 +2"
  },
  {
    "id": "spice104",
    "path": "spice",
    "ring": 10,
    "name": "调味·悟道章",
    "icon": "🍋",
    "iconItem": "spiceMixing_ext_30",
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "count": 90,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "bankCap",
      "amount": 3
    },
    "desc": "调味线收集 90 件、调味技能精通总级数达满分 100%（按动作次数涨） → 厨藏格数 +3"
  },
  {
    "id": "spice105",
    "path": "spice",
    "ring": 10,
    "name": "调味·悟道卷",
    "icon": "🍋",
    "iconItem": "late_spi_01",
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "count": 90,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "调味线收集 90 件、调味技能精通总级数达满分 100%（按动作次数涨） → 背包格数 +2"
  },
  {
    "id": "smith11",
    "path": "smith",
    "ring": 1,
    "name": "锻造·初识录",
    "icon": "🔧",
    "iconItem": "ironBoard",
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "count": 23,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "锻造线收集 23 件 → 背包格数 +1"
  },
  {
    "id": "smith12",
    "path": "smith",
    "ring": 1,
    "name": "锻造·初识谱",
    "icon": "🔧",
    "iconItem": "smith_铁_legs",
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "count": 23,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "锻造线收集 23 件 → 背包格数 +1"
  },
  {
    "id": "smith13",
    "path": "smith",
    "ring": 1,
    "name": "锻造·初识典",
    "icon": "🔧",
    "iconItem": "smith_ext_04",
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "count": 23,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "锻造线收集 23 件 → 背包格数 +1"
  },
  {
    "id": "smith21",
    "path": "smith",
    "ring": 2,
    "name": "锻造·渐熟录",
    "icon": "🔩",
    "iconItem": "silverBottle",
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "count": 58,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "锻造线收集 58 件 → 背包格数 +1"
  },
  {
    "id": "smith22",
    "path": "smith",
    "ring": 2,
    "name": "锻造·渐熟谱",
    "icon": "🔩",
    "iconItem": "smith_ext_08",
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "count": 58,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "锻造线收集 58 件 → 背包格数 +1"
  },
  {
    "id": "smith23",
    "path": "smith",
    "ring": 2,
    "name": "锻造·渐熟典",
    "icon": "🔩",
    "iconItem": "smith_秘银_legs",
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "count": 58,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "锻造线收集 58 件 → 背包格数 +1"
  },
  {
    "id": "smith31",
    "path": "smith",
    "ring": 3,
    "name": "锻造·通晓录",
    "icon": "⚒️",
    "iconItem": "inipamethyst_Weapon",
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "count": 115,
      "level": 0
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "锻造线收集 115 件 → 厨藏格数 +1"
  },
  {
    "id": "smith32",
    "path": "smith",
    "ring": 3,
    "name": "锻造·通晓谱",
    "icon": "⚒️",
    "iconItem": "inipturquoise_Board",
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "count": 115,
      "level": 0
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "锻造线收集 115 件 → 厨藏格数 +1"
  },
  {
    "id": "smith33",
    "path": "smith",
    "ring": 3,
    "name": "锻造·通晓典",
    "icon": "⚒️",
    "iconItem": "inipturquoise_Weapon",
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "count": 115,
      "level": 0
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "锻造线收集 115 件 → 厨藏格数 +1"
  },
  {
    "id": "smith41",
    "path": "smith",
    "ring": 4,
    "name": "锻造·精研录",
    "icon": "🛠️",
    "iconItem": "smith_ext2_05",
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "count": 191,
      "level": 20
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "锻造线收集 191 件、锻造技能达 20 级 → 厨藏格数 +1"
  },
  {
    "id": "smith42",
    "path": "smith",
    "ring": 4,
    "name": "锻造·精研谱",
    "icon": "🛠️",
    "iconItem": "inipdiamond_Amulet",
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "count": 191,
      "level": 20
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "锻造线收集 191 件、锻造技能达 20 级 → 厨藏格数 +1"
  },
  {
    "id": "smith43",
    "path": "smith",
    "ring": 4,
    "name": "锻造·精研典",
    "icon": "🛠️",
    "iconItem": "inipdiamond_Pot",
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "count": 191,
      "level": 20
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "锻造线收集 191 件、锻造技能达 20 级 → 厨藏格数 +1"
  },
  {
    "id": "smith51",
    "path": "smith",
    "ring": 5,
    "name": "锻造·大成录",
    "icon": "⚙️",
    "iconItem": "smith_龙鳞_legs",
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "count": 267,
      "level": 45
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "锻造线收集 267 件、锻造技能达 45 级 → 厨藏格数 +1"
  },
  {
    "id": "smith52",
    "path": "smith",
    "ring": 5,
    "name": "锻造·大成谱",
    "icon": "⚙️",
    "iconItem": "iniplead_Legs",
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "count": 267,
      "level": 45
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "锻造线收集 267 件、锻造技能达 45 级 → 厨藏格数 +1"
  },
  {
    "id": "smith53",
    "path": "smith",
    "ring": 5,
    "name": "锻造·大成典",
    "icon": "⚙️",
    "iconItem": "smith_龙鳞_ring",
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "count": 267,
      "level": 45
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "锻造线收集 267 件、锻造技能达 45 级 → 厨藏格数 +1"
  },
  {
    "id": "smith61",
    "path": "smith",
    "ring": 6,
    "name": "锻造·化境录",
    "icon": "🗡️",
    "iconItem": "inipnickel_Board",
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "count": 343,
      "level": 75
    },
    "effect": {
      "field": "bankCap",
      "amount": 4
    },
    "desc": "锻造线收集 343 件、锻造技能达 75 级 → 厨藏格数 +4"
  },
  {
    "id": "smith62",
    "path": "smith",
    "ring": 6,
    "name": "锻造·化境谱",
    "icon": "🗡️",
    "iconItem": "inipnickel_Pot",
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "count": 343,
      "level": 75
    },
    "effect": {
      "field": "bankCap",
      "amount": 4
    },
    "desc": "锻造线收集 343 件、锻造技能达 75 级 → 厨藏格数 +4"
  },
  {
    "id": "smith63",
    "path": "smith",
    "ring": 6,
    "name": "锻造·化境典",
    "icon": "🗡️",
    "iconItem": "inipsaltpeter_Helmet",
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "count": 343,
      "level": 75
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "锻造线收集 343 件、锻造技能达 75 级 → 冷库格数 +1"
  },
  {
    "id": "smith64",
    "path": "smith",
    "ring": 6,
    "name": "锻造·化境章",
    "icon": "🗡️",
    "iconItem": "saltpeterAmulet",
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "count": 343,
      "level": 75
    },
    "effect": {
      "field": "bankCap",
      "amount": 2
    },
    "desc": "锻造线收集 343 件、锻造技能达 75 级 → 厨藏格数 +2"
  },
  {
    "id": "smith65",
    "path": "smith",
    "ring": 6,
    "name": "锻造·化境卷",
    "icon": "🗡️",
    "iconItem": "smith_ext2_29",
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "count": 343,
      "level": 75
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "锻造线收集 343 件、锻造技能达 75 级 → 背包格数 +1"
  },
  {
    "id": "smith71",
    "path": "smith",
    "ring": 7,
    "name": "锻造·圆满录",
    "icon": "🪛",
    "iconItem": "inipsulfur_Pot",
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "count": 343,
      "level": 100
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "锻造线收集 343 件、锻造技能达 100 级 → 背包格数 +2"
  },
  {
    "id": "smith72",
    "path": "smith",
    "ring": 7,
    "name": "锻造·圆满谱",
    "icon": "🪛",
    "iconItem": "sulfurAmulet",
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "count": 343,
      "level": 100
    },
    "effect": {
      "field": "bankCap",
      "amount": 4
    },
    "desc": "锻造线收集 343 件、锻造技能达 100 级 → 厨藏格数 +4"
  },
  {
    "id": "smith73",
    "path": "smith",
    "ring": 7,
    "name": "锻造·圆满典",
    "icon": "🪛",
    "iconItem": "inipalum_Board",
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "count": 343,
      "level": 100
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "锻造线收集 343 件、锻造技能达 100 级 → 冷库格数 +1"
  },
  {
    "id": "smith74",
    "path": "smith",
    "ring": 7,
    "name": "锻造·圆满章",
    "icon": "🪛",
    "iconItem": "inipalum_Ring",
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "count": 343,
      "level": 100
    },
    "effect": {
      "field": "bankCap",
      "amount": 2
    },
    "desc": "锻造线收集 343 件、锻造技能达 100 级 → 厨藏格数 +2"
  },
  {
    "id": "smith75",
    "path": "smith",
    "ring": 7,
    "name": "锻造·圆满卷",
    "icon": "🪛",
    "iconItem": "smith_钨_ring",
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "count": 343,
      "level": 100
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "锻造线收集 343 件、锻造技能达 100 级 → 背包格数 +1"
  },
  {
    "id": "smith81",
    "path": "smith",
    "ring": 8,
    "name": "锻造·轮回录",
    "icon": "🔪",
    "iconItem": "iniptitanium_Boots",
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "count": 343,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "锻造线收集 343 件、锻造技能精通总级数达满分 60%（按动作次数涨） → 背包格数 +2"
  },
  {
    "id": "smith82",
    "path": "smith",
    "ring": 8,
    "name": "锻造·轮回谱",
    "icon": "🔪",
    "iconItem": "micaAmulet",
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "count": 343,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "bankCap",
      "amount": 3
    },
    "desc": "锻造线收集 343 件、锻造技能精通总级数达满分 60%（按动作次数涨） → 厨藏格数 +3"
  },
  {
    "id": "smith83",
    "path": "smith",
    "ring": 8,
    "name": "锻造·轮回典",
    "icon": "🔪",
    "iconItem": "smith_锰_helmet",
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "count": 343,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "锻造线收集 343 件、锻造技能精通总级数达满分 60%（按动作次数涨） → 冷库格数 +1"
  },
  {
    "id": "smith84",
    "path": "smith",
    "ring": 8,
    "name": "锻造·轮回章",
    "icon": "🔪",
    "iconItem": "inipquartz_Legs",
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "count": 343,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "bankCap",
      "amount": 2
    },
    "desc": "锻造线收集 343 件、锻造技能精通总级数达满分 60%（按动作次数涨） → 厨藏格数 +2"
  },
  {
    "id": "smith85",
    "path": "smith",
    "ring": 8,
    "name": "锻造·轮回卷",
    "icon": "🔪",
    "iconItem": "smith_锰_ring",
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "count": 343,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "锻造线收集 343 件、锻造技能精通总级数达满分 60%（按动作次数涨） → 背包格数 +1"
  },
  {
    "id": "smith91",
    "path": "smith",
    "ring": 9,
    "name": "锻造·历劫录",
    "icon": "🗜️",
    "iconItem": "inipjade_Pot",
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "count": 343,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 3
    },
    "desc": "锻造线收集 343 件、锻造技能精通总级数达满分 80%（按动作次数涨） → 背包格数 +3"
  },
  {
    "id": "smith92",
    "path": "smith",
    "ring": 9,
    "name": "锻造·历劫谱",
    "icon": "🗜️",
    "iconItem": "smith_钒_ring",
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "count": 343,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "bankCap",
      "amount": 4
    },
    "desc": "锻造线收集 343 件、锻造技能精通总级数达满分 80%（按动作次数涨） → 厨藏格数 +4"
  },
  {
    "id": "smith93",
    "path": "smith",
    "ring": 9,
    "name": "锻造·历劫典",
    "icon": "🗜️",
    "iconItem": "inipagate_Board",
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "count": 343,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "锻造线收集 343 件、锻造技能精通总级数达满分 80%（按动作次数涨） → 冷库格数 +1"
  },
  {
    "id": "smith94",
    "path": "smith",
    "ring": 9,
    "name": "锻造·历劫章",
    "icon": "🗜️",
    "iconItem": "inipagate_Weapon",
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "count": 343,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "bankCap",
      "amount": 3
    },
    "desc": "锻造线收集 343 件、锻造技能精通总级数达满分 80%（按动作次数涨） → 厨藏格数 +3"
  },
  {
    "id": "smith95",
    "path": "smith",
    "ring": 9,
    "name": "锻造·历劫卷",
    "icon": "🗜️",
    "iconItem": "inipgraphite_Pot",
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "count": 343,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "锻造线收集 343 件、锻造技能精通总级数达满分 80%（按动作次数涨） → 背包格数 +2"
  },
  {
    "id": "smith101",
    "path": "smith",
    "ring": 10,
    "name": "锻造·悟道录",
    "icon": "🪚",
    "iconItem": "inipsapphire_Board",
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "count": 343,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 3
    },
    "desc": "锻造线收集 343 件、锻造技能精通总级数达满分 100%（按动作次数涨） → 背包格数 +3"
  },
  {
    "id": "smith102",
    "path": "smith",
    "ring": 10,
    "name": "锻造·悟道谱",
    "icon": "🪚",
    "iconItem": "inipsapphire_Weapon",
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "count": 343,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "bankCap",
      "amount": 5
    },
    "desc": "锻造线收集 343 件、锻造技能精通总级数达满分 100%（按动作次数涨） → 厨藏格数 +5"
  },
  {
    "id": "smith103",
    "path": "smith",
    "ring": 10,
    "name": "锻造·悟道典",
    "icon": "🪚",
    "iconItem": "lateGear104Body",
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "count": 343,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 2
    },
    "desc": "锻造线收集 343 件、锻造技能精通总级数达满分 100%（按动作次数涨） → 冷库格数 +2"
  },
  {
    "id": "smith104",
    "path": "smith",
    "ring": 10,
    "name": "锻造·悟道章",
    "icon": "🪚",
    "iconItem": "lateGear108Helmet",
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "count": 343,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "bankCap",
      "amount": 3
    },
    "desc": "锻造线收集 343 件、锻造技能精通总级数达满分 100%（按动作次数涨） → 厨藏格数 +3"
  },
  {
    "id": "smith105",
    "path": "smith",
    "ring": 10,
    "name": "锻造·悟道卷",
    "icon": "🪚",
    "iconItem": "lateGear112Weapon",
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "count": 343,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "锻造线收集 343 件、锻造技能精通总级数达满分 100%（按动作次数涨） → 背包格数 +2"
  },
  {
    "id": "wood11",
    "path": "wood",
    "ring": 1,
    "name": "伐薪·初识录",
    "icon": "🪵",
    "iconItem": "cedarWood",
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "count": 3,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "伐薪线收集 3 件 → 背包格数 +1"
  },
  {
    "id": "wood12",
    "path": "wood",
    "ring": 1,
    "name": "伐薪·初识谱",
    "icon": "🪵",
    "iconItem": "cedarWood",
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "count": 3,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "伐薪线收集 3 件 → 背包格数 +1"
  },
  {
    "id": "wood13",
    "path": "wood",
    "ring": 1,
    "name": "伐薪·初识典",
    "icon": "🪵",
    "iconItem": "cedarWood",
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "count": 3,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "伐薪线收集 3 件 → 背包格数 +1"
  },
  {
    "id": "wood21",
    "path": "wood",
    "ring": 2,
    "name": "伐薪·渐熟录",
    "icon": "🌲",
    "iconItem": "birchWood",
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "count": 4,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "伐薪线收集 4 件 → 背包格数 +1"
  },
  {
    "id": "wood22",
    "path": "wood",
    "ring": 2,
    "name": "伐薪·渐熟谱",
    "icon": "🌲",
    "iconItem": "elmWood",
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "count": 4,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "伐薪线收集 4 件 → 背包格数 +1"
  },
  {
    "id": "wood23",
    "path": "wood",
    "ring": 2,
    "name": "伐薪·渐熟典",
    "icon": "🌲",
    "iconItem": "elmWood",
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "count": 4,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "伐薪线收集 4 件 → 背包格数 +1"
  },
  {
    "id": "wood31",
    "path": "wood",
    "ring": 3,
    "name": "伐薪·通晓录",
    "icon": "🌳",
    "iconItem": "camphorWood",
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "count": 7,
      "level": 0
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "伐薪线收集 7 件 → 厨藏格数 +1"
  },
  {
    "id": "wood32",
    "path": "wood",
    "ring": 3,
    "name": "伐薪·通晓谱",
    "icon": "🌳",
    "iconItem": "camphorWood",
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "count": 7,
      "level": 0
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "伐薪线收集 7 件 → 厨藏格数 +1"
  },
  {
    "id": "wood33",
    "path": "wood",
    "ring": 3,
    "name": "伐薪·通晓典",
    "icon": "🌳",
    "iconItem": "camphorWood",
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "count": 7,
      "level": 0
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "伐薪线收集 7 件 → 厨藏格数 +1"
  },
  {
    "id": "wood41",
    "path": "wood",
    "ring": 4,
    "name": "伐薪·精研录",
    "icon": "🎋",
    "iconItem": "rosePearWood",
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "count": 11,
      "level": 20
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "伐薪线收集 11 件、伐薪技能达 20 级 → 厨藏格数 +1"
  },
  {
    "id": "wood42",
    "path": "wood",
    "ring": 4,
    "name": "伐薪·精研谱",
    "icon": "🎋",
    "iconItem": "redSandalWood",
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "count": 11,
      "level": 20
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "伐薪线收集 11 件、伐薪技能达 20 级 → 厨藏格数 +1"
  },
  {
    "id": "wood43",
    "path": "wood",
    "ring": 4,
    "name": "伐薪·精研典",
    "icon": "🎋",
    "iconItem": "redSandalWood",
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "count": 11,
      "level": 20
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "伐薪线收集 11 件、伐薪技能达 20 级 → 厨藏格数 +1"
  },
  {
    "id": "wood51",
    "path": "wood",
    "ring": 5,
    "name": "伐薪·大成录",
    "icon": "🍃",
    "iconItem": "ironwoodTimber",
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "count": 16,
      "level": 45
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "伐薪线收集 16 件、伐薪技能达 45 级 → 厨藏格数 +1"
  },
  {
    "id": "wood52",
    "path": "wood",
    "ring": 5,
    "name": "伐薪·大成谱",
    "icon": "🍃",
    "iconItem": "ironwoodTimber",
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "count": 16,
      "level": 45
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "伐薪线收集 16 件、伐薪技能达 45 级 → 厨藏格数 +1"
  },
  {
    "id": "wood53",
    "path": "wood",
    "ring": 5,
    "name": "伐薪·大成典",
    "icon": "🍃",
    "iconItem": "ironwoodTimber",
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "count": 16,
      "level": 45
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "伐薪线收集 16 件、伐薪技能达 45 级 → 厨藏格数 +1"
  },
  {
    "id": "wood61",
    "path": "wood",
    "ring": 6,
    "name": "伐薪·化境录",
    "icon": "🎍",
    "iconItem": "fragrantRosewood",
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "count": 20,
      "level": 75
    },
    "effect": {
      "field": "offlineH",
      "amount": 1
    },
    "desc": "伐薪线收集 20 件、伐薪技能达 75 级 → 离线收益时长上限 +1 小时"
  },
  {
    "id": "wood62",
    "path": "wood",
    "ring": 6,
    "name": "伐薪·化境谱",
    "icon": "🎍",
    "iconItem": "fragrantRosewood",
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "count": 20,
      "level": 75
    },
    "effect": {
      "field": "flatYield",
      "amount": 1
    },
    "desc": "伐薪线收集 20 件、伐薪技能达 75 级 → 伐薪每次动作额外 +1 件"
  },
  {
    "id": "wood63",
    "path": "wood",
    "ring": 6,
    "name": "伐薪·化境典",
    "icon": "🎍",
    "iconItem": "borneolWood",
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "count": 20,
      "level": 75
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "伐薪线收集 20 件、伐薪技能达 75 级 → 冷库格数 +1"
  },
  {
    "id": "wood64",
    "path": "wood",
    "ring": 6,
    "name": "伐薪·化境章",
    "icon": "🎍",
    "iconItem": "borneolWood",
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "count": 20,
      "level": 75
    },
    "effect": {
      "field": "bankCap",
      "amount": 2
    },
    "desc": "伐薪线收集 20 件、伐薪技能达 75 级 → 厨藏格数 +2"
  },
  {
    "id": "wood65",
    "path": "wood",
    "ring": 6,
    "name": "伐薪·化境卷",
    "icon": "🎍",
    "iconItem": "borneolWood",
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "count": 20,
      "level": 75
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "伐薪线收集 20 件、伐薪技能达 75 级 → 背包格数 +1"
  },
  {
    "id": "wood71",
    "path": "wood",
    "ring": 7,
    "name": "伐薪·圆满录",
    "icon": "🌴",
    "iconItem": "glazeWood",
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "count": 20,
      "level": 100
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "伐薪线收集 20 件、伐薪技能达 100 级 → 背包格数 +2"
  },
  {
    "id": "wood72",
    "path": "wood",
    "ring": 7,
    "name": "伐薪·圆满谱",
    "icon": "🌴",
    "iconItem": "glazeWood",
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "count": 20,
      "level": 100
    },
    "effect": {
      "field": "flatYield",
      "amount": 1
    },
    "desc": "伐薪线收集 20 件、伐薪技能达 100 级 → 伐薪每次动作额外 +1 件"
  },
  {
    "id": "wood73",
    "path": "wood",
    "ring": 7,
    "name": "伐薪·圆满典",
    "icon": "🌴",
    "iconItem": "giltWood",
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "count": 20,
      "level": 100
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "伐薪线收集 20 件、伐薪技能达 100 级 → 冷库格数 +1"
  },
  {
    "id": "wood74",
    "path": "wood",
    "ring": 7,
    "name": "伐薪·圆满章",
    "icon": "🌴",
    "iconItem": "giltWood",
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "count": 20,
      "level": 100
    },
    "effect": {
      "field": "bankCap",
      "amount": 2
    },
    "desc": "伐薪线收集 20 件、伐薪技能达 100 级 → 厨藏格数 +2"
  },
  {
    "id": "wood75",
    "path": "wood",
    "ring": 7,
    "name": "伐薪·圆满卷",
    "icon": "🌴",
    "iconItem": "giltWood",
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "count": 20,
      "level": 100
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "伐薪线收集 20 件、伐薪技能达 100 级 → 背包格数 +1"
  },
  {
    "id": "wood81",
    "path": "wood",
    "ring": 8,
    "name": "伐薪·轮回录",
    "icon": "🍂",
    "iconItem": "starWood",
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "count": 20,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "伐薪线收集 20 件、伐薪技能精通总级数达满分 60%（按动作次数涨） → 背包格数 +2"
  },
  {
    "id": "wood82",
    "path": "wood",
    "ring": 8,
    "name": "伐薪·轮回谱",
    "icon": "🍂",
    "iconItem": "starWood",
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "count": 20,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "bankCap",
      "amount": 3
    },
    "desc": "伐薪线收集 20 件、伐薪技能精通总级数达满分 60%（按动作次数涨） → 厨藏格数 +3"
  },
  {
    "id": "wood83",
    "path": "wood",
    "ring": 8,
    "name": "伐薪·轮回典",
    "icon": "🍂",
    "iconItem": "moonWood",
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "count": 20,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "伐薪线收集 20 件、伐薪技能精通总级数达满分 60%（按动作次数涨） → 冷库格数 +1"
  },
  {
    "id": "wood84",
    "path": "wood",
    "ring": 8,
    "name": "伐薪·轮回章",
    "icon": "🍂",
    "iconItem": "moonWood",
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "count": 20,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "bankCap",
      "amount": 2
    },
    "desc": "伐薪线收集 20 件、伐薪技能精通总级数达满分 60%（按动作次数涨） → 厨藏格数 +2"
  },
  {
    "id": "wood85",
    "path": "wood",
    "ring": 8,
    "name": "伐薪·轮回卷",
    "icon": "🍂",
    "iconItem": "moonWood",
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "count": 20,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "伐薪线收集 20 件、伐薪技能精通总级数达满分 60%（按动作次数涨） → 背包格数 +1"
  },
  {
    "id": "wood91",
    "path": "wood",
    "ring": 9,
    "name": "伐薪·历劫录",
    "icon": "🪓",
    "iconItem": "voidWood",
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "count": 20,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 3
    },
    "desc": "伐薪线收集 20 件、伐薪技能精通总级数达满分 80%（按动作次数涨） → 背包格数 +3"
  },
  {
    "id": "wood92",
    "path": "wood",
    "ring": 9,
    "name": "伐薪·历劫谱",
    "icon": "🪓",
    "iconItem": "voidWood",
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "count": 20,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "bankCap",
      "amount": 4
    },
    "desc": "伐薪线收集 20 件、伐薪技能精通总级数达满分 80%（按动作次数涨） → 厨藏格数 +4"
  },
  {
    "id": "wood93",
    "path": "wood",
    "ring": 9,
    "name": "伐薪·历劫典",
    "icon": "🪓",
    "iconItem": "voidWood",
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "count": 20,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "伐薪线收集 20 件、伐薪技能精通总级数达满分 80%（按动作次数涨） → 冷库格数 +1"
  },
  {
    "id": "wood94",
    "path": "wood",
    "ring": 9,
    "name": "伐薪·历劫章",
    "icon": "🪓",
    "iconItem": "primalWood",
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "count": 20,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "bankCap",
      "amount": 3
    },
    "desc": "伐薪线收集 20 件、伐薪技能精通总级数达满分 80%（按动作次数涨） → 厨藏格数 +3"
  },
  {
    "id": "wood95",
    "path": "wood",
    "ring": 9,
    "name": "伐薪·历劫卷",
    "icon": "🪓",
    "iconItem": "primalWood",
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "count": 20,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "伐薪线收集 20 件、伐薪技能精通总级数达满分 80%（按动作次数涨） → 背包格数 +2"
  },
  {
    "id": "wood101",
    "path": "wood",
    "ring": 10,
    "name": "伐薪·悟道录",
    "icon": "🌿",
    "iconItem": "late_wood_01",
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "count": 20,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 3
    },
    "desc": "伐薪线收集 20 件、伐薪技能精通总级数达满分 100%（按动作次数涨） → 背包格数 +3"
  },
  {
    "id": "wood102",
    "path": "wood",
    "ring": 10,
    "name": "伐薪·悟道谱",
    "icon": "🌿",
    "iconItem": "late_wood_01",
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "count": 20,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "bankCap",
      "amount": 5
    },
    "desc": "伐薪线收集 20 件、伐薪技能精通总级数达满分 100%（按动作次数涨） → 厨藏格数 +5"
  },
  {
    "id": "wood103",
    "path": "wood",
    "ring": 10,
    "name": "伐薪·悟道典",
    "icon": "🌿",
    "iconItem": "late_wood_01",
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "count": 20,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 2
    },
    "desc": "伐薪线收集 20 件、伐薪技能精通总级数达满分 100%（按动作次数涨） → 冷库格数 +2"
  },
  {
    "id": "wood104",
    "path": "wood",
    "ring": 10,
    "name": "伐薪·悟道章",
    "icon": "🌿",
    "iconItem": "late_wood_01",
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "count": 20,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "bankCap",
      "amount": 3
    },
    "desc": "伐薪线收集 20 件、伐薪技能精通总级数达满分 100%（按动作次数涨） → 厨藏格数 +3"
  },
  {
    "id": "wood105",
    "path": "wood",
    "ring": 10,
    "name": "伐薪·悟道卷",
    "icon": "🌿",
    "iconItem": "late_wood_02",
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "count": 20,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "伐薪线收集 20 件、伐薪技能精通总级数达满分 100%（按动作次数涨） → 背包格数 +2"
  },
  {
    "id": "ore11",
    "path": "ore",
    "ring": 1,
    "name": "矿脉·初识录",
    "icon": "⛏️",
    "iconItem": "ironOre",
    "req": {
      "kind": "codex",
      "skill": "mining",
      "count": 3,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "矿脉线收集 3 件 → 背包格数 +1"
  },
  {
    "id": "ore12",
    "path": "ore",
    "ring": 1,
    "name": "矿脉·初识谱",
    "icon": "⛏️",
    "iconItem": "saltOre",
    "req": {
      "kind": "codex",
      "skill": "mining",
      "count": 3,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "矿脉线收集 3 件 → 背包格数 +1"
  },
  {
    "id": "ore13",
    "path": "ore",
    "ring": 1,
    "name": "矿脉·初识典",
    "icon": "⛏️",
    "iconItem": "saltOre",
    "req": {
      "kind": "codex",
      "skill": "mining",
      "count": 3,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "矿脉线收集 3 件 → 背包格数 +1"
  },
  {
    "id": "ore21",
    "path": "ore",
    "ring": 2,
    "name": "矿脉·渐熟录",
    "icon": "🪨",
    "iconItem": "mithrilOre",
    "req": {
      "kind": "codex",
      "skill": "mining",
      "count": 7,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "矿脉线收集 7 件 → 背包格数 +1"
  },
  {
    "id": "ore22",
    "path": "ore",
    "ring": 2,
    "name": "矿脉·渐熟谱",
    "icon": "🪨",
    "iconItem": "mithrilOre",
    "req": {
      "kind": "codex",
      "skill": "mining",
      "count": 7,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "矿脉线收集 7 件 → 背包格数 +1"
  },
  {
    "id": "ore23",
    "path": "ore",
    "ring": 2,
    "name": "矿脉·渐熟典",
    "icon": "🪨",
    "iconItem": "goldOre",
    "req": {
      "kind": "codex",
      "skill": "mining",
      "count": 7,
      "level": 0
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "矿脉线收集 7 件 → 背包格数 +1"
  },
  {
    "id": "ore31",
    "path": "ore",
    "ring": 3,
    "name": "矿脉·通晓录",
    "icon": "💎",
    "iconItem": "excavation_ext2_14",
    "req": {
      "kind": "codex",
      "skill": "mining",
      "count": 14,
      "level": 0
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "矿脉线收集 14 件 → 厨藏格数 +1"
  },
  {
    "id": "ore32",
    "path": "ore",
    "ring": 3,
    "name": "矿脉·通晓谱",
    "icon": "💎",
    "iconItem": "darkIronOre",
    "req": {
      "kind": "codex",
      "skill": "mining",
      "count": 14,
      "level": 0
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "矿脉线收集 14 件 → 厨藏格数 +1"
  },
  {
    "id": "ore33",
    "path": "ore",
    "ring": 3,
    "name": "矿脉·通晓典",
    "icon": "💎",
    "iconItem": "darkIronOre",
    "req": {
      "kind": "codex",
      "skill": "mining",
      "count": 14,
      "level": 0
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "矿脉线收集 14 件 → 厨藏格数 +1"
  },
  {
    "id": "ore41",
    "path": "ore",
    "ring": 4,
    "name": "矿脉·精研录",
    "icon": "🔶",
    "iconItem": "excavation_ext2_17",
    "req": {
      "kind": "codex",
      "skill": "mining",
      "count": 23,
      "level": 20
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "矿脉线收集 23 件、矿脉技能达 20 级 → 厨藏格数 +1"
  },
  {
    "id": "ore42",
    "path": "ore",
    "ring": 4,
    "name": "矿脉·精研谱",
    "icon": "🔶",
    "iconItem": "meteoriteOre",
    "req": {
      "kind": "codex",
      "skill": "mining",
      "count": 23,
      "level": 20
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "矿脉线收集 23 件、矿脉技能达 20 级 → 厨藏格数 +1"
  },
  {
    "id": "ore43",
    "path": "ore",
    "ring": 4,
    "name": "矿脉·精研典",
    "icon": "🔶",
    "iconItem": "excavation_ext2_18",
    "req": {
      "kind": "codex",
      "skill": "mining",
      "count": 23,
      "level": 20
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "矿脉线收集 23 件、矿脉技能达 20 级 → 厨藏格数 +1"
  },
  {
    "id": "ore51",
    "path": "ore",
    "ring": 5,
    "name": "矿脉·大成录",
    "icon": "🔷",
    "iconItem": "excavation_ext2_20",
    "req": {
      "kind": "codex",
      "skill": "mining",
      "count": 32,
      "level": 45
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "矿脉线收集 32 件、矿脉技能达 45 级 → 厨藏格数 +1"
  },
  {
    "id": "ore52",
    "path": "ore",
    "ring": 5,
    "name": "矿脉·大成谱",
    "icon": "🔷",
    "iconItem": "dragonScaleOre",
    "req": {
      "kind": "codex",
      "skill": "mining",
      "count": 32,
      "level": 45
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "矿脉线收集 32 件、矿脉技能达 45 级 → 厨藏格数 +1"
  },
  {
    "id": "ore53",
    "path": "ore",
    "ring": 5,
    "name": "矿脉·大成典",
    "icon": "🔷",
    "iconItem": "excavation_ext2_21",
    "req": {
      "kind": "codex",
      "skill": "mining",
      "count": 32,
      "level": 45
    },
    "effect": {
      "field": "bankCap",
      "amount": 1
    },
    "desc": "矿脉线收集 32 件、矿脉技能达 45 级 → 厨藏格数 +1"
  },
  {
    "id": "ore61",
    "path": "ore",
    "ring": 6,
    "name": "矿脉·化境录",
    "icon": "🧱",
    "iconItem": "glassOre",
    "req": {
      "kind": "codex",
      "skill": "mining",
      "count": 41,
      "level": 75
    },
    "effect": {
      "field": "offlineH",
      "amount": 1
    },
    "desc": "矿脉线收集 41 件、矿脉技能达 75 级 → 离线收益时长上限 +1 小时"
  },
  {
    "id": "ore62",
    "path": "ore",
    "ring": 6,
    "name": "矿脉·化境谱",
    "icon": "🧱",
    "iconItem": "excavation_ext2_23",
    "req": {
      "kind": "codex",
      "skill": "mining",
      "count": 41,
      "level": 75
    },
    "effect": {
      "field": "flatYield",
      "amount": 1
    },
    "desc": "矿脉线收集 41 件、矿脉技能达 75 级 → 矿脉每次动作额外 +1 件"
  },
  {
    "id": "ore63",
    "path": "ore",
    "ring": 6,
    "name": "矿脉·化境典",
    "icon": "🧱",
    "iconItem": "excavation_ext2_23",
    "req": {
      "kind": "codex",
      "skill": "mining",
      "count": 41,
      "level": 75
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "矿脉线收集 41 件、矿脉技能达 75 级 → 冷库格数 +1"
  },
  {
    "id": "ore64",
    "path": "ore",
    "ring": 6,
    "name": "矿脉·化境章",
    "icon": "🧱",
    "iconItem": "excavation_ext_23",
    "req": {
      "kind": "codex",
      "skill": "mining",
      "count": 41,
      "level": 75
    },
    "effect": {
      "field": "bankCap",
      "amount": 2
    },
    "desc": "矿脉线收集 41 件、矿脉技能达 75 级 → 厨藏格数 +2"
  },
  {
    "id": "ore65",
    "path": "ore",
    "ring": 6,
    "name": "矿脉·化境卷",
    "icon": "🧱",
    "iconItem": "giltOre",
    "req": {
      "kind": "codex",
      "skill": "mining",
      "count": 41,
      "level": 75
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "矿脉线收集 41 件、矿脉技能达 75 级 → 背包格数 +1"
  },
  {
    "id": "ore71",
    "path": "ore",
    "ring": 7,
    "name": "矿脉·圆满录",
    "icon": "⛰️",
    "iconItem": "excavation_ext2_24",
    "req": {
      "kind": "codex",
      "skill": "mining",
      "count": 41,
      "level": 100
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "矿脉线收集 41 件、矿脉技能达 100 级 → 背包格数 +2"
  },
  {
    "id": "ore72",
    "path": "ore",
    "ring": 7,
    "name": "矿脉·圆满谱",
    "icon": "⛰️",
    "iconItem": "excavation_ext_24",
    "req": {
      "kind": "codex",
      "skill": "mining",
      "count": 41,
      "level": 100
    },
    "effect": {
      "field": "flatYield",
      "amount": 1
    },
    "desc": "矿脉线收集 41 件、矿脉技能达 100 级 → 矿脉每次动作额外 +1 件"
  },
  {
    "id": "ore73",
    "path": "ore",
    "ring": 7,
    "name": "矿脉·圆满典",
    "icon": "⛰️",
    "iconItem": "excavation_ext2_25",
    "req": {
      "kind": "codex",
      "skill": "mining",
      "count": 41,
      "level": 100
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "矿脉线收集 41 件、矿脉技能达 100 级 → 冷库格数 +1"
  },
  {
    "id": "ore74",
    "path": "ore",
    "ring": 7,
    "name": "矿脉·圆满章",
    "icon": "⛰️",
    "iconItem": "excavation_ext2_25",
    "req": {
      "kind": "codex",
      "skill": "mining",
      "count": 41,
      "level": 100
    },
    "effect": {
      "field": "bankCap",
      "amount": 2
    },
    "desc": "矿脉线收集 41 件、矿脉技能达 100 级 → 厨藏格数 +2"
  },
  {
    "id": "ore75",
    "path": "ore",
    "ring": 7,
    "name": "矿脉·圆满卷",
    "icon": "⛰️",
    "iconItem": "excavation_ext_25",
    "req": {
      "kind": "codex",
      "skill": "mining",
      "count": 41,
      "level": 100
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "矿脉线收集 41 件、矿脉技能达 100 级 → 背包格数 +1"
  },
  {
    "id": "ore81",
    "path": "ore",
    "ring": 8,
    "name": "矿脉·轮回录",
    "icon": "🪙",
    "iconItem": "excavation_ext2_26",
    "req": {
      "kind": "codex",
      "skill": "mining",
      "count": 41,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "矿脉线收集 41 件、矿脉技能精通总级数达满分 60%（按动作次数涨） → 背包格数 +2"
  },
  {
    "id": "ore82",
    "path": "ore",
    "ring": 8,
    "name": "矿脉·轮回谱",
    "icon": "🪙",
    "iconItem": "excavation_ext_26",
    "req": {
      "kind": "codex",
      "skill": "mining",
      "count": 41,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "bankCap",
      "amount": 3
    },
    "desc": "矿脉线收集 41 件、矿脉技能精通总级数达满分 60%（按动作次数涨） → 厨藏格数 +3"
  },
  {
    "id": "ore83",
    "path": "ore",
    "ring": 8,
    "name": "矿脉·轮回典",
    "icon": "🪙",
    "iconItem": "excavation_ext2_27",
    "req": {
      "kind": "codex",
      "skill": "mining",
      "count": 41,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "矿脉线收集 41 件、矿脉技能精通总级数达满分 60%（按动作次数涨） → 冷库格数 +1"
  },
  {
    "id": "ore84",
    "path": "ore",
    "ring": 8,
    "name": "矿脉·轮回章",
    "icon": "🪙",
    "iconItem": "excavation_ext2_27",
    "req": {
      "kind": "codex",
      "skill": "mining",
      "count": 41,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "bankCap",
      "amount": 2
    },
    "desc": "矿脉线收集 41 件、矿脉技能精通总级数达满分 60%（按动作次数涨） → 厨藏格数 +2"
  },
  {
    "id": "ore85",
    "path": "ore",
    "ring": 8,
    "name": "矿脉·轮回卷",
    "icon": "🪙",
    "iconItem": "excavation_ext_27",
    "req": {
      "kind": "codex",
      "skill": "mining",
      "count": 41,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 1
    },
    "desc": "矿脉线收集 41 件、矿脉技能精通总级数达满分 60%（按动作次数涨） → 背包格数 +1"
  },
  {
    "id": "ore91",
    "path": "ore",
    "ring": 9,
    "name": "矿脉·历劫录",
    "icon": "🗿",
    "iconItem": "excavation_ext2_28",
    "req": {
      "kind": "codex",
      "skill": "mining",
      "count": 41,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 3
    },
    "desc": "矿脉线收集 41 件、矿脉技能精通总级数达满分 80%（按动作次数涨） → 背包格数 +3"
  },
  {
    "id": "ore92",
    "path": "ore",
    "ring": 9,
    "name": "矿脉·历劫谱",
    "icon": "🗿",
    "iconItem": "excavation_ext_28",
    "req": {
      "kind": "codex",
      "skill": "mining",
      "count": 41,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "bankCap",
      "amount": 4
    },
    "desc": "矿脉线收集 41 件、矿脉技能精通总级数达满分 80%（按动作次数涨） → 厨藏格数 +4"
  },
  {
    "id": "ore93",
    "path": "ore",
    "ring": 9,
    "name": "矿脉·历劫典",
    "icon": "🗿",
    "iconItem": "excavation_ext2_29",
    "req": {
      "kind": "codex",
      "skill": "mining",
      "count": 41,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 1
    },
    "desc": "矿脉线收集 41 件、矿脉技能精通总级数达满分 80%（按动作次数涨） → 冷库格数 +1"
  },
  {
    "id": "ore94",
    "path": "ore",
    "ring": 9,
    "name": "矿脉·历劫章",
    "icon": "🗿",
    "iconItem": "excavation_ext2_29",
    "req": {
      "kind": "codex",
      "skill": "mining",
      "count": 41,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "bankCap",
      "amount": 3
    },
    "desc": "矿脉线收集 41 件、矿脉技能精通总级数达满分 80%（按动作次数涨） → 厨藏格数 +3"
  },
  {
    "id": "ore95",
    "path": "ore",
    "ring": 9,
    "name": "矿脉·历劫卷",
    "icon": "🗿",
    "iconItem": "excavation_ext_29",
    "req": {
      "kind": "codex",
      "skill": "mining",
      "count": 41,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "矿脉线收集 41 件、矿脉技能精通总级数达满分 80%（按动作次数涨） → 背包格数 +2"
  },
  {
    "id": "ore101",
    "path": "ore",
    "ring": 10,
    "name": "矿脉·悟道录",
    "icon": "💠",
    "iconItem": "excavation_ext2_30",
    "req": {
      "kind": "codex",
      "skill": "mining",
      "count": 41,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 3
    },
    "desc": "矿脉线收集 41 件、矿脉技能精通总级数达满分 100%（按动作次数涨） → 背包格数 +3"
  },
  {
    "id": "ore102",
    "path": "ore",
    "ring": 10,
    "name": "矿脉·悟道谱",
    "icon": "💠",
    "iconItem": "excavation_ext_30",
    "req": {
      "kind": "codex",
      "skill": "mining",
      "count": 41,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "bankCap",
      "amount": 5
    },
    "desc": "矿脉线收集 41 件、矿脉技能精通总级数达满分 100%（按动作次数涨） → 厨藏格数 +5"
  },
  {
    "id": "ore103",
    "path": "ore",
    "ring": 10,
    "name": "矿脉·悟道典",
    "icon": "💠",
    "iconItem": "excavation_ext_30",
    "req": {
      "kind": "codex",
      "skill": "mining",
      "count": 41,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "coldStorageCap",
      "amount": 2
    },
    "desc": "矿脉线收集 41 件、矿脉技能精通总级数达满分 100%（按动作次数涨） → 冷库格数 +2"
  },
  {
    "id": "ore104",
    "path": "ore",
    "ring": 10,
    "name": "矿脉·悟道章",
    "icon": "💠",
    "iconItem": "late_min_01",
    "req": {
      "kind": "codex",
      "skill": "mining",
      "count": 41,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "bankCap",
      "amount": 3
    },
    "desc": "矿脉线收集 41 件、矿脉技能精通总级数达满分 100%（按动作次数涨） → 厨藏格数 +3"
  },
  {
    "id": "ore105",
    "path": "ore",
    "ring": 10,
    "name": "矿脉·悟道卷",
    "icon": "💠",
    "iconItem": "late_min_02",
    "req": {
      "kind": "codex",
      "skill": "mining",
      "count": 41,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "inventoryCap",
      "amount": 2
    },
    "desc": "矿脉线收集 41 件、矿脉技能精通总级数达满分 100%（按动作次数涨） → 背包格数 +2"
  },
  {
    "id": "gap0_6",
    "path": "gap0",
    "ring": 6,
    "gap": 0,
    "name": "采撷·渔获·汇金化境",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "skill2": "fishing",
      "count": 212,
      "level": 75
    },
    "effect": {
      "field": "gold",
      "amount": 6000
    },
    "desc": "采撷线与渔获线合计收集 212 件、两条线技能均达 75 级 → 金币 +6,000"
  },
  {
    "id": "gap0_7",
    "path": "gap0",
    "ring": 7,
    "gap": 0,
    "name": "采撷·渔获·汇金圆满",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "skill2": "fishing",
      "count": 212,
      "level": 100
    },
    "effect": {
      "field": "gold",
      "amount": 18000
    },
    "desc": "采撷线与渔获线合计收集 212 件、两条线技能均达 100 级 → 金币 +18,000"
  },
  {
    "id": "gap0_8",
    "path": "gap0",
    "ring": 8,
    "gap": 0,
    "name": "采撷·渔获·汇金轮回",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "skill2": "fishing",
      "count": 212,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "gold",
      "amount": 48000
    },
    "desc": "采撷线与渔获线合计收集 212 件、两条线技能精通总级数均达满分 60%（按动作次数涨） → 金币 +48,000"
  },
  {
    "id": "gap0_9",
    "path": "gap0",
    "ring": 9,
    "gap": 0,
    "name": "采撷·渔获·汇金历劫",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "skill2": "fishing",
      "count": 212,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "gold",
      "amount": 120000
    },
    "desc": "采撷线与渔获线合计收集 212 件、两条线技能精通总级数均达满分 80%（按动作次数涨） → 金币 +120,000"
  },
  {
    "id": "gap0_10",
    "path": "gap0",
    "ring": 10,
    "gap": 0,
    "name": "采撷·渔获·汇金悟道",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "foraging",
      "skill2": "fishing",
      "count": 212,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "gold",
      "amount": 300000
    },
    "desc": "采撷线与渔获线合计收集 212 件、两条线技能精通总级数均达满分 100%（按动作次数涨） → 金币 +300,000"
  },
  {
    "id": "gap1_6",
    "path": "gap1",
    "ring": 6,
    "gap": 1,
    "name": "渔获·山猎·汇金化境",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "skill2": "hunting",
      "count": 147,
      "level": 75
    },
    "effect": {
      "field": "gold",
      "amount": 6000
    },
    "desc": "渔获线与山猎线合计收集 147 件、两条线技能均达 75 级 → 金币 +6,000"
  },
  {
    "id": "gap1_7",
    "path": "gap1",
    "ring": 7,
    "gap": 1,
    "name": "渔获·山猎·汇金圆满",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "skill2": "hunting",
      "count": 147,
      "level": 100
    },
    "effect": {
      "field": "gold",
      "amount": 18000
    },
    "desc": "渔获线与山猎线合计收集 147 件、两条线技能均达 100 级 → 金币 +18,000"
  },
  {
    "id": "gap1_8",
    "path": "gap1",
    "ring": 8,
    "gap": 1,
    "name": "渔获·山猎·汇金轮回",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "skill2": "hunting",
      "count": 147,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "gold",
      "amount": 48000
    },
    "desc": "渔获线与山猎线合计收集 147 件、两条线技能精通总级数均达满分 60%（按动作次数涨） → 金币 +48,000"
  },
  {
    "id": "gap1_9",
    "path": "gap1",
    "ring": 9,
    "gap": 1,
    "name": "渔获·山猎·汇金历劫",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "skill2": "hunting",
      "count": 147,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "gold",
      "amount": 120000
    },
    "desc": "渔获线与山猎线合计收集 147 件、两条线技能精通总级数均达满分 80%（按动作次数涨） → 金币 +120,000"
  },
  {
    "id": "gap1_10",
    "path": "gap1",
    "ring": 10,
    "gap": 1,
    "name": "渔获·山猎·汇金悟道",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "fishing",
      "skill2": "hunting",
      "count": 147,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "gold",
      "amount": 300000
    },
    "desc": "渔获线与山猎线合计收集 147 件、两条线技能精通总级数均达满分 100%（按动作次数涨） → 金币 +300,000"
  },
  {
    "id": "gap2_6",
    "path": "gap2",
    "ring": 6,
    "gap": 2,
    "name": "山猎·掘藏·汇金化境",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "skill2": "excavation",
      "count": 125,
      "level": 75
    },
    "effect": {
      "field": "gold",
      "amount": 6000
    },
    "desc": "山猎线与掘藏线合计收集 125 件、两条线技能均达 75 级 → 金币 +6,000"
  },
  {
    "id": "gap2_7",
    "path": "gap2",
    "ring": 7,
    "gap": 2,
    "name": "山猎·掘藏·汇金圆满",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "skill2": "excavation",
      "count": 125,
      "level": 100
    },
    "effect": {
      "field": "gold",
      "amount": 18000
    },
    "desc": "山猎线与掘藏线合计收集 125 件、两条线技能均达 100 级 → 金币 +18,000"
  },
  {
    "id": "gap2_8",
    "path": "gap2",
    "ring": 8,
    "gap": 2,
    "name": "山猎·掘藏·汇金轮回",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "skill2": "excavation",
      "count": 125,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "gold",
      "amount": 48000
    },
    "desc": "山猎线与掘藏线合计收集 125 件、两条线技能精通总级数均达满分 60%（按动作次数涨） → 金币 +48,000"
  },
  {
    "id": "gap2_9",
    "path": "gap2",
    "ring": 9,
    "gap": 2,
    "name": "山猎·掘藏·汇金历劫",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "skill2": "excavation",
      "count": 125,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "gold",
      "amount": 120000
    },
    "desc": "山猎线与掘藏线合计收集 125 件、两条线技能精通总级数均达满分 80%（按动作次数涨） → 金币 +120,000"
  },
  {
    "id": "gap2_10",
    "path": "gap2",
    "ring": 10,
    "gap": 2,
    "name": "山猎·掘藏·汇金悟道",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "hunting",
      "skill2": "excavation",
      "count": 125,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "gold",
      "amount": 300000
    },
    "desc": "山猎线与掘藏线合计收集 125 件、两条线技能精通总级数均达满分 100%（按动作次数涨） → 金币 +300,000"
  },
  {
    "id": "gap3_6",
    "path": "gap3",
    "ring": 6,
    "gap": 3,
    "name": "掘藏·稼穑·汇金化境",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "skill2": "farming",
      "count": 238,
      "level": 75
    },
    "effect": {
      "field": "gold",
      "amount": 6000
    },
    "desc": "掘藏线与稼穑线合计收集 238 件、两条线技能均达 75 级 → 金币 +6,000"
  },
  {
    "id": "gap3_7",
    "path": "gap3",
    "ring": 7,
    "gap": 3,
    "name": "掘藏·稼穑·汇金圆满",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "skill2": "farming",
      "count": 238,
      "level": 100
    },
    "effect": {
      "field": "gold",
      "amount": 18000
    },
    "desc": "掘藏线与稼穑线合计收集 238 件、两条线技能均达 100 级 → 金币 +18,000"
  },
  {
    "id": "gap3_8",
    "path": "gap3",
    "ring": 8,
    "gap": 3,
    "name": "掘藏·稼穑·汇金轮回",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "skill2": "farming",
      "count": 238,
      "level": 0,
      "masteryPct": 0.3
    },
    "effect": {
      "field": "gold",
      "amount": 48000
    },
    "desc": "掘藏线与稼穑线合计收集 238 件、两条线技能精通总级数均达满分 30%（按动作次数涨） → 金币 +48,000"
  },
  {
    "id": "gap3_9",
    "path": "gap3",
    "ring": 9,
    "gap": 3,
    "name": "掘藏·稼穑·汇金历劫",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "skill2": "farming",
      "count": 238,
      "level": 0,
      "masteryPct": 0.4
    },
    "effect": {
      "field": "gold",
      "amount": 120000
    },
    "desc": "掘藏线与稼穑线合计收集 238 件、两条线技能精通总级数均达满分 40%（按动作次数涨） → 金币 +120,000"
  },
  {
    "id": "gap3_10",
    "path": "gap3",
    "ring": 10,
    "gap": 3,
    "name": "掘藏·稼穑·汇金悟道",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "excavation",
      "skill2": "farming",
      "count": 238,
      "level": 0,
      "masteryPct": 0.5
    },
    "effect": {
      "field": "gold",
      "amount": 300000
    },
    "desc": "掘藏线与稼穑线合计收集 238 件、两条线技能精通总级数均达满分 50%（按动作次数涨） → 金币 +300,000"
  },
  {
    "id": "gap4_6",
    "path": "gap4",
    "ring": 6,
    "gap": 4,
    "name": "稼穑·烹煮·汇金化境",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "farming",
      "skill2": "cooking",
      "count": 460,
      "level": 75
    },
    "effect": {
      "field": "gold",
      "amount": 6000
    },
    "desc": "稼穑线与烹煮线合计收集 460 件、两条线技能均达 75 级 → 金币 +6,000"
  },
  {
    "id": "gap4_7",
    "path": "gap4",
    "ring": 7,
    "gap": 4,
    "name": "稼穑·烹煮·汇金圆满",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "farming",
      "skill2": "cooking",
      "count": 460,
      "level": 100
    },
    "effect": {
      "field": "gold",
      "amount": 18000
    },
    "desc": "稼穑线与烹煮线合计收集 460 件、两条线技能均达 100 级 → 金币 +18,000"
  },
  {
    "id": "gap4_8",
    "path": "gap4",
    "ring": 8,
    "gap": 4,
    "name": "稼穑·烹煮·汇金轮回",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "farming",
      "skill2": "cooking",
      "count": 460,
      "level": 0,
      "masteryPct": 0.3
    },
    "effect": {
      "field": "gold",
      "amount": 48000
    },
    "desc": "稼穑线与烹煮线合计收集 460 件、两条线技能精通总级数均达满分 30%（按动作次数涨） → 金币 +48,000"
  },
  {
    "id": "gap4_9",
    "path": "gap4",
    "ring": 9,
    "gap": 4,
    "name": "稼穑·烹煮·汇金历劫",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "farming",
      "skill2": "cooking",
      "count": 460,
      "level": 0,
      "masteryPct": 0.4
    },
    "effect": {
      "field": "gold",
      "amount": 120000
    },
    "desc": "稼穑线与烹煮线合计收集 460 件、两条线技能精通总级数均达满分 40%（按动作次数涨） → 金币 +120,000"
  },
  {
    "id": "gap4_10",
    "path": "gap4",
    "ring": 10,
    "gap": 4,
    "name": "稼穑·烹煮·汇金悟道",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "farming",
      "skill2": "cooking",
      "count": 460,
      "level": 0,
      "masteryPct": 0.5
    },
    "effect": {
      "field": "gold",
      "amount": 300000
    },
    "desc": "稼穑线与烹煮线合计收集 460 件、两条线技能精通总级数均达满分 50%（按动作次数涨） → 金币 +300,000"
  },
  {
    "id": "gap5_6",
    "path": "gap5",
    "ring": 6,
    "gap": 5,
    "name": "烹煮·烘焙·汇金化境",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "skill2": "baking",
      "count": 367,
      "level": 75
    },
    "effect": {
      "field": "gold",
      "amount": 6000
    },
    "desc": "烹煮线与烘焙线合计收集 367 件、两条线技能均达 75 级 → 金币 +6,000"
  },
  {
    "id": "gap5_7",
    "path": "gap5",
    "ring": 7,
    "gap": 5,
    "name": "烹煮·烘焙·汇金圆满",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "skill2": "baking",
      "count": 367,
      "level": 100
    },
    "effect": {
      "field": "gold",
      "amount": 18000
    },
    "desc": "烹煮线与烘焙线合计收集 367 件、两条线技能均达 100 级 → 金币 +18,000"
  },
  {
    "id": "gap5_8",
    "path": "gap5",
    "ring": 8,
    "gap": 5,
    "name": "烹煮·烘焙·汇金轮回",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "skill2": "baking",
      "count": 367,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "gold",
      "amount": 48000
    },
    "desc": "烹煮线与烘焙线合计收集 367 件、两条线技能精通总级数均达满分 60%（按动作次数涨） → 金币 +48,000"
  },
  {
    "id": "gap5_9",
    "path": "gap5",
    "ring": 9,
    "gap": 5,
    "name": "烹煮·烘焙·汇金历劫",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "skill2": "baking",
      "count": 367,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "gold",
      "amount": 120000
    },
    "desc": "烹煮线与烘焙线合计收集 367 件、两条线技能精通总级数均达满分 80%（按动作次数涨） → 金币 +120,000"
  },
  {
    "id": "gap5_10",
    "path": "gap5",
    "ring": 10,
    "gap": 5,
    "name": "烹煮·烘焙·汇金悟道",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "cooking",
      "skill2": "baking",
      "count": 367,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "gold",
      "amount": 300000
    },
    "desc": "烹煮线与烘焙线合计收集 367 件、两条线技能精通总级数均达满分 100%（按动作次数涨） → 金币 +300,000"
  },
  {
    "id": "gap6_6",
    "path": "gap6",
    "ring": 6,
    "gap": 6,
    "name": "烘焙·酿造·汇金化境",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "baking",
      "skill2": "brewing",
      "count": 211,
      "level": 75
    },
    "effect": {
      "field": "gold",
      "amount": 6000
    },
    "desc": "烘焙线与酿造线合计收集 211 件、两条线技能均达 75 级 → 金币 +6,000"
  },
  {
    "id": "gap6_7",
    "path": "gap6",
    "ring": 7,
    "gap": 6,
    "name": "烘焙·酿造·汇金圆满",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "baking",
      "skill2": "brewing",
      "count": 211,
      "level": 100
    },
    "effect": {
      "field": "gold",
      "amount": 18000
    },
    "desc": "烘焙线与酿造线合计收集 211 件、两条线技能均达 100 级 → 金币 +18,000"
  },
  {
    "id": "gap6_8",
    "path": "gap6",
    "ring": 8,
    "gap": 6,
    "name": "烘焙·酿造·汇金轮回",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "baking",
      "skill2": "brewing",
      "count": 211,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "gold",
      "amount": 48000
    },
    "desc": "烘焙线与酿造线合计收集 211 件、两条线技能精通总级数均达满分 60%（按动作次数涨） → 金币 +48,000"
  },
  {
    "id": "gap6_9",
    "path": "gap6",
    "ring": 9,
    "gap": 6,
    "name": "烘焙·酿造·汇金历劫",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "baking",
      "skill2": "brewing",
      "count": 211,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "gold",
      "amount": 120000
    },
    "desc": "烘焙线与酿造线合计收集 211 件、两条线技能精通总级数均达满分 80%（按动作次数涨） → 金币 +120,000"
  },
  {
    "id": "gap6_10",
    "path": "gap6",
    "ring": 10,
    "gap": 6,
    "name": "烘焙·酿造·汇金悟道",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "baking",
      "skill2": "brewing",
      "count": 211,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "gold",
      "amount": 300000
    },
    "desc": "烘焙线与酿造线合计收集 211 件、两条线技能精通总级数均达满分 100%（按动作次数涨） → 金币 +300,000"
  },
  {
    "id": "gap7_6",
    "path": "gap7",
    "ring": 6,
    "gap": 7,
    "name": "酿造·调味·汇金化境",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "skill2": "spiceMixing",
      "count": 209,
      "level": 75
    },
    "effect": {
      "field": "gold",
      "amount": 6000
    },
    "desc": "酿造线与调味线合计收集 209 件、两条线技能均达 75 级 → 金币 +6,000"
  },
  {
    "id": "gap7_7",
    "path": "gap7",
    "ring": 7,
    "gap": 7,
    "name": "酿造·调味·汇金圆满",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "skill2": "spiceMixing",
      "count": 209,
      "level": 100
    },
    "effect": {
      "field": "gold",
      "amount": 18000
    },
    "desc": "酿造线与调味线合计收集 209 件、两条线技能均达 100 级 → 金币 +18,000"
  },
  {
    "id": "gap7_8",
    "path": "gap7",
    "ring": 8,
    "gap": 7,
    "name": "酿造·调味·汇金轮回",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "skill2": "spiceMixing",
      "count": 209,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "gold",
      "amount": 48000
    },
    "desc": "酿造线与调味线合计收集 209 件、两条线技能精通总级数均达满分 60%（按动作次数涨） → 金币 +48,000"
  },
  {
    "id": "gap7_9",
    "path": "gap7",
    "ring": 9,
    "gap": 7,
    "name": "酿造·调味·汇金历劫",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "skill2": "spiceMixing",
      "count": 209,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "gold",
      "amount": 120000
    },
    "desc": "酿造线与调味线合计收集 209 件、两条线技能精通总级数均达满分 80%（按动作次数涨） → 金币 +120,000"
  },
  {
    "id": "gap7_10",
    "path": "gap7",
    "ring": 10,
    "gap": 7,
    "name": "酿造·调味·汇金悟道",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "brewing",
      "skill2": "spiceMixing",
      "count": 209,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "gold",
      "amount": 300000
    },
    "desc": "酿造线与调味线合计收集 209 件、两条线技能精通总级数均达满分 100%（按动作次数涨） → 金币 +300,000"
  },
  {
    "id": "gap8_6",
    "path": "gap8",
    "ring": 6,
    "gap": 8,
    "name": "调味·锻造·汇金化境",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "skill2": "craftsmithing",
      "count": 433,
      "level": 75
    },
    "effect": {
      "field": "gold",
      "amount": 6000
    },
    "desc": "调味线与锻造线合计收集 433 件、两条线技能均达 75 级 → 金币 +6,000"
  },
  {
    "id": "gap8_7",
    "path": "gap8",
    "ring": 7,
    "gap": 8,
    "name": "调味·锻造·汇金圆满",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "skill2": "craftsmithing",
      "count": 433,
      "level": 100
    },
    "effect": {
      "field": "gold",
      "amount": 18000
    },
    "desc": "调味线与锻造线合计收集 433 件、两条线技能均达 100 级 → 金币 +18,000"
  },
  {
    "id": "gap8_8",
    "path": "gap8",
    "ring": 8,
    "gap": 8,
    "name": "调味·锻造·汇金轮回",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "skill2": "craftsmithing",
      "count": 433,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "gold",
      "amount": 48000
    },
    "desc": "调味线与锻造线合计收集 433 件、两条线技能精通总级数均达满分 60%（按动作次数涨） → 金币 +48,000"
  },
  {
    "id": "gap8_9",
    "path": "gap8",
    "ring": 9,
    "gap": 8,
    "name": "调味·锻造·汇金历劫",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "skill2": "craftsmithing",
      "count": 433,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "gold",
      "amount": 120000
    },
    "desc": "调味线与锻造线合计收集 433 件、两条线技能精通总级数均达满分 80%（按动作次数涨） → 金币 +120,000"
  },
  {
    "id": "gap8_10",
    "path": "gap8",
    "ring": 10,
    "gap": 8,
    "name": "调味·锻造·汇金悟道",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "spiceMixing",
      "skill2": "craftsmithing",
      "count": 433,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "gold",
      "amount": 300000
    },
    "desc": "调味线与锻造线合计收集 433 件、两条线技能精通总级数均达满分 100%（按动作次数涨） → 金币 +300,000"
  },
  {
    "id": "gap9_6",
    "path": "gap9",
    "ring": 6,
    "gap": 9,
    "name": "锻造·伐薪·汇金化境",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "skill2": "woodcutting",
      "count": 363,
      "level": 75
    },
    "effect": {
      "field": "gold",
      "amount": 6000
    },
    "desc": "锻造线与伐薪线合计收集 363 件、两条线技能均达 75 级 → 金币 +6,000"
  },
  {
    "id": "gap9_7",
    "path": "gap9",
    "ring": 7,
    "gap": 9,
    "name": "锻造·伐薪·汇金圆满",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "skill2": "woodcutting",
      "count": 363,
      "level": 100
    },
    "effect": {
      "field": "gold",
      "amount": 18000
    },
    "desc": "锻造线与伐薪线合计收集 363 件、两条线技能均达 100 级 → 金币 +18,000"
  },
  {
    "id": "gap9_8",
    "path": "gap9",
    "ring": 8,
    "gap": 9,
    "name": "锻造·伐薪·汇金轮回",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "skill2": "woodcutting",
      "count": 363,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "gold",
      "amount": 48000
    },
    "desc": "锻造线与伐薪线合计收集 363 件、两条线技能精通总级数均达满分 60%（按动作次数涨） → 金币 +48,000"
  },
  {
    "id": "gap9_9",
    "path": "gap9",
    "ring": 9,
    "gap": 9,
    "name": "锻造·伐薪·汇金历劫",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "skill2": "woodcutting",
      "count": 363,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "gold",
      "amount": 120000
    },
    "desc": "锻造线与伐薪线合计收集 363 件、两条线技能精通总级数均达满分 80%（按动作次数涨） → 金币 +120,000"
  },
  {
    "id": "gap9_10",
    "path": "gap9",
    "ring": 10,
    "gap": 9,
    "name": "锻造·伐薪·汇金悟道",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "craftsmithing",
      "skill2": "woodcutting",
      "count": 363,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "gold",
      "amount": 300000
    },
    "desc": "锻造线与伐薪线合计收集 363 件、两条线技能精通总级数均达满分 100%（按动作次数涨） → 金币 +300,000"
  },
  {
    "id": "gap10_6",
    "path": "gap10",
    "ring": 6,
    "gap": 10,
    "name": "伐薪·矿脉·汇金化境",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "skill2": "mining",
      "count": 61,
      "level": 75
    },
    "effect": {
      "field": "gold",
      "amount": 6000
    },
    "desc": "伐薪线与矿脉线合计收集 61 件、两条线技能均达 75 级 → 金币 +6,000"
  },
  {
    "id": "gap10_7",
    "path": "gap10",
    "ring": 7,
    "gap": 10,
    "name": "伐薪·矿脉·汇金圆满",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "skill2": "mining",
      "count": 61,
      "level": 100
    },
    "effect": {
      "field": "gold",
      "amount": 18000
    },
    "desc": "伐薪线与矿脉线合计收集 61 件、两条线技能均达 100 级 → 金币 +18,000"
  },
  {
    "id": "gap10_8",
    "path": "gap10",
    "ring": 8,
    "gap": 10,
    "name": "伐薪·矿脉·汇金轮回",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "skill2": "mining",
      "count": 61,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "gold",
      "amount": 48000
    },
    "desc": "伐薪线与矿脉线合计收集 61 件、两条线技能精通总级数均达满分 60%（按动作次数涨） → 金币 +48,000"
  },
  {
    "id": "gap10_9",
    "path": "gap10",
    "ring": 9,
    "gap": 10,
    "name": "伐薪·矿脉·汇金历劫",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "skill2": "mining",
      "count": 61,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "gold",
      "amount": 120000
    },
    "desc": "伐薪线与矿脉线合计收集 61 件、两条线技能精通总级数均达满分 80%（按动作次数涨） → 金币 +120,000"
  },
  {
    "id": "gap10_10",
    "path": "gap10",
    "ring": 10,
    "gap": 10,
    "name": "伐薪·矿脉·汇金悟道",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "woodcutting",
      "skill2": "mining",
      "count": 61,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "gold",
      "amount": 300000
    },
    "desc": "伐薪线与矿脉线合计收集 61 件、两条线技能精通总级数均达满分 100%（按动作次数涨） → 金币 +300,000"
  },
  {
    "id": "gap11_6",
    "path": "gap11",
    "ring": 6,
    "gap": 11,
    "name": "矿脉·采撷·汇金化境",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "mining",
      "skill2": "foraging",
      "count": 178,
      "level": 75
    },
    "effect": {
      "field": "gold",
      "amount": 6000
    },
    "desc": "矿脉线与采撷线合计收集 178 件、两条线技能均达 75 级 → 金币 +6,000"
  },
  {
    "id": "gap11_7",
    "path": "gap11",
    "ring": 7,
    "gap": 11,
    "name": "矿脉·采撷·汇金圆满",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "mining",
      "skill2": "foraging",
      "count": 178,
      "level": 100
    },
    "effect": {
      "field": "gold",
      "amount": 18000
    },
    "desc": "矿脉线与采撷线合计收集 178 件、两条线技能均达 100 级 → 金币 +18,000"
  },
  {
    "id": "gap11_8",
    "path": "gap11",
    "ring": 8,
    "gap": 11,
    "name": "矿脉·采撷·汇金轮回",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "mining",
      "skill2": "foraging",
      "count": 178,
      "level": 0,
      "masteryPct": 0.6
    },
    "effect": {
      "field": "gold",
      "amount": 48000
    },
    "desc": "矿脉线与采撷线合计收集 178 件、两条线技能精通总级数均达满分 60%（按动作次数涨） → 金币 +48,000"
  },
  {
    "id": "gap11_9",
    "path": "gap11",
    "ring": 9,
    "gap": 11,
    "name": "矿脉·采撷·汇金历劫",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "mining",
      "skill2": "foraging",
      "count": 178,
      "level": 0,
      "masteryPct": 0.8
    },
    "effect": {
      "field": "gold",
      "amount": 120000
    },
    "desc": "矿脉线与采撷线合计收集 178 件、两条线技能精通总级数均达满分 80%（按动作次数涨） → 金币 +120,000"
  },
  {
    "id": "gap11_10",
    "path": "gap11",
    "ring": 10,
    "gap": 11,
    "name": "矿脉·采撷·汇金悟道",
    "icon": "🪙",
    "iconItem": null,
    "req": {
      "kind": "codex",
      "skill": "mining",
      "skill2": "foraging",
      "count": 178,
      "level": 0,
      "masteryPct": 1
    },
    "effect": {
      "field": "gold",
      "amount": 300000
    },
    "desc": "矿脉线与采撷线合计收集 178 件、两条线技能精通总级数均达满分 100%（按动作次数涨） → 金币 +300,000"
  },
  {
    "id": "tk1",
    "path": "ticket",
    "ring": 11,
    "ticket": true,
    "group": "珍券环",
    "name": "采撷·珍券",
    "icon": "🎟️",
    "iconItem": null,
    "req": {
      "kind": "progress",
      "nodes": 45
    },
    "reward": {
      "tickets": 100
    },
    "desc": "已点亮 45 个节点 → 觅珍抽卡券 ×100（抽卡时优先抵扣金币）"
  },
  {
    "id": "tk2",
    "path": "ticket",
    "ring": 11,
    "ticket": true,
    "group": "珍券环",
    "name": "渔获·珍券",
    "icon": "🎟️",
    "iconItem": null,
    "req": {
      "kind": "progress",
      "nodes": 90
    },
    "reward": {
      "tickets": 100
    },
    "desc": "已点亮 90 个节点 → 觅珍抽卡券 ×100（抽卡时优先抵扣金币）"
  },
  {
    "id": "tk3",
    "path": "ticket",
    "ring": 11,
    "ticket": true,
    "group": "珍券环",
    "name": "山猎·珍券",
    "icon": "🎟️",
    "iconItem": null,
    "req": {
      "kind": "progress",
      "nodes": 135
    },
    "reward": {
      "tickets": 100
    },
    "desc": "已点亮 135 个节点 → 觅珍抽卡券 ×100（抽卡时优先抵扣金币）"
  },
  {
    "id": "tk4",
    "path": "ticket",
    "ring": 11,
    "ticket": true,
    "group": "珍券环",
    "name": "掘藏·珍券",
    "icon": "🎟️",
    "iconItem": null,
    "req": {
      "kind": "progress",
      "nodes": 180
    },
    "reward": {
      "tickets": 100
    },
    "desc": "已点亮 180 个节点 → 觅珍抽卡券 ×100（抽卡时优先抵扣金币）"
  },
  {
    "id": "tk5",
    "path": "ticket",
    "ring": 11,
    "ticket": true,
    "group": "珍券环",
    "name": "稼穑·珍券",
    "icon": "🎟️",
    "iconItem": null,
    "req": {
      "kind": "progress",
      "nodes": 225
    },
    "reward": {
      "tickets": 100
    },
    "desc": "已点亮 225 个节点 → 觅珍抽卡券 ×100（抽卡时优先抵扣金币）"
  },
  {
    "id": "tk6",
    "path": "ticket",
    "ring": 11,
    "ticket": true,
    "group": "珍券环",
    "name": "烹煮·珍券",
    "icon": "🎟️",
    "iconItem": null,
    "req": {
      "kind": "progress",
      "nodes": 270
    },
    "reward": {
      "tickets": 100
    },
    "desc": "已点亮 270 个节点 → 觅珍抽卡券 ×100（抽卡时优先抵扣金币）"
  },
  {
    "id": "tk7",
    "path": "ticket",
    "ring": 11,
    "ticket": true,
    "group": "珍券环",
    "name": "烘焙·珍券",
    "icon": "🎟️",
    "iconItem": null,
    "req": {
      "kind": "progress",
      "nodes": 315
    },
    "reward": {
      "tickets": 100
    },
    "desc": "已点亮 315 个节点 → 觅珍抽卡券 ×100（抽卡时优先抵扣金币）"
  },
  {
    "id": "tk8",
    "path": "ticket",
    "ring": 11,
    "ticket": true,
    "group": "珍券环",
    "name": "酿造·珍券",
    "icon": "🎟️",
    "iconItem": null,
    "req": {
      "kind": "progress",
      "nodes": 360
    },
    "reward": {
      "tickets": 100
    },
    "desc": "已点亮 360 个节点 → 觅珍抽卡券 ×100（抽卡时优先抵扣金币）"
  },
  {
    "id": "tk9",
    "path": "ticket",
    "ring": 11,
    "ticket": true,
    "group": "珍券环",
    "name": "调味·珍券",
    "icon": "🎟️",
    "iconItem": null,
    "req": {
      "kind": "progress",
      "nodes": 405
    },
    "reward": {
      "tickets": 100
    },
    "desc": "已点亮 405 个节点 → 觅珍抽卡券 ×100（抽卡时优先抵扣金币）"
  },
  {
    "id": "tk10",
    "path": "ticket",
    "ring": 11,
    "ticket": true,
    "group": "珍券环",
    "name": "锻造·珍券",
    "icon": "🎟️",
    "iconItem": null,
    "req": {
      "kind": "progress",
      "nodes": 450
    },
    "reward": {
      "tickets": 100
    },
    "desc": "已点亮 450 个节点 → 觅珍抽卡券 ×100（抽卡时优先抵扣金币）"
  },
  {
    "id": "tk11",
    "path": "ticket",
    "ring": 11,
    "ticket": true,
    "group": "珍券环",
    "name": "伐薪·珍券",
    "icon": "🎟️",
    "iconItem": null,
    "req": {
      "kind": "progress",
      "nodes": 495
    },
    "reward": {
      "tickets": 100
    },
    "desc": "已点亮 495 个节点 → 觅珍抽卡券 ×100（抽卡时优先抵扣金币）"
  },
  {
    "id": "tk12",
    "path": "ticket",
    "ring": 11,
    "ticket": true,
    "group": "珍券环",
    "name": "矿脉·珍券",
    "icon": "🎟️",
    "iconItem": null,
    "req": {
      "kind": "progress",
      "nodes": 540
    },
    "reward": {
      "tickets": 100
    },
    "desc": "已点亮 540 个节点 → 觅珍抽卡券 ×100（抽卡时优先抵扣金币）"
  }
]

/** 外圈「珍券环」的几何与门槛（画布布局与守卫用） */
export const SHANHAI_TICKET_RING = {"r":1980,"nodes":12,"name":"珍券环","gates":[45,90,135,180,225,270,315,360,405,450,495,540]}

/** 汇金链（空隙里的金币节点分组）：{ id, a, b, aName, bName, aSkill, bSkill, name, index } */
export const SHANHAI_GAPS = [
  {
    "id": "gap0",
    "a": "pick",
    "b": "fish",
    "aName": "采撷",
    "bName": "渔获",
    "aSkill": "foraging",
    "bSkill": "fishing",
    "name": "采撷·渔获",
    "index": 0
  },
  {
    "id": "gap1",
    "a": "fish",
    "b": "hunt",
    "aName": "渔获",
    "bName": "山猎",
    "aSkill": "fishing",
    "bSkill": "hunting",
    "name": "渔获·山猎",
    "index": 1
  },
  {
    "id": "gap2",
    "a": "hunt",
    "b": "dig",
    "aName": "山猎",
    "bName": "掘藏",
    "aSkill": "hunting",
    "bSkill": "excavation",
    "name": "山猎·掘藏",
    "index": 2
  },
  {
    "id": "gap3",
    "a": "dig",
    "b": "farm",
    "aName": "掘藏",
    "bName": "稼穑",
    "aSkill": "excavation",
    "bSkill": "farming",
    "name": "掘藏·稼穑",
    "index": 3
  },
  {
    "id": "gap4",
    "a": "farm",
    "b": "cook",
    "aName": "稼穑",
    "bName": "烹煮",
    "aSkill": "farming",
    "bSkill": "cooking",
    "name": "稼穑·烹煮",
    "index": 4
  },
  {
    "id": "gap5",
    "a": "cook",
    "b": "bake",
    "aName": "烹煮",
    "bName": "烘焙",
    "aSkill": "cooking",
    "bSkill": "baking",
    "name": "烹煮·烘焙",
    "index": 5
  },
  {
    "id": "gap6",
    "a": "bake",
    "b": "brew",
    "aName": "烘焙",
    "bName": "酿造",
    "aSkill": "baking",
    "bSkill": "brewing",
    "name": "烘焙·酿造",
    "index": 6
  },
  {
    "id": "gap7",
    "a": "brew",
    "b": "spice",
    "aName": "酿造",
    "bName": "调味",
    "aSkill": "brewing",
    "bSkill": "spiceMixing",
    "name": "酿造·调味",
    "index": 7
  },
  {
    "id": "gap8",
    "a": "spice",
    "b": "smith",
    "aName": "调味",
    "bName": "锻造",
    "aSkill": "spiceMixing",
    "bSkill": "craftsmithing",
    "name": "调味·锻造",
    "index": 8
  },
  {
    "id": "gap9",
    "a": "smith",
    "b": "wood",
    "aName": "锻造",
    "bName": "伐薪",
    "aSkill": "craftsmithing",
    "bSkill": "woodcutting",
    "name": "锻造·伐薪",
    "index": 9
  },
  {
    "id": "gap10",
    "a": "wood",
    "b": "ore",
    "aName": "伐薪",
    "bName": "矿脉",
    "aSkill": "woodcutting",
    "bSkill": "mining",
    "name": "伐薪·矿脉",
    "index": 10
  },
  {
    "id": "gap11",
    "a": "ore",
    "b": "pick",
    "aName": "矿脉",
    "bName": "采撷",
    "aSkill": "mining",
    "bSkill": "foraging",
    "name": "矿脉·采撷",
    "index": 11
  }
]

/** 每环的节点个数（画布布局与守卫用；**只统计分支节点**，不含汇金链） */

export const SHANHAI_RING_SLOTS = [3,3,3,3,3,5,5,5,5,5]

/** 每系 10 环（画布布局用） */
export const SHANHAI_RING_COUNT = 10
/** 最高环（第 10 环「悟道」） */
export const SHANHAI_MAIN_RING = 10
