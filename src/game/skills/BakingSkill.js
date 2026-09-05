// 烘焙（Baking）— 需求文档 §3.2.2
// 消耗面粉（小麦碾磨）+ 配料制作烘焙品；烘焙品回血少但带「持续回血」增益；
// 「能量饼干」提供离线收益加成（+4h，上限 +12h，§8.1）。

import { ProductionSkill } from './ProductionSkill.js'
import { PRODUCTION_EXT } from '../data/expansion1.js'
import { PRODUCTION_EXT2 } from '../data/expansion2.js'
import { raiseRecipeLevels } from './recipeBalance.js'

export const BAKING_RECIPES = [
  { id: 'milling', name: '磨面粉', category: '加工', reqLevel: 1, xp: 15, successChance: 1.0, ingredients: { wheat: 1 }, output: { itemId: 'flour', qty: 2 } },
  { id: 'whiteBread', name: '白面包', category: '主食', reqLevel: 3, xp: 40, successChance: 0.9, ingredients: { flour: 1, saltOre: 1 }, output: { itemId: 'whiteBread', qty: 1 } },
  { id: 'sweetBread', name: '甜面包', category: '主食', reqLevel: 10, xp: 75, successChance: 0.87, ingredients: { flour: 1, apple: 1 }, output: { itemId: 'sweetBread', qty: 1 } },
  { id: 'cornTortilla', name: '玉米饼', category: '主食', reqLevel: 15, xp: 105, successChance: 0.85, ingredients: { flour: 1, corn: 2 }, output: { itemId: 'cornTortilla', qty: 1 } },
  { id: 'energyBiscuit', name: '能量饼干', category: '道具', reqLevel: 20, xp: 130, successChance: 0.8, ingredients: { flour: 1, apple: 2, pheasantEgg: 1 }, output: { itemId: 'energyBiscuit', qty: 1 } },
  { id: 'pumpkinPie', name: '南瓜派', category: '甜点', reqLevel: 25, xp: 165, successChance: 0.82, ingredients: { flour: 1, pumpkin: 1, apple: 1 }, output: { itemId: 'pumpkinPie', qty: 1 } },
  { id: 'strawberryCake', name: '草莓蛋糕', category: '甜点', reqLevel: 35, xp: 230, successChance: 0.78, ingredients: { flour: 2, strawberry: 3, pheasantEgg: 2 }, output: { itemId: 'strawberryCake', qty: 1 } },
  { id: 'vanillaCake', name: '香草蛋糕', category: '甜点', reqLevel: 45, xp: 310, successChance: 0.75, ingredients: { flour: 2, vanilla: 1, pheasantEgg: 2 }, output: { itemId: 'vanillaCake', qty: 1 } },
  { id: 'rosemaryBread', name: '迷迭香面包', category: '主食', reqLevel: 55, xp: 410, successChance: 0.72, ingredients: { flour: 2, rosemary: 1 }, output: { itemId: 'rosemaryBread', qty: 1 } },
  { id: 'truffleBread', name: '松露面包', category: '主食', reqLevel: 70, xp: 620, successChance: 0.65, ingredients: { flour: 3, truffle: 1 }, output: { itemId: 'truffleBread', qty: 1 } },
  // ── 批量场景B：基础材料补齐（榴莲→榴莲酥）──
  { id: 'durianPastry', name: '榴莲酥', category: '甜点', reqLevel: 62, xp: 540, successChance: 0.68, ingredients: { durian: 2, flour: 1 }, output: { itemId: 'durianPastry', qty: 1 } },
  { id: 'bakeDown_1', name: '青梅果脯糕', category: '甜点', reqLevel: 40, xp: 480, successChance: 0.7, ingredients: { greenPlumPreserve: 2, flour: 2 }, output: { itemId: 'bakeDown_1', qty: 1 } },
  { id: 'bakeDown_2', name: '莲雾蜜饯酥', category: '甜点', reqLevel: 40, xp: 480, successChance: 0.7, ingredients: { waxApplePreserve: 2, flour: 2 }, output: { itemId: 'bakeDown_2', qty: 1 } },
  { id: 'bakeDown_3', name: '百香果酱饼', category: '甜点', reqLevel: 40, xp: 480, successChance: 0.7, ingredients: { passionFruitJam: 2, flour: 2 }, output: { itemId: 'bakeDown_3', qty: 1 } },
  { id: 'bakeDown_4', name: '山竹蜜饯点', category: '甜点', reqLevel: 40, xp: 480, successChance: 0.7, ingredients: { mangosteenPreserve: 2, flour: 2 }, output: { itemId: 'bakeDown_4', qty: 1 } },
  { id: 'bakeDown_5', name: '番石榴酱糕', category: '甜点', reqLevel: 41, xp: 492, successChance: 0.7, ingredients: { guavaJam: 2, flour: 2 }, output: { itemId: 'bakeDown_5', qty: 1 } },
  { id: 'bakeDown_6', name: '火龙果酱酥', category: '甜点', reqLevel: 41, xp: 492, successChance: 0.7, ingredients: { dragonFruitJam: 2, flour: 2 }, output: { itemId: 'bakeDown_6', qty: 1 } },
  { id: 'bakeDown_7', name: '无花果蜜饯饼', category: '甜点', reqLevel: 41, xp: 492, successChance: 0.7, ingredients: { figPreserve: 2, flour: 2 }, output: { itemId: 'bakeDown_7', qty: 1 } },
  { id: 'bakeDown_8', name: '盐焗腰果点', category: '甜点', reqLevel: 41, xp: 492, successChance: 0.7, ingredients: { cashewRoast: 2, flour: 2 }, output: { itemId: 'bakeDown_8', qty: 1 } },
  { id: 'bakeDown_9', name: '柿饼糕', category: '甜点', reqLevel: 42, xp: 504, successChance: 0.7, ingredients: { persimmonDry: 2, flour: 2 }, output: { itemId: 'bakeDown_9', qty: 1 } },
  { id: 'bakeDown_10', name: '盐焗榛子酥', category: '甜点', reqLevel: 42, xp: 504, successChance: 0.7, ingredients: { hazelnutRoast: 2, flour: 2 }, output: { itemId: 'bakeDown_10', qty: 1 } },
  { id: 'bakeDown_11', name: '盐焗开心果饼', category: '甜点', reqLevel: 42, xp: 504, successChance: 0.7, ingredients: { pistachioRoast: 2, flour: 2 }, output: { itemId: 'bakeDown_11', qty: 1 } },
  { id: 'bakeDown_12', name: '桂圆干点', category: '甜点', reqLevel: 42, xp: 504, successChance: 0.7, ingredients: { longanDry: 2, flour: 2 }, output: { itemId: 'bakeDown_12', qty: 1 } },
  { id: 'bakeDown_13', name: '盐焗松子糕', category: '甜点', reqLevel: 43, xp: 516, successChance: 0.7, ingredients: { pineNutRoast: 2, flour: 2 }, output: { itemId: 'bakeDown_13', qty: 1 } },
  { id: 'bakeDown_14', name: '枇杷蜜饯酥', category: '甜点', reqLevel: 43, xp: 516, successChance: 0.7, ingredients: { loquatPreserve: 2, flour: 2 }, output: { itemId: 'bakeDown_14', qty: 1 } },
  { id: 'bakeDown_15', name: '山楂蜜饯饼', category: '甜点', reqLevel: 43, xp: 516, successChance: 0.7, ingredients: { hawthornPreserve: 2, flour: 2 }, output: { itemId: 'bakeDown_15', qty: 1 } },
  { id: 'bakeDown_16', name: '糖炒板栗点', category: '甜点', reqLevel: 43, xp: 516, successChance: 0.7, ingredients: { chestnutRoast: 2, flour: 2 }, output: { itemId: 'bakeDown_16', qty: 1 } },
  { id: 'bakeDown_17', name: '琥珀核桃糕', category: '甜点', reqLevel: 44, xp: 528, successChance: 0.7, ingredients: { walnutRoast: 2, flour: 2 }, output: { itemId: 'bakeDown_17', qty: 1 } },
  { id: 'bakeDown_18', name: '盐焗杏仁酥', category: '甜点', reqLevel: 44, xp: 528, successChance: 0.7, ingredients: { almondRoast: 2, flour: 2 }, output: { itemId: 'bakeDown_18', qty: 1 } },
  { id: 'bakeDown_19', name: '梅子酱饼', category: '甜点', reqLevel: 44, xp: 528, successChance: 0.7, ingredients: { preserving_ext2_04: 2, flour: 2 }, output: { itemId: 'bakeDown_19', qty: 1 } },
  { id: 'bakeDown_20', name: '桃子酱点', category: '甜点', reqLevel: 44, xp: 528, successChance: 0.7, ingredients: { preserving_ext2_10: 2, flour: 2 }, output: { itemId: 'bakeDown_20', qty: 1 } },
  { id: 'bakeDown_21', name: '杏子酱糕', category: '甜点', reqLevel: 45, xp: 540, successChance: 0.7, ingredients: { preserving_ext2_11: 2, flour: 2 }, output: { itemId: 'bakeDown_21', qty: 1 } },
  { id: 'bakeDown_22', name: '枣泥酥', category: '甜点', reqLevel: 45, xp: 540, successChance: 0.7, ingredients: { preserving_ext2_18: 2, rice: 2 }, output: { itemId: 'bakeDown_22', qty: 1 } },
  { id: 'bakeDown_23', name: '莲蓉饼', category: '甜点', reqLevel: 45, xp: 540, successChance: 0.7, ingredients: { preserving_ext2_20: 2, rice: 2 }, output: { itemId: 'bakeDown_23', qty: 1 } },
  { id: 'bakeDown_24', name: '椰蓉点', category: '甜点', reqLevel: 45, xp: 540, successChance: 0.7, ingredients: { preserving_ext2_21: 2, rice: 2 }, output: { itemId: 'bakeDown_24', qty: 1 } },
  { id: 'bakeDown_25', name: '芝麻馅糕', category: '甜点', reqLevel: 46, xp: 552, successChance: 0.7, ingredients: { preserving_ext2_22: 2, rice: 2 }, output: { itemId: 'bakeDown_25', qty: 1 } },
  { id: 'bakeDown_26', name: '五仁馅酥', category: '甜点', reqLevel: 46, xp: 552, successChance: 0.7, ingredients: { preserving_ext2_23: 2, rice: 2 }, output: { itemId: 'bakeDown_26', qty: 1 } },
]

export class BakingSkill extends ProductionSkill {
  constructor(player) {
    super('baking', player, raiseRecipeLevels([...BAKING_RECIPES, ...PRODUCTION_EXT.baking, ...PRODUCTION_EXT2.baking]))
  }
}
