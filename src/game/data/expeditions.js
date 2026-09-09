// 远行采集队（长线挂机线）— 2026-09-09 新增，参照 Rocky Idle 的 Runs 设计：
// 多槽位、小时级周期、到期领取、重复完成升档。产出全部为既有物品（不新增物品、不改物价口径），
// 不参与技能经验（保持已标定的技能满级节奏：采集 24~33h / 农耕 16 天 / 战斗 9.3 天）。
//
// 平衡口径：
//   · 每槽每轮产出 = 周期小时数 × 5 个（满配 12 槽 ≈ 60 个/小时 ≈ 主动采集一条线的 15%）
//   · 金币 = 周期小时数 × goldPerHour（goldPerHour ≈ 该槽最高产出物等级 × 10）
//   · 熟练度升档：每档产量 +10%、稀有率 +0.5%（门槛见 EXPEDITION_TIER_STEPS）
//   · 领取后该槽自动开始下一轮（挂机无需手动重开）；未领取不叠加（保持「回来收菜」的节奏）

/** 熟练度升档门槛（累计完成次数），参照 Rocky Idle 的 1/2/4/8/16/32/100/250 略收紧 */
export const EXPEDITION_TIER_STEPS = [1, 2, 4, 8, 16, 32, 64, 128]

/** 由累计完成次数反推熟练度档位（0~8） */
export function expeditionTier(completions = 0) {
  let t = 0
  for (const n of EXPEDITION_TIER_STEPS) if (completions >= n) t++
  return t
}

/** 每档产量加成（+10%/档） */
export function expeditionYieldMult(tier = 0) {
  return 1 + 0.1 * tier
}

/** 每档稀有率加成（+0.5%/档） */
export function expeditionRareBonus(tier = 0) {
  return 0.005 * tier
}

export const EXPEDITIONS = [
  {
    id: 'fishery',
    name: '远洋渔队',
    icon: '🚢',
    skill: 'fishing',
    reqLevel: 25,
    desc: '出海数小时，带回一船鲜货',
    rare: { itemId: 'goldenDragonFish', chance: 0.005 }, // 金龙鱼（唯一额外来源：0.5% + 档位加成）
    slots: [
      { reqLevel: 1, hours: 1, goldPerHour: 150, pool: ['crucian', 'carp', 'perch', 'salmon'] },
      { reqLevel: 30, hours: 1, goldPerHour: 450, pool: ['tuna', 'eel', 'lobster'] },
      { reqLevel: 50, hours: 2, goldPerHour: 650, pool: ['crab', 'abalone', 'fishing_ext_20'] },
      { reqLevel: 70, hours: 4, goldPerHour: 950, pool: ['seaCucumber', 'bluefin', 'grouper'] },
    ],
  },
  {
    id: 'herbGathering',
    name: '深山采药队',
    icon: '⛰️',
    skill: 'foraging',
    reqLevel: 30,
    desc: '深入山林采药，带回珍稀菌草',
    rare: { itemId: 'spiritFruit', chance: 0.01 }, // 灵果
    slots: [
      { reqLevel: 1, hours: 1, goldPerHour: 200, pool: ['mushroom', 'mint', 'chrysanthemum', 'rose'] },
      { reqLevel: 30, hours: 1, goldPerHour: 380, pool: ['rosella', 'jasmine', 'osmanthus', 'excavation_ext_12'] },
      { reqLevel: 50, hours: 2, goldPerHour: 700, pool: ['lingzhi', 'parsley', 'matsutake'] },
      { reqLevel: 70, hours: 4, goldPerHour: 800, pool: ['foraging_ext_22', 'foraging_ext_23', 'truffle'] },
    ],
  },
  {
    id: 'oreSurvey',
    name: '矿脉勘探队',
    icon: '⛏️',
    skill: 'excavation',
    reqLevel: 25,
    desc: '勘探深层矿脉，运回整箱矿石',
    rare: { itemId: 'excavation_ext2_18', chance: 0.02 }, // 黄金矿
    slots: [
      { reqLevel: 1, hours: 1, goldPerHour: 160, pool: ['saltOre', 'steelOre'] },
      { reqLevel: 30, hours: 1, goldPerHour: 360, pool: ['silverOre', 'goldOre', 'adamantOre'] },
      { reqLevel: 50, hours: 2, goldPerHour: 610, pool: ['coldIronOre', 'excavation_ext2_17', 'starOre'] },
      { reqLevel: 70, hours: 4, goldPerHour: 880, pool: ['giltOre', 'excavation_ext2_25', 'excavation_ext2_27'] },
    ],
  },
]

export function getExpedition(id) {
  return EXPEDITIONS.find((e) => e.id === id) ?? null
}
