// 风味搭配册（2026-09-10 新增）— 收集「食材组合」：首次在一张配方里同时用到某组食材即点亮该搭配。
// 设计约束：不新增物品；搭配检测只在制作成功时读取配方材料表，不影响任何配方/数值。
// 每条搭配给小额一次性奖励（金币 + 既有道具）。
//
// ⚠️ 组合可行性（2026-09-10 修正）：点亮判定要求「同一条配方的材料表里出现该组合的全部食材」，
//    因此每条搭配都必须能在现有 1236 条配方中找到同时含全部食材的配方。
//    首版 28 条里有 21 条无解（如「番茄+罗勒」——罗勒只出现在 2 条配方里且都不含番茄），
//    现已按「保留原主题 + 换成真实共现食材」的原则重写，全部 28 条均可点亮。
//    改动食材时务必用 src/game/data/flavorRecipes.js 的 recipesForPair() 复验（需先 createSkillInstances）。
//
// id 是稳定键（不随食材调整而变），避免旧档已点亮的记录丢失。

/**
 * 搭配表：items 为需要同时出现的食材（2~3 个），name/desc 为风味说明，reward 为发现奖励。
 * 所有 id 均为既有物品。括号内为可点亮的示例配方（由 recipesForPair 校验）。
 */
export const FLAVOR_PAIRS = [
  // ── 基础风味（低等级即可点亮）──
  { id: 'fp_flour_egg', name: '面糊初成', items: ['flour', 'pheasantEgg'], desc: '一切烘焙从这里开始。', reward: { gold: 500, items: { energyBiscuit: 1 } } },
  { id: 'fp_potato_carrot', name: '薯香焖肉', items: ['potato', 'pheasantMeat'], desc: '土豆吸饱汤汁，比肉还抢手。', reward: { gold: 500, items: { energyBiscuit: 1 } } },
  { id: 'fp_tomato_egg', name: '番茄炒蛋', items: ['tomato', 'pheasantEgg'], desc: '国民家常菜的第一步。', reward: { gold: 600, items: { energyBiscuit: 1 } } },
  { id: 'fp_peppercorn_salt', name: '花椒与盐', items: ['peppercorn', 'salt'], desc: '最朴素的组合，也是最难拿捏的比例。', reward: { gold: 600, items: { energyBiscuit: 1 } } },
  { id: 'fp_wheat_milk', name: '麦香双粉', items: ['wheat', 'flour'], desc: '粗麦与细面并用，口感有了层次。', reward: { gold: 700, items: { energyBiscuit: 1 } } },
  { id: 'fp_garlic_chili', name: '蒜香辣意', items: ['garlic', 'chili'], desc: '热油一泼，蒜与椒同时醒来。', reward: { gold: 800, items: { mysterySpice: 1 } } },
  { id: 'fp_cabbage_soy', name: '酱渍白菜', items: ['cabbage', 'soySauce'], desc: '腌渍工艺的入门搭配。', reward: { gold: 800, items: { mysterySpice: 1 } } },
  { id: 'fp_tomato_basil', name: '红酱初炒', items: ['tomato', 'garlic'], desc: '番茄与蒜在锅里化开，是意式酱底的起点。', reward: { gold: 800, items: { mysterySpice: 1 } } },
  { id: 'fp_eggplant_garlic', name: '蒜蓉茄子', items: ['eggplant', 'garlic'], desc: '素食里的重口味担当。', reward: { gold: 900, items: { mysterySpice: 1 } } },
  { id: 'fp_corn_milk', name: '玉米入饼', items: ['corn', 'flour'], desc: '磨碎的玉米混进面里，粗粮也甜。', reward: { gold: 900, items: { energyBiscuit: 1 } } },
  { id: 'fp_apple_cassia', name: '果甜入焙', items: ['apple', 'flour'], desc: '果泥揉进面团，烤出暖甜的香。', reward: { gold: 900, items: { mysterySpice: 1 } } },
  { id: 'fp_ginger_onion', name: '葱姜去腥', items: ['onion', 'ginger_young'], desc: '荤腥的克星，中餐的第一道门槛。', reward: { gold: 900, items: { mysterySpice: 1 } } },

  // ── 进阶（中期）──
  { id: 'fp_jasmine_mint', name: '薄荷入酱', items: ['mint', 'salt'], desc: '清凉压住咸鲜，蘸料里的一点惊喜。', reward: { gold: 1000, items: { energyBiscuit: 1 } } },
  { id: 'fp_soy_wine', name: '蒜香酱底', items: ['soySauce', 'garlic'], desc: '蒜泥化进酱油，凉拌与蘸食的通用底子。', reward: { gold: 1200, items: { mysterySpice: 1 } } },
  { id: 'fp_vanilla_milk', name: '香草入焙', items: ['vanilla', 'flour'], desc: '香草籽落进面糊，甜点有了香气骨架。', reward: { gold: 1200, items: { energyBiscuit: 1 } } },
  { id: 'fp_mirepoix', name: '三蔬同锅', items: ['potato', 'eggplant', 'cabbage'], desc: '三样家常菜挤在一锅里，谁也不让谁。', reward: { gold: 1300, items: { mysterySpice: 1 } } },
  { id: 'fp_grape_osmanthus', name: '葡萄入酿', items: ['grape', 'yeast'], desc: '酵母把果糖变成酒，时间成了味道。', reward: { gold: 1400, items: { mysterySpice: 1 } } },
  { id: 'fp_staranise_cassia', name: '八角与桂皮', items: ['starAnise', 'cassia'], desc: '卤味双璧，香气层层压进肉里。', reward: { gold: 1500, items: { mysterySpice: 1 } } },
  { id: 'fp_mint_lemon_tea', name: '薄荷清饮', items: ['mint', 'water'], desc: '薄荷拍碎泡进水里，夏天最省事的一杯。', reward: { gold: 1500, items: { energyBiscuit: 2 } } },
  { id: 'fp_three_peppers', name: '双椒合鸣', items: ['peppercorn', 'chili'], desc: '麻与辣同时落下，舌头先麻后热。', reward: { gold: 1800, items: { mysterySpice: 1 } } },
  { id: 'fp_pumpkin_cassia', name: '卤香双璧', items: ['cassia', 'clove'], desc: '桂皮暖、丁香锐，卤水里缺一不可。', reward: { gold: 1100, items: { energyBiscuit: 1 } } },

  // ── 高阶（后期）──
  { id: 'fp_saffron_rice', name: '金汤一盏', items: ['saffron', 'water'], desc: '藏红花入水，汤色金黄如日。', reward: { gold: 2000, items: { mysterySpice: 1 } } },
  { id: 'fp_mushroom_soy', name: '菌香高汤', items: ['mushroom', 'boarMeat'], desc: '山菌与肉同煮，鲜味层层叠上去。', reward: { gold: 900, items: { mysterySpice: 1 } } },
  { id: 'fp_truffle_egg', name: '松露意面', items: ['truffle', 'flour'], desc: '菌香挂在面上，简单却昂贵的一餐。', reward: { gold: 2600, items: { mysterySpice: 2 } } },
  { id: 'fp_seaweed_sesame', name: '海苔盐香', items: ['seaweed', 'salt'], desc: '海苔碾进盐里，一点就是海风味。', reward: { gold: 1000, items: { mysterySpice: 1 } } },
  { id: 'fp_truffle_rosemary', name: '迷迭香盐', items: ['rosemary', 'salt'], desc: '松针似的香压进盐粒，烤肉前的最后一手。', reward: { gold: 3000, items: { mysterySpice: 1 } } },
  { id: 'fp_spiritfruit_milk', name: '灵果清酿', items: ['spiritFruit', 'water'], desc: '灵果遇水，鲜灵之气被慢慢引出来。', reward: { gold: 3200, items: { mysterySpice: 2 } } },
  { id: 'fp_milk_egg', name: '奶茶初调', items: ['milk', 'teaLeaf'], desc: '茶汤撞上牛奶，涩与甜互相收束。', reward: { gold: 800, items: { energyBiscuit: 1 } } },
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
