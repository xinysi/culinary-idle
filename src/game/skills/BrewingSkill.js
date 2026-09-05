// 调酒（Brewing）— 需求文档 §3.2.4
// 水果/谷物 + 水 + 酵母 → 饮品：果汁（回血）、茶饮（调味能量）、酒类（增益 + 醉酒 负面效果）。
// 增益/drunk 字段在对决系统（§4.5）中生效；清水与酵母在杂货铺购买。

import { ProductionSkill } from './ProductionSkill.js'
import { PRODUCTION_EXT } from '../data/expansion1.js'
import { PRODUCTION_EXT2 } from '../data/expansion2.js'
import { raiseRecipeLevels } from './recipeBalance.js'

export const BREWING_RECIPES = [
  { id: 'appleJuice', name: '苹果汁', category: '果汁', reqLevel: 1, xp: 25, successChance: 0.92, ingredients: { apple: 3, water: 1 }, output: { itemId: 'appleJuice', qty: 1 } },
  { id: 'carrotJuice', name: '胡萝卜汁', category: '果汁', reqLevel: 8, xp: 55, successChance: 0.9, ingredients: { carrot: 3, water: 1 }, output: { itemId: 'carrotJuice', qty: 1 } },
  { id: 'herbalTea', name: '香草茶', category: '茶饮', reqLevel: 12, xp: 75, successChance: 0.88, ingredients: { vanilla: 1, water: 2 }, output: { itemId: 'herbalTea', qty: 1 } },
  { id: 'tomatoJuice', name: '番茄汁', category: '果汁', reqLevel: 15, xp: 95, successChance: 0.87, ingredients: { tomato: 3, water: 1 }, output: { itemId: 'tomatoJuice', qty: 1 } },
  { id: 'riceWine', name: '糯米酒', category: '酒类', reqLevel: 20, xp: 130, successChance: 0.82, ingredients: { rice: 3, yeast: 1, water: 2 }, output: { itemId: 'riceWine', qty: 1 } },
  { id: 'strawberryJuice', name: '草莓汁', category: '果汁', reqLevel: 25, xp: 160, successChance: 0.85, ingredients: { strawberry: 3, water: 1 }, output: { itemId: 'strawberryJuice', qty: 1 } },
  { id: 'fruitTea', name: '果茶', category: '茶饮', reqLevel: 30, xp: 195, successChance: 0.84, ingredients: { apple: 2, strawberry: 2, water: 2 }, output: { itemId: 'fruitTea', qty: 1 } },
  { id: 'grapeJuice', name: '葡萄汁', category: '果汁', reqLevel: 35, xp: 235, successChance: 0.83, ingredients: { grape: 3, water: 1 }, output: { itemId: 'grapeJuice', qty: 1 } },
  { id: 'appleCider', name: '苹果酒', category: '酒类', reqLevel: 40, xp: 280, successChance: 0.78, ingredients: { apple: 5, yeast: 1, water: 2 }, output: { itemId: 'appleCider', qty: 1 } },
  { id: 'wine', name: '葡萄酒', category: '酒类', reqLevel: 50, xp: 380, successChance: 0.75, ingredients: { grape: 5, yeast: 1, water: 2 }, output: { itemId: 'wine', qty: 1 } },
  { id: 'mangoWine', name: '芒果酒', category: '酒类', reqLevel: 60, xp: 500, successChance: 0.72, ingredients: { mango: 5, yeast: 1, water: 2 }, output: { itemId: 'mangoWine', qty: 1 } },
  { id: 'spiritBrew', name: '灵果酿', category: '酒类', reqLevel: 80, xp: 800, successChance: 0.65, ingredients: { spiritFruit: 3, yeast: 2, water: 3 }, output: { itemId: 'spiritBrew', qty: 1 } },
  { id: 'cornJuice', name: '玉米汁', category: '果汁', reqLevel: 18, xp: 110, successChance: 0.86, ingredients: { corn: 3, water: 1 }, output: { itemId: 'cornJuice', qty: 1 } },
  { id: 'gingerTea', name: '生姜茶', category: '茶饮', reqLevel: 22, xp: 140, successChance: 0.85, ingredients: { ginger: 2, water: 1 }, output: { itemId: 'gingerTea', qty: 1 } },
  { id: 'pumpkinJuice', name: '南瓜汁', category: '果汁', reqLevel: 32, xp: 210, successChance: 0.83, ingredients: { pumpkin: 2, water: 1 }, output: { itemId: 'pumpkinJuice', qty: 1 } },
  { id: 'pineappleJuice', name: '菠萝汁', category: '果汁', reqLevel: 42, xp: 290, successChance: 0.8, ingredients: { pineapple: 3, water: 1 }, output: { itemId: 'pineappleJuice', qty: 1 } },
  { id: 'sweetRiceWine', name: '米酒酿', category: '酒类', reqLevel: 45, xp: 320, successChance: 0.78, ingredients: { rice: 3, yeast: 1, water: 1 }, output: { itemId: 'sweetRiceWine', qty: 1 } },
  { id: 'yamJuice', name: '山药汁', category: '果汁', reqLevel: 50, xp: 370, successChance: 0.77, ingredients: { yam: 2, water: 1 }, output: { itemId: 'yamJuice', qty: 1 } },
  { id: 'dragonBreathWine', name: '龙息酒', category: '酒类', reqLevel: 90, xp: 1000, successChance: 0.6, ingredients: { dragonPepper: 2, yeast: 2, water: 3 }, output: { itemId: 'dragonBreathWine', qty: 1 } },
  // ── 批量场景B：新增果饮配方（消耗未被配方的采集水果）──
  { id: 'orangeJuice', name: '鲜橙汁', category: '果汁', reqLevel: 12, xp: 66, successChance: 0.89, ingredients: { foraging_ext_03: 3, water: 1 }, output: { itemId: 'orangeJuice', qty: 1 } },
  { id: 'pomeloTea', name: '柚子茶', category: '茶饮', reqLevel: 20, xp: 100, successChance: 0.86, ingredients: { foraging_ext_05: 2, water: 2 }, output: { itemId: 'pomeloTea', qty: 1 } },
  { id: 'cherryJuice', name: '樱桃汁', category: '果汁', reqLevel: 24, xp: 122, successChance: 0.86, ingredients: { foraging_ext_06: 3, water: 1 }, output: { itemId: 'cherryJuice', qty: 1 } },
  { id: 'blueberryJuice', name: '蓝莓汁', category: '果汁', reqLevel: 28, xp: 140, successChance: 0.85, ingredients: { foraging_ext_07: 3, water: 1 }, output: { itemId: 'blueberryJuice', qty: 1 } },
  { id: 'raspberryJuice', name: '覆盆子汁', category: '果汁', reqLevel: 30, xp: 152, successChance: 0.84, ingredients: { foraging_ext_08: 3, water: 1 }, output: { itemId: 'raspberryJuice', qty: 1 } },
  { id: 'kiwiJuice', name: '猕猴桃汁', category: '果汁', reqLevel: 34, xp: 172, successChance: 0.84, ingredients: { foraging_ext_09: 3, water: 1 }, output: { itemId: 'kiwiJuice', qty: 1 } },
  { id: 'pomegranateJuice', name: '石榴汁', category: '果汁', reqLevel: 38, xp: 195, successChance: 0.82, ingredients: { foraging_ext_10: 3, water: 1 }, output: { itemId: 'pomegranateJuice', qty: 1 } },
  { id: 'redDateTea', name: '红枣茶', category: '茶饮', reqLevel: 40, xp: 208, successChance: 0.82, ingredients: { foraging_ext_11: 3, water: 2 }, output: { itemId: 'redDateTea', qty: 1 } },
  { id: 'coconutJuice', name: '椰汁', category: '果汁', reqLevel: 42, xp: 218, successChance: 0.81, ingredients: { foraging_ext2_11: 3, water: 1 }, output: { itemId: 'coconutJuice', qty: 1 } },
  { id: 'lycheeJuice', name: '荔枝饮', category: '果汁', reqLevel: 46, xp: 240, successChance: 0.8, ingredients: { foraging_ext_14: 3, water: 1 }, output: { itemId: 'lycheeJuice', qty: 1 } },
  // ── 批量场景B：水果 → 果酒（消耗未被配方的 fruit）──
  { id: 'gojiWine', name: '枸杞酒', category: '酒类', reqLevel: 53, xp: 380, successChance: 0.78, ingredients: { foraging_ext2_16: 3, yeast: 1, water: 2 }, output: { itemId: 'gojiWine', qty: 1 } },
  { id: 'mulberryWine', name: '桑葚酒', category: '酒类', reqLevel: 57, xp: 425, successChance: 0.77, ingredients: { foraging_ext2_17: 3, yeast: 1, water: 2 }, output: { itemId: 'mulberryWine', qty: 1 } },
  { id: 'nectarineWine', name: '油桃酒', category: '酒类', reqLevel: 60, xp: 455, successChance: 0.76, ingredients: { foraging_ext2_18: 3, yeast: 1, water: 2 }, output: { itemId: 'nectarineWine', qty: 1 } },
  { id: 'peachWine', name: '蟠桃酒', category: '酒类', reqLevel: 63, xp: 500, successChance: 0.75, ingredients: { foraging_ext2_19: 3, yeast: 1, water: 2 }, output: { itemId: 'peachWine', qty: 1 } },
  { id: 'mandarinWine', name: '蜜柑酒', category: '酒类', reqLevel: 67, xp: 550, successChance: 0.74, ingredients: { foraging_ext2_20: 3, yeast: 1, water: 2 }, output: { itemId: 'mandarinWine', qty: 1 } },
  { id: 'kumquatWine', name: '金桔酒', category: '酒类', reqLevel: 70, xp: 600, successChance: 0.73, ingredients: { foraging_ext2_21: 3, yeast: 1, water: 2 }, output: { itemId: 'kumquatWine', qty: 1 } },
  { id: 'bergamotWine', name: '佛手柑酒', category: '酒类', reqLevel: 73, xp: 640, successChance: 0.72, ingredients: { foraging_ext2_22: 3, yeast: 1, water: 2 }, output: { itemId: 'bergamotWine', qty: 1 } },
  { id: 'custardAppleWine', name: '番荔枝酒', category: '酒类', reqLevel: 77, xp: 700, successChance: 0.7, ingredients: { foraging_ext2_23: 3, yeast: 1, water: 2 }, output: { itemId: 'custardAppleWine', qty: 1 } },
  { id: 'sugarAppleWine', name: '释迦酒', category: '酒类', reqLevel: 80, xp: 760, successChance: 0.69, ingredients: { foraging_ext2_24: 3, yeast: 1, water: 2 }, output: { itemId: 'sugarAppleWine', qty: 1 } },
  { id: 'jackfruitWine', name: '菠萝蜜酒', category: '酒类', reqLevel: 84, xp: 840, successChance: 0.67, ingredients: { foraging_ext2_25: 3, yeast: 1, water: 2 }, output: { itemId: 'jackfruitWine', qty: 1 } },
  { id: 'ginsengFruitWine', name: '人参果酒', category: '酒类', reqLevel: 87, xp: 900, successChance: 0.66, ingredients: { foraging_ext2_26: 3, yeast: 1, water: 2 }, output: { itemId: 'ginsengFruitWine', qty: 1 } },
  { id: 'yaconWine', name: '雪莲果酒', category: '酒类', reqLevel: 90, xp: 960, successChance: 0.65, ingredients: { foraging_ext2_27: 3, yeast: 1, water: 2 }, output: { itemId: 'yaconWine', qty: 1 } },
  { id: 'seaBuckthornWine', name: '沙棘酒', category: '酒类', reqLevel: 94, xp: 1050, successChance: 0.63, ingredients: { foraging_ext2_28: 3, yeast: 1, water: 2 }, output: { itemId: 'seaBuckthornWine', qty: 1 } },
  { id: 'oliveWine', name: '橄榄酒', category: '酒类', reqLevel: 97, xp: 1130, successChance: 0.62, ingredients: { foraging_ext2_29: 3, yeast: 1, water: 2 }, output: { itemId: 'oliveWine', qty: 1 } },
  { id: 'jujubeWine', name: '酸枣酒', category: '酒类', reqLevel: 99, xp: 1200, successChance: 0.6, ingredients: { foraging_ext2_30: 3, yeast: 1, water: 2 }, output: { itemId: 'jujubeWine', qty: 1 } },
  { id: 'brewFix_1', name: '桃子汁', category: '果汁', reqLevel: 1, xp: 12, successChance: 0.8, ingredients: { foraging_ext_01: 3, water: 1 }, output: { itemId: 'brewFix_1', qty: 1 } },
  { id: 'brewFix_2', name: '李子汁', category: '果汁', reqLevel: 4, xp: 48, successChance: 0.8, ingredients: { foraging_ext2_02: 3, water: 1 }, output: { itemId: 'brewFix_2', qty: 1 } },
  { id: 'brewFix_3', name: '杨桃汁', category: '果汁', reqLevel: 11, xp: 132, successChance: 0.8, ingredients: { foraging_ext2_04: 3, water: 1 }, output: { itemId: 'brewFix_3', qty: 1 } },
]

export class BrewingSkill extends ProductionSkill {
  constructor(player) {
    super('brewing', player, raiseRecipeLevels([...BREWING_RECIPES, ...PRODUCTION_EXT.brewing, ...PRODUCTION_EXT2.brewing]))
  }
}
