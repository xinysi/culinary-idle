// 产地与风土（2026-09-10 新增）— 五个产地：金币「考察」解锁后可派驻采集队线路，
// 派驻后该线路产出偏向产地特产，并提升产量与稀有掉落率；「当季」产地额外加成。
// 设计约束：只读取/重排既有物品 id（产地特产均为既有物品），不改动物品数值；采集队产出池为运行期叠加。

export const REGIONS = [
  {
    id: 'plain', name: '中央平原', icon: '🌾', cost: 20000, seasonMonths: [3, 4, 5],
    box: ['wheat', 'corn', 'rice', 'potato', 'carrot', 'cabbage'],
    qtyPct: 20, rarePct: 5, desc: '粮谷与根茎的主产区',
  },
  {
    id: 'snow', name: '北境雪山', icon: '🏔️', cost: 60000, seasonMonths: [12, 1, 2],
    box: ['truffle', 'mushroom', 'excavation_ext_01', 'mint', 'rosemary'],
    qtyPct: 15, rarePct: 8, desc: '寒地菌菇与香草，稀有物出产率高',
  },
  {
    id: 'island', name: '南海群岛', icon: '🏝️', cost: 80000, seasonMonths: [6, 7, 8],
    box: ['crucian', 'carp', 'perch', 'salmon', 'tuna', 'seaweed'],
    qtyPct: 18, rarePct: 6, desc: '渔获丰饶的近海群岛',
  },
  {
    id: 'rainforest', name: '西陲雨林', icon: '🌴', cost: 50000, seasonMonths: [6, 7, 8],
    box: ['apple', 'grape', 'jasmine', 'osmanthus', 'ginger', 'chili'],
    qtyPct: 22, rarePct: 5, desc: '香料与果实的密林',
  },
  {
    id: 'volcano', name: '东岭火山', icon: '🌋', cost: 120000, seasonMonths: [9, 10, 11],
    box: ['copperOre', 'ironOre', 'saltOre', 'silverOre', 'goldOre'],
    qtyPct: 12, rarePct: 10, desc: '矿脉与地热的熔岩之乡',
  },  {
    id: 'highland', name: '云顶高原', icon: '🐄', cost: 40000, seasonMonths: [4, 5, 6],
    box: ['milk', 'pheasantEgg', 'goatMeat', 'mushroom'],
    qtyPct: 16, rarePct: 7, desc: '云线之上的牧养地，乳品与禽蛋稳定丰产',
  },
  {
    id: 'bamboo', name: '竹海山乡', icon: '🎍', cost: 70000, seasonMonths: [7, 8, 9],
    box: ['foraging_ext_24', 'teaLeaf', 'mushroom', 'ginger'],
    qtyPct: 19, rarePct: 6, desc: '漫山竹影，笋与山货按季冒头',
  },

]

const REGION_INDEX = new Map(REGIONS.map((r) => [r.id, r]))

export function getRegion(id) {
  return REGION_INDEX.get(id) ?? null
}

/** 当季产地判定（按月份，可多产地同季） */
export function isInSeason(region, month /* 1-12 */) {
  return (region?.seasonMonths ?? []).includes(month)
}

/** 派驻加成汇总：{ qtyPct, rarePct, inSeason } */
export function postingBonus(region, month = new Date().getMonth() + 1) {
  if (!region) return { qtyPct: 0, rarePct: 0, inSeason: false }
  const inSeason = isInSeason(region, month)
  const mult = inSeason ? 1.5 : 1
  return { qtyPct: Math.round(region.qtyPct * mult), rarePct: Math.round(region.rarePct * mult), inSeason }
}
