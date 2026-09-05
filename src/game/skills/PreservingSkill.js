// 腌制（Preserving）— 需求文档 §3.2.3
// 食材 + 盐 + 调料 → 腌制品与酱料；腌制品可长期保存（高级料理原料），
// 酱料是对决「增益道具」（增益 字段，§4.5，对决系统接入后生效）。

import { ProductionSkill } from './ProductionSkill.js'
import { PRODUCTION_EXT } from '../data/expansion1.js'
import { PRODUCTION_EXT2 } from '../data/expansion2.js'
import { raiseRecipeLevels } from './recipeBalance.js'

export const PRESERVING_RECIPES = [
  { id: 'pickledCabbage', name: '腌白菜', category: '腌制品', reqLevel: 1, xp: 25, successChance: 0.92, ingredients: { cabbage: 1, saltOre: 1 }, output: { itemId: 'pickledCabbage', qty: 1 } },
  { id: 'preservedEgg', name: '咸蛋', category: '腌制品', reqLevel: 8, xp: 55, successChance: 0.9, ingredients: { pheasantEgg: 3, saltOre: 1 }, output: { itemId: 'preservedEgg', qty: 1 } },
  { id: 'soySauce', name: '酱油', category: '酱料', reqLevel: 12, xp: 80, successChance: 0.88, ingredients: { wheat: 2, saltOre: 2 }, output: { itemId: 'soySauce', qty: 1 } },
  { id: 'doubanjiang', name: '豆瓣酱', category: '酱料', reqLevel: 15, xp: 95, successChance: 0.86, ingredients: { chili: 2, saltOre: 2, wheat: 1 }, output: { itemId: 'doubanjiang', qty: 1 } },
  { id: 'ketchup', name: '番茄酱', category: '酱料', reqLevel: 22, xp: 135, successChance: 0.84, ingredients: { tomato: 3, saltOre: 1 }, output: { itemId: 'ketchup', qty: 1 } },
  { id: 'kimchi', name: '泡菜', category: '腌制品', reqLevel: 25, xp: 155, successChance: 0.82, ingredients: { cabbage: 2, saltOre: 1, chili: 1 }, output: { itemId: 'kimchi', qty: 1 } },
  { id: 'bacon', name: '腊肉', category: '腌制品', reqLevel: 30, xp: 190, successChance: 0.8, ingredients: { boarMeat: 1, saltOre: 2 }, output: { itemId: 'bacon', qty: 1 } },
  { id: 'garlicPaste', name: '蒜蓉酱', category: '酱料', reqLevel: 40, xp: 265, successChance: 0.78, ingredients: { garlic: 3, saltOre: 2 }, output: { itemId: 'garlicPaste', qty: 1 } },
  { id: 'hotSauce', name: '辣椒酱', category: '酱料', reqLevel: 50, xp: 355, successChance: 0.75, ingredients: { chili: 3, garlic: 2, saltOre: 2 }, output: { itemId: 'hotSauce', qty: 1 } },
  { id: 'peppercornOil', name: '花椒油', category: '酱料', reqLevel: 55, xp: 410, successChance: 0.73, ingredients: { peppercorn: 3, saltOre: 1 }, output: { itemId: 'peppercornOil', qty: 1 } },
  { id: 'fishSauce', name: '鱼露', category: '酱料', reqLevel: 60, xp: 470, successChance: 0.72, ingredients: { carp: 3, saltOre: 3 }, output: { itemId: 'fishSauce', qty: 1 } },
  { id: 'truffleSauce', name: '松露酱', category: '酱料', reqLevel: 75, xp: 680, successChance: 0.65, ingredients: { truffle: 1, saltOre: 2 }, output: { itemId: 'truffleSauce', qty: 1 } },
  // ── 批量场景B：水果 → 果脯/蜜饯/果酱/炒货（消耗未被配方的 fruit）──
  { id: 'greenPlumPreserve', name: '青梅果脯', category: '果脯', reqLevel: 9, xp: 70, successChance: 0.89, ingredients: { foraging_ext2_03: 3, saltOre: 1 }, output: { itemId: 'greenPlumPreserve', qty: 1 } },
  { id: 'waxApplePreserve', name: '莲雾蜜饯', category: '蜜饯', reqLevel: 16, xp: 108, successChance: 0.87, ingredients: { foraging_ext2_05: 3, saltOre: 1 }, output: { itemId: 'waxApplePreserve', qty: 1 } },
  { id: 'passionFruitJam', name: '百香果酱', category: '果酱', reqLevel: 19, xp: 128, successChance: 0.86, ingredients: { foraging_ext2_06: 3, saltOre: 1 }, output: { itemId: 'passionFruitJam', qty: 1 } },
  { id: 'mangosteenPreserve', name: '山竹蜜饯', category: '蜜饯', reqLevel: 23, xp: 152, successChance: 0.85, ingredients: { foraging_ext2_07: 3, saltOre: 1 }, output: { itemId: 'mangosteenPreserve', qty: 1 } },
  { id: 'guavaJam', name: '番石榴酱', category: '果酱', reqLevel: 26, xp: 172, successChance: 0.84, ingredients: { foraging_ext2_08: 3, saltOre: 1 }, output: { itemId: 'guavaJam', qty: 1 } },
  { id: 'dragonFruitJam', name: '火龙果酱', category: '果酱', reqLevel: 30, xp: 200, successChance: 0.83, ingredients: { foraging_ext2_09: 3, saltOre: 1 }, output: { itemId: 'dragonFruitJam', qty: 1 } },
  { id: 'figPreserve', name: '无花果蜜饯', category: '蜜饯', reqLevel: 40, xp: 268, successChance: 0.8, ingredients: { foraging_ext_12: 3, saltOre: 1 }, output: { itemId: 'figPreserve', qty: 1 } },
  { id: 'cashewRoast', name: '盐焗腰果', category: '炒货', reqLevel: 40, xp: 268, successChance: 0.81, ingredients: { foraging_ext2_12: 3, saltOre: 1 }, output: { itemId: 'cashewRoast', qty: 1 } },
  { id: 'persimmonDry', name: '柿饼', category: '果干', reqLevel: 43, xp: 292, successChance: 0.8, ingredients: { foraging_ext_13: 3, saltOre: 1 }, output: { itemId: 'persimmonDry', qty: 1 } },
  { id: 'hazelnutRoast', name: '盐焗榛子', category: '炒货', reqLevel: 43, xp: 292, successChance: 0.8, ingredients: { foraging_ext2_13: 3, saltOre: 1 }, output: { itemId: 'hazelnutRoast', qty: 1 } },
  { id: 'pistachioRoast', name: '盐焗开心果', category: '炒货', reqLevel: 46, xp: 320, successChance: 0.79, ingredients: { foraging_ext2_14: 3, saltOre: 1 }, output: { itemId: 'pistachioRoast', qty: 1 } },
  { id: 'longanDry', name: '桂圆干', category: '果干', reqLevel: 50, xp: 355, successChance: 0.78, ingredients: { foraging_ext_15: 3, saltOre: 1 }, output: { itemId: 'longanDry', qty: 1 } },
  { id: 'pineNutRoast', name: '盐焗松子', category: '炒货', reqLevel: 50, xp: 355, successChance: 0.78, ingredients: { foraging_ext2_15: 3, saltOre: 1 }, output: { itemId: 'pineNutRoast', qty: 1 } },
  { id: 'loquatPreserve', name: '枇杷蜜饯', category: '蜜饯', reqLevel: 53, xp: 385, successChance: 0.77, ingredients: { foraging_ext_16: 3, saltOre: 1 }, output: { itemId: 'loquatPreserve', qty: 1 } },
  { id: 'hawthornPreserve', name: '山楂蜜饯', category: '蜜饯', reqLevel: 57, xp: 425, successChance: 0.76, ingredients: { foraging_ext_17: 3, saltOre: 1 }, output: { itemId: 'hawthornPreserve', qty: 1 } },
  // ── 批量场景B：坚果 → 炒货（preserving）──
  { id: 'chestnutRoast', name: '糖炒板栗', category: '炒货', reqLevel: 60, xp: 455, successChance: 0.76, ingredients: { foraging_ext_18: 3, saltOre: 2 }, output: { itemId: 'chestnutRoast', qty: 1 } },
  { id: 'walnutRoast', name: '琥珀核桃', category: '炒货', reqLevel: 63, xp: 500, successChance: 0.75, ingredients: { foraging_ext_19: 3, saltOre: 1 }, output: { itemId: 'walnutRoast', qty: 1 } },
  { id: 'almondRoast', name: '盐焗杏仁', category: '炒货', reqLevel: 67, xp: 550, successChance: 0.74, ingredients: { foraging_ext_20: 3, saltOre: 1 }, output: { itemId: 'almondRoast', qty: 1 } },
]

export class PreservingSkill extends ProductionSkill {
  constructor(player) {
    super('preserving', player, raiseRecipeLevels([...PRESERVING_RECIPES, ...PRODUCTION_EXT.preserving, ...PRODUCTION_EXT2.preserving]))
  }
}
