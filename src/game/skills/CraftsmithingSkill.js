// 厨具锻造（Craftsmithing）— 需求文档 §3.2.6 / §5
// 金属矿（挖掘附产物）+ 木材（采摘附产物）→ 厨具装备。
// 装备槽位（§5.1）：刀具→weapon、锅具/砧板→offhand、围裙→body、厨师帽→helmet、调味瓶→amulet。
// 品质（§5.2）：当前为普通（铜/铁制），精良及以上后续迭代。

import { ProductionSkill } from './ProductionSkill.js'
import { SMITHING_EXT } from '../data/expansion1.js'
import { SMITHING_EXT2 } from '../data/expansion2.js'
import { SMITHING_SET_RECIPES } from '../data/smithSetExt.js'
import { balanceRecipeLevels } from './recipeBalance.js'

export const SMITHING_RECIPES = [
  // 铜制（L1-12）
  { id: 'copperKnife', name: '铜刀', category: '武器', reqLevel: 1, xp: 60, successChance: 0.95, ingredients: { wood: 2, copperOre: 2 }, output: { itemId: 'copperKnife', qty: 1 } },
  { id: 'copperPot', name: '铜锅', category: '副手', reqLevel: 3, xp: 80, successChance: 0.93, ingredients: { copperOre: 3, wood: 1 }, output: { itemId: 'copperPot', qty: 1 } },
  { id: 'copperBoard', name: '铜砧板', category: '副手', reqLevel: 5, xp: 95, successChance: 0.92, ingredients: { wood: 3, copperOre: 1 }, output: { itemId: 'copperBoard', qty: 1 } },
  { id: 'copperApron', name: '铜围裙', category: '身体', reqLevel: 8, xp: 120, successChance: 0.9, ingredients: { wood: 2, copperOre: 2 }, output: { itemId: 'copperApron', qty: 1 } },
  { id: 'copperHat', name: '铜厨师帽', category: '头盔', reqLevel: 10, xp: 140, successChance: 0.89, ingredients: { copperOre: 2, saltOre: 1 }, output: { itemId: 'copperHat', qty: 1 } },
  { id: 'copperBottle', name: '铜调味瓶', category: '饰品', reqLevel: 12, xp: 160, successChance: 0.88, ingredients: { copperOre: 2, wood: 1, saltOre: 1 }, output: { itemId: 'copperBottle', qty: 1 } },
  // 铁制（L30-40）
  { id: 'ironKnife', name: '铁刀', category: '武器', reqLevel: 30, xp: 320, successChance: 0.85, ingredients: { wood: 4, ironOre: 3 }, output: { itemId: 'ironKnife', qty: 1 } },
  { id: 'ironPot', name: '铁锅', category: '副手', reqLevel: 32, xp: 350, successChance: 0.84, ingredients: { ironOre: 4, wood: 2 }, output: { itemId: 'ironPot', qty: 1 } },
  { id: 'ironBoard', name: '铁砧板', category: '副手', reqLevel: 34, xp: 380, successChance: 0.83, ingredients: { wood: 5, ironOre: 2 }, output: { itemId: 'ironBoard', qty: 1 } },
  { id: 'ironApron', name: '铁围裙', category: '身体', reqLevel: 36, xp: 410, successChance: 0.82, ingredients: { wood: 4, ironOre: 3 }, output: { itemId: 'ironApron', qty: 1 } },
  { id: 'ironHat', name: '铁厨师帽', category: '头盔', reqLevel: 38, xp: 440, successChance: 0.81, ingredients: { ironOre: 3, saltOre: 2 }, output: { itemId: 'ironHat', qty: 1 } },
  { id: 'ironBottle', name: '铁调味瓶', category: '饰品', reqLevel: 40, xp: 470, successChance: 0.8, ingredients: { ironOre: 3, wood: 2, saltOre: 1 }, output: { itemId: 'ironBottle', qty: 1 } },
  // 钢制（L50-56，精良）
  { id: 'steelKnife', name: '钢刀', category: '武器', reqLevel: 50, xp: 650, successChance: 0.78, ingredients: { ironOre: 5, saltOre: 2, wood: 3 }, output: { itemId: 'steelKnife', qty: 1 } },
  { id: 'steelPot', name: '钢锅', category: '副手', reqLevel: 52, xp: 690, successChance: 0.77, ingredients: { ironOre: 5, saltOre: 2, wood: 2 }, output: { itemId: 'steelPot', qty: 1 } },
  { id: 'steelBoard', name: '钢砧板', category: '副手', reqLevel: 53, xp: 710, successChance: 0.76, ingredients: { ironOre: 5, saltOre: 2, wood: 4 }, output: { itemId: 'steelBoard', qty: 1 } },
  { id: 'steelApron', name: '钢围裙', category: '身体', reqLevel: 54, xp: 730, successChance: 0.76, ingredients: { ironOre: 5, saltOre: 2, wood: 3 }, output: { itemId: 'steelApron', qty: 1 } },
  { id: 'steelHat', name: '钢厨师帽', category: '头盔', reqLevel: 55, xp: 750, successChance: 0.75, ingredients: { ironOre: 5, saltOre: 3 }, output: { itemId: 'steelHat', qty: 1 } },
  { id: 'steelBottle', name: '钢调味瓶', category: '饰品', reqLevel: 56, xp: 770, successChance: 0.75, ingredients: { ironOre: 5, saltOre: 2, wood: 2 }, output: { itemId: 'steelBottle', qty: 1 } },
  // 银制（L62-70，精良）
  { id: 'silverKnife', name: '银刀', category: '武器', reqLevel: 62, xp: 920, successChance: 0.72, ingredients: { ironOre: 7, saltOre: 3, truffle: 1 }, output: { itemId: 'silverKnife', qty: 1 } },
  { id: 'silverPot', name: '银锅', category: '副手', reqLevel: 64, xp: 960, successChance: 0.71, ingredients: { ironOre: 7, saltOre: 3, truffle: 1 }, output: { itemId: 'silverPot', qty: 1 } },
  { id: 'silverBoard', name: '银砧板', category: '副手', reqLevel: 65, xp: 980, successChance: 0.71, ingredients: { ironOre: 7, saltOre: 3, wood: 4 }, output: { itemId: 'silverBoard', qty: 1 } },
  { id: 'silverApron', name: '银围裙', category: '身体', reqLevel: 66, xp: 1000, successChance: 0.7, ingredients: { ironOre: 7, saltOre: 3, truffle: 1 }, output: { itemId: 'silverApron', qty: 1 } },
  { id: 'silverHat', name: '银厨师帽', category: '头盔', reqLevel: 68, xp: 1040, successChance: 0.7, ingredients: { ironOre: 7, saltOre: 4 }, output: { itemId: 'silverHat', qty: 1 } },
  { id: 'silverBottle', name: '银调味瓶', category: '饰品', reqLevel: 70, xp: 1080, successChance: 0.69, ingredients: { ironOre: 7, saltOre: 3, truffle: 1 }, output: { itemId: 'silverBottle', qty: 1 } },
  // 金制（L74-82，稀有）
  { id: 'goldKnife', name: '金刀', category: '武器', reqLevel: 74, xp: 1250, successChance: 0.66, ingredients: { ironOre: 10, saltOre: 4, spiritFruit: 1 }, output: { itemId: 'goldKnife', qty: 1 } },
  { id: 'goldPot', name: '金锅', category: '副手', reqLevel: 76, xp: 1300, successChance: 0.65, ingredients: { ironOre: 10, saltOre: 4, spiritFruit: 1 }, output: { itemId: 'goldPot', qty: 1 } },
  { id: 'goldBoard', name: '金砧板', category: '副手', reqLevel: 77, xp: 1330, successChance: 0.65, ingredients: { ironOre: 10, saltOre: 4, wood: 5 }, output: { itemId: 'goldBoard', qty: 1 } },
  { id: 'goldApron', name: '金围裙', category: '身体', reqLevel: 78, xp: 1360, successChance: 0.64, ingredients: { ironOre: 10, saltOre: 4, spiritFruit: 1 }, output: { itemId: 'goldApron', qty: 1 } },
  { id: 'goldHat', name: '金厨师帽', category: '头盔', reqLevel: 80, xp: 1420, successChance: 0.63, ingredients: { ironOre: 10, saltOre: 5 }, output: { itemId: 'goldHat', qty: 1 } },
  { id: 'goldBottle', name: '金调味瓶', category: '饰品', reqLevel: 82, xp: 1480, successChance: 0.62, ingredients: { ironOre: 10, saltOre: 4, spiritFruit: 1 }, output: { itemId: 'goldBottle', qty: 1 } },
  // 水晶制（L86-94，史诗）
  { id: 'crystalKnife', name: '水晶刀', category: '武器', reqLevel: 86, xp: 1750, successChance: 0.58, ingredients: { ironOre: 12, saltOre: 5, spiritFruit: 2, truffle: 1 }, output: { itemId: 'crystalKnife', qty: 1 } },
  { id: 'crystalPot', name: '水晶锅', category: '副手', reqLevel: 88, xp: 1820, successChance: 0.57, ingredients: { ironOre: 12, saltOre: 5, spiritFruit: 2, truffle: 1 }, output: { itemId: 'crystalPot', qty: 1 } },
  { id: 'crystalBoard', name: '水晶砧板', category: '副手', reqLevel: 89, xp: 1860, successChance: 0.56, ingredients: { ironOre: 12, saltOre: 5, spiritFruit: 2, wood: 5 }, output: { itemId: 'crystalBoard', qty: 1 } },
  { id: 'crystalApron', name: '水晶围裙', category: '身体', reqLevel: 90, xp: 1900, successChance: 0.56, ingredients: { ironOre: 12, saltOre: 5, spiritFruit: 2, truffle: 1 }, output: { itemId: 'crystalApron', qty: 1 } },
  { id: 'crystalHat', name: '水晶厨师帽', category: '头盔', reqLevel: 92, xp: 1980, successChance: 0.55, ingredients: { ironOre: 12, saltOre: 6 }, output: { itemId: 'crystalHat', qty: 1 } },
  { id: 'crystalBottle', name: '水晶调味瓶', category: '饰品', reqLevel: 94, xp: 2060, successChance: 0.54, ingredients: { ironOre: 12, saltOre: 5, spiritFruit: 2, truffle: 1 }, output: { itemId: 'crystalBottle', qty: 1 } },
  // ── 批量场景B：矿石 → 锻造装备/饰品（craftsmithing，清空 mineral）──
  { id: 'amethystRing', name: '紫水晶戒指', category: '饰品', reqLevel: 43, xp: 290, successChance: 0.8, ingredients: { excavation_ext2_13: 2, saltOre: 1 }, output: { itemId: 'amethystRing', qty: 1 } },
  { id: 'turquoiseRing', name: '绿松石戒指', category: '饰品', reqLevel: 46, xp: 320, successChance: 0.79, ingredients: { excavation_ext2_14: 2, saltOre: 1 }, output: { itemId: 'turquoiseRing', qty: 1 } },
  { id: 'rubyRing', name: '红宝石戒指', category: '饰品', reqLevel: 50, xp: 355, successChance: 0.78, ingredients: { excavation_ext2_15: 2, saltOre: 1 }, output: { itemId: 'rubyRing', qty: 1 } },
  { id: 'emeraldRing', name: '祖母绿戒指', category: '饰品', reqLevel: 53, xp: 385, successChance: 0.77, ingredients: { excavation_ext2_16: 2, saltOre: 1 }, output: { itemId: 'emeraldRing', qty: 1 } },
  { id: 'diamondRing', name: '钻石戒指', category: '饰品', reqLevel: 57, xp: 425, successChance: 0.76, ingredients: { excavation_ext2_17: 2, saltOre: 1 }, output: { itemId: 'diamondRing', qty: 1 } },
  { id: 'tinAmulet', name: '锡护符', category: '饰品', reqLevel: 67, xp: 550, successChance: 0.73, ingredients: { excavation_ext2_20: 2, saltOre: 1 }, output: { itemId: 'tinAmulet', qty: 1 } },
  { id: 'leadAmulet', name: '铅护符', category: '饰品', reqLevel: 70, xp: 600, successChance: 0.72, ingredients: { excavation_ext2_21: 2, saltOre: 1 }, output: { itemId: 'leadAmulet', qty: 1 } },
  { id: 'zincAmulet', name: '锌护符', category: '饰品', reqLevel: 73, xp: 640, successChance: 0.71, ingredients: { excavation_ext2_22: 2, saltOre: 1 }, output: { itemId: 'zincAmulet', qty: 1 } },
  { id: 'nickelAmulet', name: '镍护符', category: '饰品', reqLevel: 77, xp: 700, successChance: 0.7, ingredients: { excavation_ext2_23: 2, saltOre: 1 }, output: { itemId: 'nickelAmulet', qty: 1 } },
  { id: 'cobaltAmulet', name: '钴护符', category: '饰品', reqLevel: 80, xp: 760, successChance: 0.69, ingredients: { excavation_ext2_24: 2, saltOre: 1 }, output: { itemId: 'cobaltAmulet', qty: 1 } },
  { id: 'tungstenAmulet', name: '钨护符', category: '饰品', reqLevel: 84, xp: 840, successChance: 0.67, ingredients: { excavation_ext2_25: 2, saltOre: 1 }, output: { itemId: 'tungstenAmulet', qty: 1 } },
  { id: 'titaniumAmulet', name: '钛护符', category: '饰品', reqLevel: 87, xp: 900, successChance: 0.66, ingredients: { excavation_ext2_26: 2, saltOre: 1 }, output: { itemId: 'titaniumAmulet', qty: 1 } },
  { id: 'manganeseAmulet', name: '锰护符', category: '饰品', reqLevel: 90, xp: 960, successChance: 0.65, ingredients: { excavation_ext2_27: 2, saltOre: 1 }, output: { itemId: 'manganeseAmulet', qty: 1 } },
  { id: 'vanadiumAmulet', name: '钒护符', category: '饰品', reqLevel: 94, xp: 1050, successChance: 0.63, ingredients: { excavation_ext2_28: 2, saltOre: 1 }, output: { itemId: 'vanadiumAmulet', qty: 1 } },
  { id: 'graphiteAmulet', name: '石墨护符', category: '饰品', reqLevel: 97, xp: 1130, successChance: 0.62, ingredients: { excavation_ext2_29: 2, saltOre: 1 }, output: { itemId: 'graphiteAmulet', qty: 1 } },
  { id: 'fluoriteRing', name: '萤石戒指', category: '饰品', reqLevel: 99, xp: 1200, successChance: 0.6, ingredients: { excavation_ext2_30: 2, saltOre: 1 }, output: { itemId: 'fluoriteRing', qty: 1 } },
  { id: 'gypsumAmulet', name: '石膏护符', category: '饰品', reqLevel: 73, xp: 640, successChance: 0.71, ingredients: { excavation_ext_22: 2, saltOre: 1 }, output: { itemId: 'gypsumAmulet', qty: 1 } },
  { id: 'saltpeterAmulet', name: '硝石护符', category: '饰品', reqLevel: 77, xp: 700, successChance: 0.7, ingredients: { excavation_ext_23: 2, saltOre: 1 }, output: { itemId: 'saltpeterAmulet', qty: 1 } },
  { id: 'sulfurAmulet', name: '硫磺护符', category: '饰品', reqLevel: 80, xp: 760, successChance: 0.69, ingredients: { excavation_ext_24: 2, saltOre: 1 }, output: { itemId: 'sulfurAmulet', qty: 1 } },
  { id: 'alumAmulet', name: '明矾护符', category: '饰品', reqLevel: 84, xp: 840, successChance: 0.67, ingredients: { excavation_ext_25: 2, saltOre: 1 }, output: { itemId: 'alumAmulet', qty: 1 } },
  { id: 'micaAmulet', name: '云母护符', category: '饰品', reqLevel: 87, xp: 900, successChance: 0.66, ingredients: { excavation_ext_26: 2, saltOre: 1 }, output: { itemId: 'micaAmulet', qty: 1 } },
  { id: 'quartzAmulet', name: '石英护符', category: '饰品', reqLevel: 90, xp: 960, successChance: 0.65, ingredients: { excavation_ext_27: 2, saltOre: 1 }, output: { itemId: 'quartzAmulet', qty: 1 } },
  { id: 'jadeRing', name: '翡翠戒指', category: '饰品', reqLevel: 94, xp: 1050, successChance: 0.63, ingredients: { excavation_ext_28: 2, saltOre: 1 }, output: { itemId: 'jadeRing', qty: 1 } },
  { id: 'agateRing', name: '玛瑙戒指', category: '饰品', reqLevel: 97, xp: 1130, successChance: 0.62, ingredients: { excavation_ext_29: 2, saltOre: 1 }, output: { itemId: 'agateRing', qty: 1 } },
  { id: 'sapphireRing', name: '蓝晶戒指', category: '饰品', reqLevel: 99, xp: 1200, successChance: 0.6, ingredients: { excavation_ext_30: 2, saltOre: 1 }, output: { itemId: 'sapphireRing', qty: 1 } },
]

export class CraftsmithingSkill extends ProductionSkill {
  constructor(player) {
    super('craftsmithing', player, balanceRecipeLevels(SMITHING_SET_RECIPES))
  }
}
