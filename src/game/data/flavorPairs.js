// 风味搭配册（2026-09-10 新增）— 收集「食材组合」：首次在一张配方里同时用到某组食材即点亮该搭配。
// 设计约束：不新增物品；搭配检测只在制作成功时读取配方材料表，不影响任何配方/数值。
// 每条搭配给小额一次性奖励（金币 + 既有道具）。

/**
 * 搭配表：items 为需要同时出现的食材（2~3 个），name/desc 为风味说明，reward 为发现奖励。
 * 所有 id 均为既有物品。
 */
export const FLAVOR_PAIRS = [
  { id: 'fp_tomato_basil', name: '番茄与罗勒', items: ['tomato', 'basil'], desc: '意式厨房的底色：酸与香彼此托举。', reward: { gold: 800, items: { mysterySpice: 1 } } },
  { id: 'fp_garlic_chili', name: '蒜香辣意', items: ['garlic', 'chili'], desc: '热油一泼，蒜与椒同时醒来。', reward: { gold: 800, items: { mysterySpice: 1 } } },
  { id: 'fp_ginger_onion', name: '葱姜去腥', items: ['ginger', 'onion'], desc: '荤腥的克星，中餐的第一道门槛。', reward: { gold: 900, items: { mysterySpice: 1 } } },
  { id: 'fp_soy_wine', name: '酱香入酒', items: ['soySauce', 'riceWine'], desc: '一勺酱、半杯酒，红烧的灵魂。', reward: { gold: 1200, items: { mysterySpice: 1 } } },
  { id: 'fp_staranise_cassia', name: '八角与桂皮', items: ['starAnise', 'cassia'], desc: '卤味双璧，香气层层压进肉里。', reward: { gold: 1500, items: { mysterySpice: 1 } } },
  { id: 'fp_peppercorn_salt', name: '花椒与盐', items: ['peppercorn', 'salt'], desc: '最朴素的组合，也是最难拿捏的比例。', reward: { gold: 600, items: { energyBiscuit: 1 } } },
  { id: 'fp_milk_egg', name: '奶与蛋', items: ['milk', 'pheasantEgg'], desc: '甜点世界的黏合剂。', reward: { gold: 800, items: { energyBiscuit: 1 } } },
  { id: 'fp_flour_egg', name: '面糊初成', items: ['flour', 'pheasantEgg'], desc: '一切烘焙从这里开始。', reward: { gold: 500, items: { energyBiscuit: 1 } } },
  { id: 'fp_mushroom_soy', name: '菌菇酱烧', items: ['mushroom', 'soySauce'], desc: '山味遇见豆香，鲜上加鲜。', reward: { gold: 900, items: { mysterySpice: 1 } } },
  { id: 'fp_seaweed_sesame', name: '海苔与芝麻', items: ['seaweed', 'sesame'], desc: '东瀛风味的两种香气。', reward: { gold: 1000, items: { mysterySpice: 1 } } },
  { id: 'fp_apple_cassia', name: '果香遇桂', items: ['apple', 'cassia'], desc: '热红酒式的温暖搭配。', reward: { gold: 900, items: { mysterySpice: 1 } } },
  { id: 'fp_grape_osmanthus', name: '葡萄与桂花', items: ['grape', 'osmanthus'], desc: '酿一坛秋天的甜。', reward: { gold: 1400, items: { mysterySpice: 1 } } },
  { id: 'fp_jasmine_mint', name: '双清之息', items: ['jasmine', 'mint'], desc: '茶与草的清凉叠加。', reward: { gold: 1000, items: { energyBiscuit: 1 } } },
  { id: 'fp_vanilla_milk', name: '香草牛奶', items: ['vanilla', 'milk'], desc: '甜点柜台的招牌气味。', reward: { gold: 1200, items: { energyBiscuit: 1 } } },
  { id: 'fp_saffron_rice', name: '金饭', items: ['saffron', 'rice'], desc: '几缕花丝，把白饭染成金黄。', reward: { gold: 2000, items: { mysterySpice: 1 } } },
  { id: 'fp_truffle_egg', name: '松露与蛋', items: ['truffle', 'pheasantEgg'], desc: '贵气逼人的经典组合。', reward: { gold: 2600, items: { mysterySpice: 2 } } },
  { id: 'fp_spiritfruit_milk', name: '灵果奶露', items: ['spiritFruit', 'milk'], desc: '灵果的甘甜被奶脂托住。', reward: { gold: 3200, items: { mysterySpice: 2 } } },
  { id: 'fp_truffle_rosemary', name: '菌香迷迭', items: ['truffle', 'rosemary'], desc: '西厨最爱的地气组合。', reward: { gold: 3000, items: { mysterySpice: 1 } } },
  { id: 'fp_tomato_egg', name: '番茄炒蛋', items: ['tomato', 'pheasantEgg'], desc: '国民家常菜的第一步。', reward: { gold: 600, items: { energyBiscuit: 1 } } },
  { id: 'fp_potato_carrot', name: '根茎双炖', items: ['potato', 'carrot'], desc: '炖锅里最踏实的两位。', reward: { gold: 500, items: { energyBiscuit: 1 } } },
  { id: 'fp_corn_milk', name: '玉米浓汤', items: ['corn', 'milk'], desc: '把甜味熬进奶里。', reward: { gold: 900, items: { energyBiscuit: 1 } } },
  { id: 'fp_wheat_milk', name: '麦香与奶', items: ['wheat', 'milk'], desc: '面包房清晨的味道。', reward: { gold: 700, items: { energyBiscuit: 1 } } },
  { id: 'fp_cabbage_soy', name: '酱渍白菜', items: ['cabbage', 'soySauce'], desc: '腌渍工艺的入门搭配。', reward: { gold: 800, items: { mysterySpice: 1 } } },
  { id: 'fp_pumpkin_cassia', name: '南瓜与桂', items: ['pumpkin', 'cassia'], desc: '秋日甜点的暖香。', reward: { gold: 1100, items: { energyBiscuit: 1 } } },
  { id: 'fp_eggplant_garlic', name: '蒜蓉茄子', items: ['eggplant', 'garlic'], desc: '素食里的重口味担当。', reward: { gold: 900, items: { mysterySpice: 1 } } },
  { id: 'fp_mint_lemon_tea', name: '薄荷清饮', items: ['mint', 'jasmine', 'apple'], desc: '三重清爽，夏日冷饮的配方。', reward: { gold: 1500, items: { energyBiscuit: 2 } } },
  { id: 'fp_three_peppers', name: '三椒合鸣', items: ['chili', 'peppercorn', 'ginger'], desc: '辣、麻、辛同时出手，川味的骨架。', reward: { gold: 1800, items: { mysterySpice: 1 } } },
  { id: 'fp_mirepoix', name: '西式三蔬', items: ['onion', 'carrot', 'potato'], desc: '高汤底味的三块基石。', reward: { gold: 1300, items: { mysterySpice: 1 } } },
]

const PAIR_INDEX = new Map(FLAVOR_PAIRS.map((p) => [p.id, p]))

export function getFlavorPair(id) {
  return PAIR_INDEX.get(id) ?? null
}

/**
 * 检测一批食材点亮了哪些搭配（顺序无关，只需全部出现）。
 * @param {string[]} ingredientIds 本张配方用到的全部食材 id
 * @returns {Array} 命中的搭配定义（含未点亮的，由调用方过滤）
 */
export function matchFlavorPairs(ingredientIds) {
  const set = new Set(ingredientIds ?? [])
  if (!set.size) return []
  return FLAVOR_PAIRS.filter((p) => p.items.every((id) => set.has(id)))
}
