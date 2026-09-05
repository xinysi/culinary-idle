// 调料调配（Spice Mixing）— 需求文档 §3.2.5
// 基础调料（食盐）+ 香料作物 → 复合调料（高级料理原料）；
// 「神秘调料」为随机效果特殊道具（对决系统接入后生效）。

import { ProductionSkill } from './ProductionSkill.js'
import { PRODUCTION_EXT } from '../data/expansion1.js'
import { PRODUCTION_EXT2 } from '../data/expansion2.js'
import { raiseRecipeLevels } from './recipeBalance.js'

export const SPICE_RECIPES = [
  { id: 'salt', name: '食盐', category: '基础调料', reqLevel: 1, xp: 20, successChance: 1.0, ingredients: { saltOre: 1 }, output: { itemId: 'salt', qty: 2 } },
  { id: 'pepperSalt', name: '椒盐', category: '复合调料', reqLevel: 10, xp: 65, successChance: 0.9, ingredients: { salt: 1, peppercorn: 1 }, output: { itemId: 'pepperSalt', qty: 1 } },
  { id: 'fiveSpice', name: '五香粉', category: '复合调料', reqLevel: 20, xp: 130, successChance: 0.85, ingredients: { salt: 1, peppercorn: 1, starAnise: 1, cassia: 1 }, output: { itemId: 'fiveSpice', qty: 1 } },
  { id: 'chiliPowder', name: '辣椒粉', category: '复合调料', reqLevel: 25, xp: 150, successChance: 0.86, ingredients: { chili: 2, salt: 1 }, output: { itemId: 'chiliPowder', qty: 1 } },
  { id: 'curryPowder', name: '咖喱粉', category: '复合调料', reqLevel: 35, xp: 220, successChance: 0.82, ingredients: { starAnise: 1, cassia: 1, chili: 1, garlic: 1 }, output: { itemId: 'curryPowder', qty: 1 } },
  { id: 'bbqPowder', name: '烧烤粉', category: '复合调料', reqLevel: 45, xp: 300, successChance: 0.8, ingredients: { salt: 1, peppercorn: 1, chili: 1, rosemary: 1 }, output: { itemId: 'bbqPowder', qty: 1 } },
  { id: 'mysterySpice', name: '神秘调料', category: '特殊', reqLevel: 50, xp: 350, successChance: 0.7, ingredients: { salt: 2, peppercorn: 1, starAnise: 1, chili: 1 }, output: { itemId: 'mysterySpice', qty: 1 } },
  { id: 'herbSalt', name: '香草盐', category: '复合调料', reqLevel: 55, xp: 380, successChance: 0.79, ingredients: { salt: 1, vanilla: 1 }, output: { itemId: 'herbSalt', qty: 1 } },
  { id: 'saffronPowder', name: '藏红花粉', category: '复合调料', reqLevel: 70, xp: 560, successChance: 0.72, ingredients: { saffron: 2, salt: 1 }, output: { itemId: 'saffronPowder', qty: 1 } },
  { id: 'riceVinegar', name: '米醋', category: '复合调料', reqLevel: 15, xp: 100, successChance: 0.85, ingredients: { rice: 2, yeast: 1 }, output: { itemId: 'riceVinegar', qty: 1 } },
  { id: 'whitePepper', name: '白胡椒粉', category: '复合调料', reqLevel: 28, xp: 170, successChance: 0.83, ingredients: { peppercorn: 2, salt: 1 }, output: { itemId: 'whitePepper', qty: 1 } },
  { id: 'garlicPowder', name: '蒜粉', category: '复合调料', reqLevel: 32, xp: 200, successChance: 0.82, ingredients: { garlic: 3, salt: 1 }, output: { itemId: 'garlicPowder', qty: 1 } },
  { id: 'gingerPowder', name: '姜粉', category: '复合调料', reqLevel: 44, xp: 290, successChance: 0.8, ingredients: { ginger: 3, salt: 1 }, output: { itemId: 'gingerPowder', qty: 1 } },
  { id: 'masterPowder', name: '万能高汤粉', category: '复合调料', reqLevel: 60, xp: 460, successChance: 0.72, ingredients: { salt: 2, vanilla: 1, lingzhi: 1, ginseng: 1 }, output: { itemId: 'masterPowder', qty: 1 } },
  { id: 'dragonSalt', name: '龙息椒盐', category: '复合调料', reqLevel: 80, xp: 700, successChance: 0.68, ingredients: { dragonPepper: 2, salt: 1 }, output: { itemId: 'dragonSalt', qty: 1 } },
  // ── 批量场景B：根茎药材 → 药膳调料粉（消耗未被配方的root）──
  { id: 'banxiaPowder', name: '半夏粉', category: '药膳调料', reqLevel: 8, xp: 50, successChance: 0.9, ingredients: { excavation_ext2_01: 2, salt: 1 }, output: { itemId: 'banxiaPowder', qty: 1 } },
  { id: 'kushenPowder', name: '苦参粉', category: '药膳调料', reqLevel: 12, xp: 70, successChance: 0.89, ingredients: { excavation_ext2_02: 2, salt: 1 }, output: { itemId: 'kushenPowder', qty: 1 } },
  { id: 'fangfengPowder', name: '防风粉', category: '药膳调料', reqLevel: 15, xp: 88, successChance: 0.88, ingredients: { excavation_ext2_04: 2, salt: 1 }, output: { itemId: 'fangfengPowder', qty: 1 } },
  { id: 'cangzhuPowder', name: '苍术粉', category: '药膳调料', reqLevel: 18, xp: 104, successChance: 0.87, ingredients: { excavation_ext2_05: 2, salt: 1 }, output: { itemId: 'cangzhuPowder', qty: 1 } },
  { id: 'houpuPowder', name: '厚朴粉', category: '药膳调料', reqLevel: 21, xp: 122, successChance: 0.86, ingredients: { excavation_ext2_06: 2, salt: 1 }, output: { itemId: 'houpuPowder', qty: 1 } },
  { id: 'duzhongPowder', name: '杜仲粉', category: '药膳调料', reqLevel: 25, xp: 145, successChance: 0.85, ingredients: { excavation_ext2_07: 2, salt: 1 }, output: { itemId: 'duzhongPowder', qty: 1 } },
  { id: 'wuweiziPowder', name: '五味子粉', category: '药膳调料', reqLevel: 32, xp: 185, successChance: 0.83, ingredients: { excavation_ext2_09: 2, salt: 1 }, output: { itemId: 'wuweiziPowder', qty: 1 } },
  { id: 'jinyingziPowder', name: '金樱子粉', category: '药膳调料', reqLevel: 35, xp: 205, successChance: 0.82, ingredients: { excavation_ext2_10: 2, salt: 1 }, output: { itemId: 'jinyingziPowder', qty: 1 } },
  { id: 'shanzhuyuPowder', name: '山茱萸粉', category: '药膳调料', reqLevel: 38, xp: 225, successChance: 0.82, ingredients: { excavation_ext2_11: 2, salt: 1 }, output: { itemId: 'shanzhuyuPowder', qty: 1 } },
  { id: 'wuzhuyuPowder', name: '吴茱萸粉', category: '药膳调料', reqLevel: 42, xp: 250, successChance: 0.81, ingredients: { excavation_ext2_12: 2, salt: 1 }, output: { itemId: 'wuzhuyuPowder', qty: 1 } },
  { id: 'baizhuPowder', name: '白术粉', category: '药膳调料', reqLevel: 45, xp: 270, successChance: 0.8, ingredients: { excavation_ext_13: 2, salt: 1 }, output: { itemId: 'baizhuPowder', qty: 1 } },
  { id: 'huangqiPowder', name: '黄芪粉', category: '药膳调料', reqLevel: 48, xp: 290, successChance: 0.79, ingredients: { excavation_ext_14: 2, salt: 1 }, output: { itemId: 'huangqiPowder', qty: 1 } },
  { id: 'dangguiPowder', name: '当归粉', category: '药膳调料', reqLevel: 52, xp: 320, successChance: 0.78, ingredients: { excavation_ext_15: 2, salt: 1 }, output: { itemId: 'dangguiPowder', qty: 1 } },
  { id: 'chuanxiongPowder', name: '川芎粉', category: '药膳调料', reqLevel: 55, xp: 345, successChance: 0.77, ingredients: { excavation_ext_16: 2, salt: 1 }, output: { itemId: 'chuanxiongPowder', qty: 1 } },
  { id: 'maidongPowder', name: '麦冬粉', category: '药膳调料', reqLevel: 60, xp: 380, successChance: 0.75, ingredients: { excavation_ext_17: 2, salt: 1 }, output: { itemId: 'maidongPowder', qty: 1 } },
  { id: 'tianmaPowder', name: '天麻粉', category: '药膳调料', reqLevel: 62, xp: 400, successChance: 0.74, ingredients: { excavation_ext_18: 2, salt: 1 }, output: { itemId: 'tianmaPowder', qty: 1 } },
  { id: 'shihuPowder', name: '石斛粉', category: '药膳调料', reqLevel: 64, xp: 420, successChance: 0.73, ingredients: { excavation_ext_19: 2, salt: 1 }, output: { itemId: 'shihuPowder', qty: 1 } },
  { id: 'huangjingPowder', name: '黄精粉', category: '药膳调料', reqLevel: 68, xp: 450, successChance: 0.72, ingredients: { excavation_ext_20: 2, salt: 1 }, output: { itemId: 'huangjingPowder', qty: 1 } },
  { id: 'baizhiPowder', name: '白芷粉', category: '药膳调料', reqLevel: 70, xp: 470, successChance: 0.71, ingredients: { excavation_ext_21: 2, salt: 1 }, output: { itemId: 'baizhiPowder', qty: 1 } },
  { id: 'spiceFix_1', name: '柴胡粉', category: '药膳调料', reqLevel: 7, xp: 84, successChance: 0.8, ingredients: { excavation_ext2_03: 2, salt: 1 }, output: { itemId: 'spiceFix_1', qty: 1 } },
  { id: 'spiceFix_2', name: '女贞子粉', category: '药膳调料', reqLevel: 24, xp: 288, successChance: 0.8, ingredients: { excavation_ext2_08: 2, salt: 1 }, output: { itemId: 'spiceFix_2', qty: 1 } },
  { id: 'fossilSpice', name: '化石秘香粉', category: '药膳调料', reqLevel: 70, xp: 900, successChance: 0.66, ingredients: { fossilIngredient: 2, salt: 1 }, output: { itemId: 'fossilSpice', qty: 1 } },
]

export class SpiceMixingSkill extends ProductionSkill {
  constructor(player) {
    super('spiceMixing', player, raiseRecipeLevels([...SPICE_RECIPES, ...PRODUCTION_EXT.spiceMixing, ...PRODUCTION_EXT2.spiceMixing]))
  }
}
