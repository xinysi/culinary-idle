// 赛季主题内容（动态生成）— 按当前赛季 theme 生成契合主题的任务与主题化奖励。
// 铁律：赛季装备（limitedItem/limitedItems 的 gear 套+单件）数值与发放档位【固定】，本模块只：
//   ① 把赛季任务目标改为契合主题的采集/制作物（任务 id 确定、进度键稳定）；
//   ② 把奖励档位里的「通用道具」（增益剂等非装备）替换为契合主题的食材/料理物。
// 不含任何装备数值变更；用 getItem 过滤不存在 id 以防引用失效。
import { getItem, itemName } from './items.js'

// 季节 id → 契合主题物品池（gather=可采集主题食材；craft=主题料理/饮品配方产物）
export const SEASON_THEME_ITEMS = {
  summer: { gather: ['strawberry', 'watermelon', 'mango', 'apple', 'grape'], craft: ['appleJuice', 'sodaWater'] },
  winter: { gather: ['goatMeat', 'venison', 'boarMeat', 'onion', 'chili'], craft: ['riceWine'] },
  spring: { gather: ['carrot', 'tomato', 'potato', 'cabbage', 'onion'], craft: ['appleJuice'] },
  autumn: { gather: ['corn', 'wheat', 'rice', 'pumpkin', 'grape'], craft: ['riceWine'] },
  ocean: { gather: ['lobster', 'crab', 'salmon', 'grouper', 'bluefin'], craft: [] },
  forest: { gather: ['mushroom', 'matsutake', 'truffle', 'lingzhi'], craft: [] },
  desert: { gather: ['pepper', 'chili', 'garlic', 'onion', 'ginger'], craft: [] },
  berry: { gather: ['strawberry', 'mango', 'banana', 'pineapple', 'grape'], craft: ['appleJuice'] },
  summit: { gather: ['lingzhi', 'truffle', 'matsutake', 'potato', 'carrot'], craft: [] },
  tea: { gather: ['teaLeaf', 'milk', 'wheat', 'rice'], craft: ['riceWine'] },
  spice: { gather: ['pepper', 'chili', 'garlic', 'ginger', 'onion'], craft: [] },
  pickle: { gather: ['eggplant', 'cabbage', 'cucumber', 'onion', 'garlic'], craft: [] },
  lotus: { gather: ['lotusSeed', 'rice', 'corn', 'cabbage'], craft: [] },
  ember: { gather: ['boarMeat', 'venison', 'chili', 'garlic', 'onion'], craft: [] },
  snow: { gather: ['pumpkin', 'sweetPotato', 'potato', 'corn'], craft: [] },
  moon: { gather: ['wheat', 'rice', 'corn', 'grape'], craft: ['riceWine'] },
  chili: { gather: ['chili', 'pepper', 'garlic', 'onion', 'ginger'], craft: [] },
  pirate: { gather: ['bluefin', 'seaCucumber', 'grouper', 'lobster'], craft: [] },
  coral: { gather: ['abalone', 'seaCucumber', 'grouper', 'lobster', 'crab'], craft: [] },
  galaxy: { gather: ['truffle', 'lingzhi', 'matsutake', 'mushroom'], craft: [] },
  blossom: { gather: ['strawberry', 'grape', 'apple', 'mango'], craft: ['appleJuice'] },
  mooncake2: { gather: ['crab', 'lobster', 'rice', 'corn'], craft: [] },
  grape: { gather: ['grape', 'apple', 'banana', 'mango'], craft: ['riceWine'] },
  honey2: { gather: ['mango', 'strawberry', 'banana', 'grape'], craft: ['appleJuice'] },
  citrus: { gather: ['watermelon', 'strawberry', 'banana', 'apple'], craft: [] },
  chestnut: { gather: ['grape', 'apple', 'mango', 'banana'], craft: ['appleJuice'] },
  snow2: { gather: ['potato', 'sweetPotato', 'pumpkin', 'cabbage'], craft: [] },
  bamboo: { gather: ['potato', 'carrot', 'tomato', 'cabbage'], craft: [] },
  ocean2: { gather: ['bluefin', 'seaCucumber', 'grouper', 'abalone'], craft: [] },
  pine: { gather: ['mushroom', 'lingzhi', 'matsutake', 'truffle'], craft: [] },
  plum: { gather: ['grape', 'apple', 'rice', 'corn'], craft: ['riceWine'] },
  eggplant: { gather: ['eggplant', 'cabbage', 'cucumber', 'tomato'], craft: [] },
  goat: { gather: ['goatMeat', 'rabbitMeat', 'venison', 'onion'], craft: [] },
  ginkgo: { gather: ['cabbage', 'tomato', 'potato', 'corn'], craft: [] },
  taro: { gather: ['sweetPotato', 'yam', 'potato', 'corn'], craft: [] },
  sesame: { gather: ['wheat', 'rice', 'corn', 'soybean'], craft: [] },
  chili2: { gather: ['chili', 'pepper', 'garlic', 'onion'], craft: [] },
  wine: { gather: ['grape', 'rice', 'corn', 'wheat'], craft: ['riceWine'] },
  phoenix: { gather: ['venison', 'goatMeat', 'boarMeat', 'chili'], craft: [] },
  dragon2: { gather: ['seaCucumber', 'grouper', 'lobster', 'bluefin'], craft: [] },
}

const poolOf = (s) => SEASON_THEME_ITEMS[s?.id] ?? { gather: ['rice', 'corn'], craft: [] }
const exists = (id) => !!getItem(id)
const gatherPool = (s) => poolOf(s).gather.filter(exists)
const craftPool = (s) => poolOf(s).craft.filter(exists)

// 通用道具（非装备/非 gear/非单件）→ 视为主题化目标
const GENERIC = new Set(['energyBiscuit', 'mysterySpice', 'yieldTonic3', 'yieldTonic1', 'yieldTonic5', 'xpTonic3', 'xpTonic5', 'preservTier1', 'preservTier5', 'spiritBrew'])

// 制作任务目标回退池：theme craft 不足时用它补足到 2 个制作任务（均确认存在且为配方产物）
const CRAFT_FALLBACK = ['appleJuice', 'riceWine', 'sodaWater', 'energyBiscuit', 'mysterySpice']
// 采集任务目标回退池：theme gather 不足 4 个时补足（均确认存在且可采集）
const GATHER_FALLBACK = ['rice', 'corn', 'wheat', 'carrot', 'potato']

/** 按 season 确定性生成契合主题的赛季任务（id 固定、进度键稳定，bumpSeason 一致）。
 *  恒 10 个任务：采集×4 + 制作×2 + 美食探索 + 首领 + 对决 + 餐厅。
 *  点数平衡：总点数恒为 TARGET（覆盖 10 档最高 200 点，留 ~2.5% 冗余），按任务价值权重分配。 */
export function seasonMissions(s) {
  const g = gatherPool(s)
  const craft = craftPool(s)
  // 制作任务恒取 2 个：候选 = 主题料理 ∪ 回退物，取前 2 个不同的存在物，保证任意季都有制作任务
  const dedupe = (arr) => [...new Set(arr.filter(Boolean))]
  const craftCand = dedupe([...craft, ...CRAFT_FALLBACK.filter(exists)])
  const c1 = craftCand[0] ?? null
  const c2 = craftCand[1] ?? null
  const missions = []
  // 采集 ×4（第 4 个量少些），主题采集物不足时用回退 gather 池补足
  const gq = [1000, 600, 400, 200]
  for (let i = 0; i < 4; i++) {
    const item = g[i] ?? GATHER_FALLBACK.filter((id) => exists(id) && !g.includes(id))[i] ?? null
    const id = `${s.id}_m${i + 1}`
    if (item) missions.push({ id, name: `采集 ${itemName(item)} ×${gq[i]}`, kind: 'gather', param: item, qty: gq[i] })
  }
  if (c1) missions.push({ id: `${s.id}_m5`, name: `制作 ${itemName(c1)} ×200`, kind: 'craft', param: c1, qty: 200 })
  if (c2) missions.push({ id: `${s.id}_m6`, name: `制作 ${itemName(c2)} ×100`, kind: 'craft', param: c2, qty: 100 })
  missions.push({ id: `${s.id}_m7`, name: '美食探索 ×400', kind: 'explore', param: 'any', qty: 400 })
  missions.push({ id: `${s.id}_m8`, name: '击败 任意首领 ×2', kind: 'boss', param: 'any', qty: 2 })
  missions.push({ id: `${s.id}_m9`, name: '对决胜利 ×300', kind: 'combatWin', param: 'any', qty: 300 })
  missions.push({ id: `${s.id}_m10`, name: '餐厅累计赚取 8000 金币', kind: 'restaurant', param: 'any', qty: 8000 })
  return balancePoints(missions)
}

// 赛季点数平衡：总点数恒定为 TARGET，按任务价值权重分配。
// 领取语义为「积分兑换扣费」，十档点数总和 = 20+40+...+200 = 1100；TARGET 需 ≥ 1100 才能买满十档，
// 设 1120（= 十档总和 + 20 冗余，抵消分配取整误差）。
const TARGET = 1120
const WEIGHT = { gather: 1, craft: 1.3, explore: 1.2, boss: 1.8, combatWin: 1.2, restaurant: 1.5 }
function balancePoints(tasks) {
  const tw = tasks.reduce((sum, t) => sum + (WEIGHT[t.kind] ?? 1), 0)
  let allocated = 0
  tasks.forEach((t, i) => {
    let p
    if (i === tasks.length - 1) {
      p = Math.max(8, TARGET - allocated) // 末项补差，保证总值恒 TARGET
    } else {
      p = Math.max(8, Math.round((WEIGHT[t.kind] ?? 1) / tw * TARGET))
    }
    allocated += p
    t.points = p
  })
  return tasks
}

/** 按 season 动态主题化奖励档位：保留 gear 套/单件/gold 固定，仅把通用道具换为主题食材/料理物 */
export function seasonTiers(s) {
  const g = gatherPool(s)
  const craft = craftPool(s)
  const pool = [...g, ...craft].filter(Boolean)
  const themePick = (i) => (pool.length ? pool[i % pool.length] : null)
  return (s.tiers ?? []).map((tier, i) => {
    if (!tier.reward?.items) return tier
    const items = { ...tier.reward.items }
    for (const [id, q] of Object.entries(items)) {
      if (GENERIC.has(id)) {
        const th = themePick(i)
        if (th) { delete items[id]; items[th] = (items[th] ?? 0) + q }
      }
    }
    return { ...tier, reward: { ...tier.reward, items } }
  })
}
