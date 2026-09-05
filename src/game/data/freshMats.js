// 高频通用食材的低阶“嫩”替代：用于把超纲配方里的高阶通用食材换成低阶可采集的嫩版，
// 使低等级菜能直接采到低阶食材（材料≤物品+5），高级食材/加工品则保持抬高配方等级。
export const FRESH_DEFS = [
  ['ginger', '嫩生姜', 1], ['garlic', '嫩大蒜', 1], ['chili', '嫩辣椒', 1], ['peppercorn', '嫩花椒', 1],
  ['soybean', '嫩大豆', 1], ['cabbage', '嫩白菜', 1], ['tomato', '嫩番茄', 1], ['ume', '嫩乌梅', 1],
  ['basil', '嫩罗勒', 1], ['vanilla', '嫩香草', 7], ['rosemary', '嫩迷迭香', 20], ['cassia', '嫩桂皮', 15], ['starAnise', '嫩八角', 15],
  ['foraging_ext_21', '嫩花生', 2], ['foraging_ext2_19', '嫩蟠桃', 16], ['strawberry', '嫩草莓', 4], ['grape', '嫩葡萄', 4],
  ['pumpkin', '嫩南瓜', 20], ['eggplant', '嫩茄子', 16], ['watermelon', '嫩西瓜', 1], ['hamimelon', '嫩哈密瓜', 1],
  ['foraging_ext_09', '嫩猕猴桃', 9], ['winterMelon', '嫩冬瓜', 1], ['rosella', '嫩洛神花', 2], ['foraging_ext_15', '嫩龙眼', 6],
  ['jasmine', '嫩茉莉', 12], ['foraging_ext2_16', '嫩枸杞', 9],
]

export const FRESH_MAP = {} // 原id -> 嫩id
export const FRESH_ITEMS = {}
export const FRESH_TARGETS = { foraging: [] }
for (const [orig, name, lv] of FRESH_DEFS) {
  const kid = `${orig}_young`
  FRESH_MAP[orig] = kid
  FRESH_ITEMS[kid] = { id: kid, name, type: 'ingredient', category: 'vegetable', tier: Math.max(1, Math.ceil(lv / 10)), value: 4 + lv * 2, stackable: true, maxStack: 9999 }
  FRESH_TARGETS.foraging.push({ itemId: kid, reqLevel: lv, xpPerAction: 8 + lv * 2, intervalSec: 3.0 })
}
