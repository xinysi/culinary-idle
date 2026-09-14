// 牧场 / 网箱的加工品（2026-09-14 新增，v2.3.0）— 8 件，全部 type=consumable / category=buff。
//
// 设计动机（用户 2026-09-14）：「牧场养殖的养动物和网箱产出物都要调整且产出物两种以上」——
// 原先野猪只产 1 种（野猪肉）、鲫鱼只产 1 种（鲫鱼），产线产出太单薄，且与采集完全重叠。
// 改法：每种动物 / 每种鱼在原有食材之外**多产 1 件「加工品」**（本例 8 件），
// 加工品是采集拿不到的乘区消耗品 —— 于是这些产线有了自己的独占产出，同时保留原有食材产出（≥2 种）。
//
// 效果梯度与动物/鱼档次对齐（野鸡 4h → 野牛 12h；鲫鱼 3h → 鲍鱼 12h），并各自落在不同的乘区轴上，
// 使四头动物 / 四条鱼各有用途而不是清一色「加产量」。
export const GOODS_ITEMS = [
  // ── 牧场（畜产加工）──
  { id: 'chickenOil', name: '鸡油', from: '野鸡', value: 70, use: { buffRestaurant: { mult: 1.2, minutes: 60 } } },
  { id: 'lard', name: '猪油', from: '野猪', value: 120, use: { buffYield: { mult: 1.3, minutes: 60 } } },
  { id: 'cheese', name: '羊酪', from: '山羊', value: 190, use: { buffXp: { mult: 1.5, minutes: 60 } } },
  { id: 'boneBroth', name: '牛骨高汤', from: '野牛', value: 280, use: { buffXp: { mult: 2.0, minutes: 120 }, buffYield: { mult: 1.5, minutes: 120 } } },
  // ── 网箱（水产加工）──
  { id: 'fishPaste', name: '鱼酱', from: '鲫鱼', value: 80, use: { buffYield: { mult: 1.25, minutes: 60 } } },
  { id: 'caviar', name: '鱼子酱', from: '鲑鱼', value: 210, use: { buffXp: { mult: 1.6, minutes: 60 } } },
  { id: 'shrimpOil', name: '虾油', from: '龙虾', value: 300, use: { buffRestaurant: { mult: 1.3, minutes: 120 } } },
  { id: 'abaloneSauce', name: '鲍汁', from: '鲍鱼', value: 420, use: { buffGather: { mult: 0.92, minutes: 60 } } },
].map((g) => ({
  id: g.id,
  name: g.name,
  type: 'consumable',
  category: 'buff',
  tier: 1,
  value: g.value,
  stackable: true,
  maxStack: 9999,
  use: g.use,
  image: `images/items/tool/${g.name}.png`,
}))

/** 加工品效果文案（图鉴 / 页面展示用） */
export function goodsEffectText(g) {
  const u = g.use ?? {}
  const parts = []
  if (u.buffXp) parts.push(`经验 ×${u.buffXp.mult}`)
  if (u.buffYield) parts.push(`产量 ×${u.buffYield.mult}`)
  if (u.buffGather) parts.push(`采集间隔 −${Math.round((1 - u.buffGather.mult) * 100)}%`)
  if (u.buffRestaurant) parts.push(`餐厅收入 +${Math.round((u.buffRestaurant.mult - 1) * 100)}%`)
  return parts.join(' · ')
}

/** id → 加工品定义 */
export const GOODS_INDEX = new Map(GOODS_ITEMS.map((g) => [g.id, g]))

export function getGoods(id) {
  return GOODS_INDEX.get(id) ?? null
}
