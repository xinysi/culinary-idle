// 厨具锻造品质套 + 独立矿套（生成器产出，勿手改）
// 覆盖：20 品质套 + 21 独立矿套，每套 8 槽（刀/锅/砧板/围裙/厨师帽/调味瓶/腿甲/靴子），
//       21 独立矿套另含手写的戒指/护符，共 9 件。
// 改后重跑：node scripts/gen_smith_sets.mjs
// ⚠️ 重跑前必须先清空本文件的两个导出（置 []）——生成器会 import ITEMS，
//    而 ITEMS 已合并上次的产物，不清空会因「已存在/重名」跳过全部条目（自引用污染）。
export const SMITHING_SET_RECIPES = [
 {
  "id": "铜-weapon-copperKnife",
  "name": "铜刀",
  "category": "武器",
  "reqLevel": 1,
  "xp": 60,
  "successChance": 0.95,
  "ingredients": {
   "wood": 2,
   "copperOre": 2
  },
  "output": {
   "itemId": "copperKnife",
   "qty": 1
  }
 },
 {
  "id": "铜-offhand-copperPot",
  "name": "铜锅",
  "category": "副手",
  "reqLevel": 2,
  "xp": 80,
  "successChance": 0.93,
  "ingredients": {
   "copperOre": 3,
   "wood": 1
  },
  "output": {
   "itemId": "copperPot",
   "qty": 1
  }
 },
 {
  "id": "铜-offhand-copperBoard",
  "name": "铜砧板",
  "category": "副手",
  "reqLevel": 2,
  "xp": 95,
  "successChance": 0.92,
  "ingredients": {
   "wood": 3,
   "copperOre": 1
  },
  "output": {
   "itemId": "copperBoard",
   "qty": 1
  }
 },
 {
  "id": "铜-body-copperApron",
  "name": "铜围裙",
  "category": "身体",
  "reqLevel": 3,
  "xp": 120,
  "successChance": 0.9,
  "ingredients": {
   "wood": 2,
   "copperOre": 2
  },
  "output": {
   "itemId": "copperApron",
   "qty": 1
  }
 },
 {
  "id": "铜-helmet-copperHat",
  "name": "铜厨师帽",
  "category": "头盔",
  "reqLevel": 4,
  "xp": 140,
  "successChance": 0.89,
  "ingredients": {
   "copperOre": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "copperHat",
   "qty": 1
  }
 },
 {
  "id": "铜-amulet-copperBottle",
  "name": "铜调味瓶",
  "category": "饰品",
  "reqLevel": 3,
  "xp": 160,
  "successChance": 0.88,
  "ingredients": {
   "copperOre": 2,
   "wood": 1,
   "saltOre": 1
  },
  "output": {
   "itemId": "copperBottle",
   "qty": 1
  }
 },
 {
  "id": "smith_set_铜_legs",
  "name": "铜腿甲",
  "category": "腿甲",
  "reqLevel": 4,
  "xp": 28,
  "successChance": 0.94,
  "ingredients": {
   "ironOre": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "smith_铜_legs",
   "qty": 1
  }
 },
 {
  "id": "smith_set_铜_boots",
  "name": "铜靴子",
  "category": "靴子",
  "reqLevel": 5,
  "xp": 28,
  "successChance": 0.94,
  "ingredients": {
   "ironOre": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "smith_铜_boots",
   "qty": 1
  }
 },
 {
  "id": "smith_set_铜_ring",
  "name": "铜戒指",
  "category": "戒指",
  "reqLevel": 5,
  "xp": 28,
  "successChance": 0.94,
  "ingredients": {
   "ironOre": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "smith_铜_ring",
   "qty": 1
  }
 },
 {
  "id": "铁-weapon-ironKnife",
  "name": "铁刀",
  "category": "武器",
  "reqLevel": 6,
  "xp": 320,
  "successChance": 0.85,
  "ingredients": {
   "wood": 4,
   "ironOre": 3
  },
  "output": {
   "itemId": "ironKnife",
   "qty": 1
  }
 },
 {
  "id": "铁-offhand-ironPot",
  "name": "铁锅",
  "category": "副手",
  "reqLevel": 7,
  "xp": 350,
  "successChance": 0.84,
  "ingredients": {
   "ironOre": 4,
   "wood": 2
  },
  "output": {
   "itemId": "ironPot",
   "qty": 1
  }
 },
 {
  "id": "铁-offhand-ironBoard",
  "name": "铁砧板",
  "category": "副手",
  "reqLevel": 7,
  "xp": 380,
  "successChance": 0.83,
  "ingredients": {
   "wood": 5,
   "ironOre": 2
  },
  "output": {
   "itemId": "ironBoard",
   "qty": 1
  }
 },
 {
  "id": "铁-body-ironApron",
  "name": "铁围裙",
  "category": "身体",
  "reqLevel": 8,
  "xp": 410,
  "successChance": 0.82,
  "ingredients": {
   "wood": 4,
   "ironOre": 3
  },
  "output": {
   "itemId": "ironApron",
   "qty": 1
  }
 },
 {
  "id": "铁-helmet-ironHat",
  "name": "铁厨师帽",
  "category": "头盔",
  "reqLevel": 9,
  "xp": 440,
  "successChance": 0.81,
  "ingredients": {
   "ironOre": 3,
   "saltOre": 2
  },
  "output": {
   "itemId": "ironHat",
   "qty": 1
  }
 },
 {
  "id": "铁-amulet-ironBottle",
  "name": "铁调味瓶",
  "category": "饰品",
  "reqLevel": 8,
  "xp": 470,
  "successChance": 0.8,
  "ingredients": {
   "ironOre": 3,
   "wood": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "ironBottle",
   "qty": 1
  }
 },
 {
  "id": "smith_set_铁_legs",
  "name": "铁腿甲",
  "category": "腿甲",
  "reqLevel": 9,
  "xp": 36,
  "successChance": 0.9299999999999999,
  "ingredients": {
   "ironOre": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "smith_铁_legs",
   "qty": 1
  }
 },
 {
  "id": "smith_set_铁_boots",
  "name": "铁靴子",
  "category": "靴子",
  "reqLevel": 10,
  "xp": 36,
  "successChance": 0.9299999999999999,
  "ingredients": {
   "ironOre": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "smith_铁_boots",
   "qty": 1
  }
 },
 {
  "id": "smith_set_铁_ring",
  "name": "铁戒指",
  "category": "戒指",
  "reqLevel": 10,
  "xp": 36,
  "successChance": 0.9299999999999999,
  "ingredients": {
   "ironOre": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "smith_铁_ring",
   "qty": 1
  }
 },
 {
  "id": "青铜-weapon-smith_rec_01",
  "name": "青铜刀",
  "category": "刀",
  "reqLevel": 11,
  "xp": 16,
  "successChance": 0.9,
  "ingredients": {
   "ironOre": 4,
   "saltOre": 2
  },
  "output": {
   "itemId": "smith_ext_01",
   "qty": 1
  }
 },
 {
  "id": "青铜-offhand-smith_rec_02",
  "name": "青铜锅",
  "category": "锅",
  "reqLevel": 12,
  "xp": 64,
  "successChance": 0.89,
  "ingredients": {
   "ironOre": 4,
   "saltOre": 2
  },
  "output": {
   "itemId": "smith_ext_02",
   "qty": 1
  }
 },
 {
  "id": "青铜-offhand-smith_rec_03",
  "name": "青铜砧板",
  "category": "砧板",
  "reqLevel": 12,
  "xp": 112,
  "successChance": 0.88,
  "ingredients": {
   "ironOre": 4,
   "saltOre": 2
  },
  "output": {
   "itemId": "smith_ext_03",
   "qty": 1
  }
 },
 {
  "id": "青铜-body-smith_rec_04",
  "name": "青铜围裙",
  "category": "围裙",
  "reqLevel": 13,
  "xp": 176,
  "successChance": 0.86,
  "ingredients": {
   "ironOre": 4,
   "saltOre": 2
  },
  "output": {
   "itemId": "smith_ext_04",
   "qty": 1
  }
 },
 {
  "id": "青铜-helmet-smith_rec_05",
  "name": "青铜厨师帽",
  "category": "厨师帽",
  "reqLevel": 14,
  "xp": 224,
  "successChance": 0.85,
  "ingredients": {
   "ironOre": 4,
   "saltOre": 2
  },
  "output": {
   "itemId": "smith_ext_05",
   "qty": 1
  }
 },
 {
  "id": "青铜-amulet-smith_rec_06",
  "name": "青铜调味瓶",
  "category": "调味瓶",
  "reqLevel": 13,
  "xp": 272,
  "successChance": 0.84,
  "ingredients": {
   "ironOre": 5,
   "saltOre": 2
  },
  "output": {
   "itemId": "smith_ext_06",
   "qty": 1
  }
 },
 {
  "id": "smith_set_青铜_legs",
  "name": "青铜腿甲",
  "category": "腿甲",
  "reqLevel": 14,
  "xp": 44,
  "successChance": 0.9199999999999999,
  "ingredients": {
   "ironOre": 3,
   "saltOre": 1
  },
  "output": {
   "itemId": "smith_青铜_legs",
   "qty": 1
  }
 },
 {
  "id": "smith_set_青铜_boots",
  "name": "青铜靴子",
  "category": "靴子",
  "reqLevel": 15,
  "xp": 44,
  "successChance": 0.9199999999999999,
  "ingredients": {
   "ironOre": 3,
   "saltOre": 1
  },
  "output": {
   "itemId": "smith_青铜_boots",
   "qty": 1
  }
 },
 {
  "id": "smith_set_青铜_ring",
  "name": "青铜戒指",
  "category": "戒指",
  "reqLevel": 15,
  "xp": 44,
  "successChance": 0.9199999999999999,
  "ingredients": {
   "ironOre": 3,
   "saltOre": 1
  },
  "output": {
   "itemId": "smith_青铜_ring",
   "qty": 1
  }
 },
 {
  "id": "钢-weapon-steelKnife",
  "name": "钢刀",
  "category": "武器",
  "reqLevel": 16,
  "xp": 650,
  "successChance": 0.78,
  "ingredients": {
   "saltOre": 2,
   "wood": 3,
   "steelOre": 5
  },
  "output": {
   "itemId": "steelKnife",
   "qty": 1
  }
 },
 {
  "id": "钢-offhand-steelPot",
  "name": "钢锅",
  "category": "副手",
  "reqLevel": 17,
  "xp": 690,
  "successChance": 0.77,
  "ingredients": {
   "saltOre": 2,
   "wood": 2,
   "steelOre": 5
  },
  "output": {
   "itemId": "steelPot",
   "qty": 1
  }
 },
 {
  "id": "钢-offhand-steelBoard",
  "name": "钢砧板",
  "category": "副手",
  "reqLevel": 17,
  "xp": 710,
  "successChance": 0.76,
  "ingredients": {
   "saltOre": 2,
   "wood": 4,
   "steelOre": 5
  },
  "output": {
   "itemId": "steelBoard",
   "qty": 1
  }
 },
 {
  "id": "钢-body-steelApron",
  "name": "钢围裙",
  "category": "身体",
  "reqLevel": 18,
  "xp": 730,
  "successChance": 0.76,
  "ingredients": {
   "saltOre": 2,
   "wood": 3,
   "steelOre": 5
  },
  "output": {
   "itemId": "steelApron",
   "qty": 1
  }
 },
 {
  "id": "钢-helmet-steelHat",
  "name": "钢厨师帽",
  "category": "头盔",
  "reqLevel": 19,
  "xp": 750,
  "successChance": 0.75,
  "ingredients": {
   "saltOre": 3,
   "steelOre": 5
  },
  "output": {
   "itemId": "steelHat",
   "qty": 1
  }
 },
 {
  "id": "钢-amulet-steelBottle",
  "name": "钢调味瓶",
  "category": "饰品",
  "reqLevel": 18,
  "xp": 770,
  "successChance": 0.75,
  "ingredients": {
   "saltOre": 2,
   "wood": 2,
   "steelOre": 5
  },
  "output": {
   "itemId": "steelBottle",
   "qty": 1
  }
 },
 {
  "id": "smith_set_钢_legs",
  "name": "钢腿甲",
  "category": "腿甲",
  "reqLevel": 19,
  "xp": 52,
  "successChance": 0.9099999999999999,
  "ingredients": {
   "steelOre": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "smith_钢_legs",
   "qty": 1
  }
 },
 {
  "id": "smith_set_钢_boots",
  "name": "钢靴子",
  "category": "靴子",
  "reqLevel": 20,
  "xp": 52,
  "successChance": 0.9099999999999999,
  "ingredients": {
   "steelOre": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "smith_钢_boots",
   "qty": 1
  }
 },
 {
  "id": "smith_set_钢_ring",
  "name": "钢戒指",
  "category": "戒指",
  "reqLevel": 20,
  "xp": 52,
  "successChance": 0.9099999999999999,
  "ingredients": {
   "steelOre": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "smith_钢_ring",
   "qty": 1
  }
 },
 {
  "id": "银-weapon-silverKnife",
  "name": "银刀",
  "category": "武器",
  "reqLevel": 21,
  "xp": 920,
  "successChance": 0.72,
  "ingredients": {
   "saltOre": 3,
   "silverOre": 7
  },
  "output": {
   "itemId": "silverKnife",
   "qty": 1
  }
 },
 {
  "id": "银-offhand-silverPot",
  "name": "银锅",
  "category": "副手",
  "reqLevel": 22,
  "xp": 960,
  "successChance": 0.71,
  "ingredients": {
   "saltOre": 3,
   "silverOre": 7
  },
  "output": {
   "itemId": "silverPot",
   "qty": 1
  }
 },
 {
  "id": "银-offhand-silverBoard",
  "name": "银砧板",
  "category": "副手",
  "reqLevel": 22,
  "xp": 980,
  "successChance": 0.71,
  "ingredients": {
   "saltOre": 3,
   "wood": 4,
   "silverOre": 7
  },
  "output": {
   "itemId": "silverBoard",
   "qty": 1
  }
 },
 {
  "id": "银-body-silverApron",
  "name": "银围裙",
  "category": "身体",
  "reqLevel": 23,
  "xp": 1000,
  "successChance": 0.7,
  "ingredients": {
   "saltOre": 3,
   "silverOre": 7
  },
  "output": {
   "itemId": "silverApron",
   "qty": 1
  }
 },
 {
  "id": "银-helmet-silverHat",
  "name": "银厨师帽",
  "category": "头盔",
  "reqLevel": 24,
  "xp": 1040,
  "successChance": 0.7,
  "ingredients": {
   "saltOre": 4,
   "silverOre": 7
  },
  "output": {
   "itemId": "silverHat",
   "qty": 1
  }
 },
 {
  "id": "银-amulet-silverBottle",
  "name": "银调味瓶",
  "category": "饰品",
  "reqLevel": 23,
  "xp": 1080,
  "successChance": 0.69,
  "ingredients": {
   "saltOre": 3,
   "silverOre": 7
  },
  "output": {
   "itemId": "silverBottle",
   "qty": 1
  }
 },
 {
  "id": "smith_set_银_legs",
  "name": "银腿甲",
  "category": "腿甲",
  "reqLevel": 24,
  "xp": 60,
  "successChance": 0.8999999999999999,
  "ingredients": {
   "silverOre": 3,
   "saltOre": 1
  },
  "output": {
   "itemId": "smith_银_legs",
   "qty": 1
  }
 },
 {
  "id": "smith_set_银_boots",
  "name": "银靴子",
  "category": "靴子",
  "reqLevel": 25,
  "xp": 60,
  "successChance": 0.8999999999999999,
  "ingredients": {
   "silverOre": 3,
   "saltOre": 1
  },
  "output": {
   "itemId": "smith_银_boots",
   "qty": 1
  }
 },
 {
  "id": "smith_set_银_ring",
  "name": "银戒指",
  "category": "戒指",
  "reqLevel": 25,
  "xp": 60,
  "successChance": 0.8999999999999999,
  "ingredients": {
   "silverOre": 3,
   "saltOre": 1
  },
  "output": {
   "itemId": "smith_银_ring",
   "qty": 1
  }
 },
 {
  "id": "秘银-weapon-smith_rec_07",
  "name": "秘银刀",
  "category": "刀",
  "reqLevel": 26,
  "xp": 336,
  "successChance": 0.83,
  "ingredients": {
   "saltOre": 2,
   "mithrilOre": 5
  },
  "output": {
   "itemId": "smith_ext_07",
   "qty": 1
  }
 },
 {
  "id": "秘银-offhand-smith_rec_08",
  "name": "秘银锅",
  "category": "锅",
  "reqLevel": 27,
  "xp": 384,
  "successChance": 0.82,
  "ingredients": {
   "saltOre": 2,
   "mithrilOre": 5
  },
  "output": {
   "itemId": "smith_ext_08",
   "qty": 1
  }
 },
 {
  "id": "秘银-offhand-smith_rec_09",
  "name": "秘银砧板",
  "category": "砧板",
  "reqLevel": 27,
  "xp": 448,
  "successChance": 0.8,
  "ingredients": {
   "saltOre": 2,
   "mithrilOre": 5
  },
  "output": {
   "itemId": "smith_ext_09",
   "qty": 1
  }
 },
 {
  "id": "秘银-body-smith_rec_10",
  "name": "秘银围裙",
  "category": "围裙",
  "reqLevel": 28,
  "xp": 496,
  "successChance": 0.79,
  "ingredients": {
   "saltOre": 2,
   "mithrilOre": 5
  },
  "output": {
   "itemId": "smith_ext_10",
   "qty": 1
  }
 },
 {
  "id": "秘银-helmet-smith_rec_11",
  "name": "秘银厨师帽",
  "category": "厨师帽",
  "reqLevel": 29,
  "xp": 544,
  "successChance": 0.78,
  "ingredients": {
   "saltOre": 2,
   "mithrilOre": 5
  },
  "output": {
   "itemId": "smith_ext_11",
   "qty": 1
  }
 },
 {
  "id": "秘银-amulet-smith_rec_12",
  "name": "秘银调味瓶",
  "category": "调味瓶",
  "reqLevel": 28,
  "xp": 608,
  "successChance": 0.77,
  "ingredients": {
   "saltOre": 2,
   "mithrilOre": 6
  },
  "output": {
   "itemId": "smith_ext_12",
   "qty": 1
  }
 },
 {
  "id": "smith_set_秘银_legs",
  "name": "秘银腿甲",
  "category": "腿甲",
  "reqLevel": 29,
  "xp": 68,
  "successChance": 0.8899999999999999,
  "ingredients": {
   "mithrilOre": 3,
   "saltOre": 2
  },
  "output": {
   "itemId": "smith_秘银_legs",
   "qty": 1
  }
 },
 {
  "id": "smith_set_秘银_boots",
  "name": "秘银靴子",
  "category": "靴子",
  "reqLevel": 30,
  "xp": 68,
  "successChance": 0.8899999999999999,
  "ingredients": {
   "mithrilOre": 3,
   "saltOre": 2
  },
  "output": {
   "itemId": "smith_秘银_boots",
   "qty": 1
  }
 },
 {
  "id": "smith_set_秘银_ring",
  "name": "秘银戒指",
  "category": "戒指",
  "reqLevel": 30,
  "xp": 68,
  "successChance": 0.8899999999999999,
  "ingredients": {
   "mithrilOre": 3,
   "saltOre": 2
  },
  "output": {
   "itemId": "smith_秘银_ring",
   "qty": 1
  }
 },
 {
  "id": "金-weapon-goldKnife",
  "name": "金刀",
  "category": "武器",
  "reqLevel": 31,
  "xp": 1250,
  "successChance": 0.66,
  "ingredients": {
   "saltOre": 4,
   "goldOre": 10
  },
  "output": {
   "itemId": "goldKnife",
   "qty": 1
  }
 },
 {
  "id": "金-offhand-goldPot",
  "name": "金锅",
  "category": "副手",
  "reqLevel": 32,
  "xp": 1300,
  "successChance": 0.65,
  "ingredients": {
   "saltOre": 4,
   "goldOre": 10
  },
  "output": {
   "itemId": "goldPot",
   "qty": 1
  }
 },
 {
  "id": "金-offhand-goldBoard",
  "name": "金砧板",
  "category": "副手",
  "reqLevel": 32,
  "xp": 1330,
  "successChance": 0.65,
  "ingredients": {
   "saltOre": 4,
   "wood": 5,
   "goldOre": 10
  },
  "output": {
   "itemId": "goldBoard",
   "qty": 1
  }
 },
 {
  "id": "金-body-goldApron",
  "name": "金围裙",
  "category": "身体",
  "reqLevel": 33,
  "xp": 1360,
  "successChance": 0.64,
  "ingredients": {
   "saltOre": 4,
   "goldOre": 10
  },
  "output": {
   "itemId": "goldApron",
   "qty": 1
  }
 },
 {
  "id": "金-helmet-goldHat",
  "name": "金厨师帽",
  "category": "头盔",
  "reqLevel": 34,
  "xp": 1420,
  "successChance": 0.63,
  "ingredients": {
   "saltOre": 5,
   "goldOre": 10
  },
  "output": {
   "itemId": "goldHat",
   "qty": 1
  }
 },
 {
  "id": "金-amulet-goldBottle",
  "name": "金调味瓶",
  "category": "饰品",
  "reqLevel": 33,
  "xp": 1480,
  "successChance": 0.62,
  "ingredients": {
   "saltOre": 4,
   "goldOre": 10
  },
  "output": {
   "itemId": "goldBottle",
   "qty": 1
  }
 },
 {
  "id": "smith_set_金_legs",
  "name": "金腿甲",
  "category": "腿甲",
  "reqLevel": 34,
  "xp": 76,
  "successChance": 0.8799999999999999,
  "ingredients": {
   "goldOre": 3,
   "saltOre": 2
  },
  "output": {
   "itemId": "smith_金_legs",
   "qty": 1
  }
 },
 {
  "id": "smith_set_金_boots",
  "name": "金靴子",
  "category": "靴子",
  "reqLevel": 35,
  "xp": 76,
  "successChance": 0.8799999999999999,
  "ingredients": {
   "goldOre": 3,
   "saltOre": 2
  },
  "output": {
   "itemId": "smith_金_boots",
   "qty": 1
  }
 },
 {
  "id": "smith_set_金_ring",
  "name": "金戒指",
  "category": "戒指",
  "reqLevel": 35,
  "xp": 76,
  "successChance": 0.8799999999999999,
  "ingredients": {
   "goldOre": 3,
   "saltOre": 2
  },
  "output": {
   "itemId": "smith_金_ring",
   "qty": 1
  }
 },
 {
  "id": "精金-weapon-smith_rec_13",
  "name": "精金刀",
  "category": "刀",
  "reqLevel": 36,
  "xp": 656,
  "successChance": 0.76,
  "ingredients": {
   "saltOre": 2,
   "adamantOre": 6
  },
  "output": {
   "itemId": "smith_ext_13",
   "qty": 1
  }
 },
 {
  "id": "精金-offhand-smith_rec_14",
  "name": "精金锅",
  "category": "锅",
  "reqLevel": 37,
  "xp": 704,
  "successChance": 0.75,
  "ingredients": {
   "saltOre": 2,
   "adamantOre": 6
  },
  "output": {
   "itemId": "smith_ext_14",
   "qty": 1
  }
 },
 {
  "id": "精金-offhand-smith_rec_15",
  "name": "精金砧板",
  "category": "砧板",
  "reqLevel": 37,
  "xp": 768,
  "successChance": 0.73,
  "ingredients": {
   "saltOre": 2,
   "adamantOre": 6
  },
  "output": {
   "itemId": "smith_ext_15",
   "qty": 1
  }
 },
 {
  "id": "精金-body-smith_rec_16",
  "name": "精金围裙",
  "category": "围裙",
  "reqLevel": 38,
  "xp": 816,
  "successChance": 0.72,
  "ingredients": {
   "saltOre": 2,
   "adamantOre": 6
  },
  "output": {
   "itemId": "smith_ext_16",
   "qty": 1
  }
 },
 {
  "id": "精金-helmet-smith_rec_17",
  "name": "精金厨师帽",
  "category": "厨师帽",
  "reqLevel": 39,
  "xp": 880,
  "successChance": 0.71,
  "ingredients": {
   "saltOre": 2,
   "adamantOre": 6
  },
  "output": {
   "itemId": "smith_ext_17",
   "qty": 1
  }
 },
 {
  "id": "精金-amulet-smith_rec_18",
  "name": "精金调味瓶",
  "category": "调味瓶",
  "reqLevel": 38,
  "xp": 928,
  "successChance": 0.7,
  "ingredients": {
   "saltOre": 2,
   "adamantOre": 7
  },
  "output": {
   "itemId": "smith_ext_18",
   "qty": 1
  }
 },
 {
  "id": "smith_set_精金_legs",
  "name": "精金腿甲",
  "category": "腿甲",
  "reqLevel": 39,
  "xp": 84,
  "successChance": 0.87,
  "ingredients": {
   "adamantOre": 3,
   "saltOre": 2
  },
  "output": {
   "itemId": "smith_精金_legs",
   "qty": 1
  }
 },
 {
  "id": "smith_set_精金_boots",
  "name": "精金靴子",
  "category": "靴子",
  "reqLevel": 40,
  "xp": 84,
  "successChance": 0.87,
  "ingredients": {
   "adamantOre": 3,
   "saltOre": 2
  },
  "output": {
   "itemId": "smith_精金_boots",
   "qty": 1
  }
 },
 {
  "id": "smith_set_精金_ring",
  "name": "精金戒指",
  "category": "戒指",
  "reqLevel": 40,
  "xp": 84,
  "successChance": 0.87,
  "ingredients": {
   "adamantOre": 3,
   "saltOre": 2
  },
  "output": {
   "itemId": "smith_精金_ring",
   "qty": 1
  }
 },
 {
  "id": "水晶-weapon-crystalKnife",
  "name": "水晶刀",
  "category": "武器",
  "reqLevel": 41,
  "xp": 1750,
  "successChance": 0.58,
  "ingredients": {
   "saltOre": 5,
   "crystalOre": 12
  },
  "output": {
   "itemId": "crystalKnife",
   "qty": 1
  }
 },
 {
  "id": "水晶-offhand-crystalPot",
  "name": "水晶锅",
  "category": "副手",
  "reqLevel": 42,
  "xp": 1820,
  "successChance": 0.57,
  "ingredients": {
   "saltOre": 5,
   "crystalOre": 12
  },
  "output": {
   "itemId": "crystalPot",
   "qty": 1
  }
 },
 {
  "id": "水晶-offhand-crystalBoard",
  "name": "水晶砧板",
  "category": "副手",
  "reqLevel": 42,
  "xp": 1860,
  "successChance": 0.56,
  "ingredients": {
   "saltOre": 5,
   "wood": 5,
   "crystalOre": 12
  },
  "output": {
   "itemId": "crystalBoard",
   "qty": 1
  }
 },
 {
  "id": "水晶-body-crystalApron",
  "name": "水晶围裙",
  "category": "身体",
  "reqLevel": 43,
  "xp": 1900,
  "successChance": 0.56,
  "ingredients": {
   "saltOre": 5,
   "crystalOre": 12
  },
  "output": {
   "itemId": "crystalApron",
   "qty": 1
  }
 },
 {
  "id": "水晶-helmet-crystalHat",
  "name": "水晶厨师帽",
  "category": "头盔",
  "reqLevel": 44,
  "xp": 1980,
  "successChance": 0.55,
  "ingredients": {
   "saltOre": 6,
   "crystalOre": 12
  },
  "output": {
   "itemId": "crystalHat",
   "qty": 1
  }
 },
 {
  "id": "水晶-amulet-crystalBottle",
  "name": "水晶调味瓶",
  "category": "饰品",
  "reqLevel": 43,
  "xp": 2060,
  "successChance": 0.54,
  "ingredients": {
   "saltOre": 5,
   "crystalOre": 12
  },
  "output": {
   "itemId": "crystalBottle",
   "qty": 1
  }
 },
 {
  "id": "smith_set_水晶_legs",
  "name": "水晶腿甲",
  "category": "腿甲",
  "reqLevel": 44,
  "xp": 92,
  "successChance": 0.86,
  "ingredients": {
   "crystalOre": 3,
   "saltOre": 2
  },
  "output": {
   "itemId": "smith_水晶_legs",
   "qty": 1
  }
 },
 {
  "id": "smith_set_水晶_boots",
  "name": "水晶靴子",
  "category": "靴子",
  "reqLevel": 45,
  "xp": 92,
  "successChance": 0.86,
  "ingredients": {
   "crystalOre": 3,
   "saltOre": 2
  },
  "output": {
   "itemId": "smith_水晶_boots",
   "qty": 1
  }
 },
 {
  "id": "smith_set_水晶_ring",
  "name": "水晶戒指",
  "category": "戒指",
  "reqLevel": 45,
  "xp": 92,
  "successChance": 0.86,
  "ingredients": {
   "crystalOre": 3,
   "saltOre": 2
  },
  "output": {
   "itemId": "smith_水晶_ring",
   "qty": 1
  }
 },
 {
  "id": "玄铁-weapon-smith_rec_19",
  "name": "玄铁刀",
  "category": "刀",
  "reqLevel": 46,
  "xp": 976,
  "successChance": 0.69,
  "ingredients": {
   "saltOre": 2,
   "darkIronOre": 7
  },
  "output": {
   "itemId": "smith_ext_19",
   "qty": 1
  }
 },
 {
  "id": "玄铁-offhand-smith_rec_20",
  "name": "玄铁锅",
  "category": "锅",
  "reqLevel": 47,
  "xp": 1040,
  "successChance": 0.67,
  "ingredients": {
   "saltOre": 2,
   "darkIronOre": 7
  },
  "output": {
   "itemId": "smith_ext_20",
   "qty": 1
  }
 },
 {
  "id": "玄铁-offhand-smith_rec_21",
  "name": "玄铁砧板",
  "category": "砧板",
  "reqLevel": 47,
  "xp": 1088,
  "successChance": 0.66,
  "ingredients": {
   "saltOre": 2,
   "darkIronOre": 7
  },
  "output": {
   "itemId": "smith_ext_21",
   "qty": 1
  }
 },
 {
  "id": "玄铁-body-smith_rec_22",
  "name": "玄铁围裙",
  "category": "围裙",
  "reqLevel": 48,
  "xp": 1136,
  "successChance": 0.65,
  "ingredients": {
   "saltOre": 2,
   "darkIronOre": 7
  },
  "output": {
   "itemId": "smith_ext_22",
   "qty": 1
  }
 },
 {
  "id": "玄铁-helmet-smith_rec_23",
  "name": "玄铁厨师帽",
  "category": "厨师帽",
  "reqLevel": 49,
  "xp": 1200,
  "successChance": 0.64,
  "ingredients": {
   "saltOre": 2,
   "darkIronOre": 7
  },
  "output": {
   "itemId": "smith_ext_23",
   "qty": 1
  }
 },
 {
  "id": "玄铁-amulet-smith_rec_24",
  "name": "玄铁调味瓶",
  "category": "调味瓶",
  "reqLevel": 48,
  "xp": 1248,
  "successChance": 0.63,
  "ingredients": {
   "saltOre": 2,
   "darkIronOre": 8
  },
  "output": {
   "itemId": "smith_ext_24",
   "qty": 1
  }
 },
 {
  "id": "smith_set_玄铁_legs",
  "name": "玄铁腿甲",
  "category": "腿甲",
  "reqLevel": 49,
  "xp": 100,
  "successChance": 0.85,
  "ingredients": {
   "darkIronOre": 4,
   "saltOre": 2
  },
  "output": {
   "itemId": "smith_玄铁_legs",
   "qty": 1
  }
 },
 {
  "id": "smith_set_玄铁_boots",
  "name": "玄铁靴子",
  "category": "靴子",
  "reqLevel": 50,
  "xp": 100,
  "successChance": 0.85,
  "ingredients": {
   "darkIronOre": 4,
   "saltOre": 2
  },
  "output": {
   "itemId": "smith_玄铁_boots",
   "qty": 1
  }
 },
 {
  "id": "smith_set_玄铁_ring",
  "name": "玄铁戒指",
  "category": "戒指",
  "reqLevel": 50,
  "xp": 100,
  "successChance": 0.85,
  "ingredients": {
   "darkIronOre": 4,
   "saltOre": 2
  },
  "output": {
   "itemId": "smith_玄铁_ring",
   "qty": 1
  }
 },
 {
  "id": "寒铁-weapon-smith_rec2_01",
  "name": "寒铁刀",
  "category": "刀",
  "reqLevel": 51,
  "xp": 16,
  "successChance": 0.9,
  "ingredients": {
   "saltOre": 2,
   "coldIronOre": 4
  },
  "output": {
   "itemId": "smith_ext2_01",
   "qty": 1
  }
 },
 {
  "id": "寒铁-offhand-smith_rec2_02",
  "name": "寒铁锅",
  "category": "锅",
  "reqLevel": 52,
  "xp": 64,
  "successChance": 0.89,
  "ingredients": {
   "saltOre": 2,
   "coldIronOre": 4
  },
  "output": {
   "itemId": "smith_ext2_02",
   "qty": 1
  }
 },
 {
  "id": "寒铁-offhand-smith_rec2_03",
  "name": "寒铁砧板",
  "category": "砧板",
  "reqLevel": 52,
  "xp": 112,
  "successChance": 0.88,
  "ingredients": {
   "saltOre": 2,
   "coldIronOre": 4
  },
  "output": {
   "itemId": "smith_ext2_03",
   "qty": 1
  }
 },
 {
  "id": "寒铁-body-smith_rec2_04",
  "name": "寒铁围裙",
  "category": "围裙",
  "reqLevel": 53,
  "xp": 176,
  "successChance": 0.86,
  "ingredients": {
   "saltOre": 2,
   "coldIronOre": 4
  },
  "output": {
   "itemId": "smith_ext2_04",
   "qty": 1
  }
 },
 {
  "id": "寒铁-helmet-smith_rec2_05",
  "name": "寒铁厨师帽",
  "category": "厨师帽",
  "reqLevel": 54,
  "xp": 224,
  "successChance": 0.85,
  "ingredients": {
   "saltOre": 2,
   "coldIronOre": 4
  },
  "output": {
   "itemId": "smith_ext2_05",
   "qty": 1
  }
 },
 {
  "id": "寒铁-amulet-smith_rec2_06",
  "name": "寒铁调味瓶",
  "category": "调味瓶",
  "reqLevel": 53,
  "xp": 272,
  "successChance": 0.84,
  "ingredients": {
   "saltOre": 2,
   "coldIronOre": 5
  },
  "output": {
   "itemId": "smith_ext2_06",
   "qty": 1
  }
 },
 {
  "id": "smith_set_寒铁_legs",
  "name": "寒铁腿甲",
  "category": "腿甲",
  "reqLevel": 54,
  "xp": 108,
  "successChance": 0.84,
  "ingredients": {
   "coldIronOre": 4,
   "saltOre": 2
  },
  "output": {
   "itemId": "smith_寒铁_legs",
   "qty": 1
  }
 },
 {
  "id": "smith_set_寒铁_boots",
  "name": "寒铁靴子",
  "category": "靴子",
  "reqLevel": 55,
  "xp": 108,
  "successChance": 0.84,
  "ingredients": {
   "coldIronOre": 4,
   "saltOre": 2
  },
  "output": {
   "itemId": "smith_寒铁_boots",
   "qty": 1
  }
 },
 {
  "id": "smith_set_寒铁_ring",
  "name": "寒铁戒指",
  "category": "戒指",
  "reqLevel": 55,
  "xp": 108,
  "successChance": 0.84,
  "ingredients": {
   "coldIronOre": 4,
   "saltOre": 2
  },
  "output": {
   "itemId": "smith_寒铁_ring",
   "qty": 1
  }
 },
 {
  "id": "陨铁-weapon-smith_rec2_07",
  "name": "陨铁刀",
  "category": "刀",
  "reqLevel": 56,
  "xp": 336,
  "successChance": 0.83,
  "ingredients": {
   "saltOre": 2,
   "meteoriteOre": 5
  },
  "output": {
   "itemId": "smith_ext2_07",
   "qty": 1
  }
 },
 {
  "id": "陨铁-offhand-smith_rec2_08",
  "name": "陨铁锅",
  "category": "锅",
  "reqLevel": 57,
  "xp": 384,
  "successChance": 0.82,
  "ingredients": {
   "saltOre": 2,
   "meteoriteOre": 5
  },
  "output": {
   "itemId": "smith_ext2_08",
   "qty": 1
  }
 },
 {
  "id": "陨铁-offhand-smith_rec2_09",
  "name": "陨铁砧板",
  "category": "砧板",
  "reqLevel": 57,
  "xp": 448,
  "successChance": 0.8,
  "ingredients": {
   "saltOre": 2,
   "meteoriteOre": 5
  },
  "output": {
   "itemId": "smith_ext2_09",
   "qty": 1
  }
 },
 {
  "id": "陨铁-body-smith_rec2_10",
  "name": "陨铁围裙",
  "category": "围裙",
  "reqLevel": 58,
  "xp": 496,
  "successChance": 0.79,
  "ingredients": {
   "saltOre": 2,
   "meteoriteOre": 5
  },
  "output": {
   "itemId": "smith_ext2_10",
   "qty": 1
  }
 },
 {
  "id": "陨铁-helmet-smith_rec2_11",
  "name": "陨铁厨师帽",
  "category": "厨师帽",
  "reqLevel": 59,
  "xp": 544,
  "successChance": 0.78,
  "ingredients": {
   "saltOre": 2,
   "meteoriteOre": 5
  },
  "output": {
   "itemId": "smith_ext2_11",
   "qty": 1
  }
 },
 {
  "id": "陨铁-amulet-smith_rec2_12",
  "name": "陨铁调味瓶",
  "category": "调味瓶",
  "reqLevel": 58,
  "xp": 608,
  "successChance": 0.77,
  "ingredients": {
   "saltOre": 2,
   "meteoriteOre": 6
  },
  "output": {
   "itemId": "smith_ext2_12",
   "qty": 1
  }
 },
 {
  "id": "smith_set_陨铁_legs",
  "name": "陨铁腿甲",
  "category": "腿甲",
  "reqLevel": 59,
  "xp": 116,
  "successChance": 0.83,
  "ingredients": {
   "meteoriteOre": 4,
   "saltOre": 3
  },
  "output": {
   "itemId": "smith_陨铁_legs",
   "qty": 1
  }
 },
 {
  "id": "smith_set_陨铁_boots",
  "name": "陨铁靴子",
  "category": "靴子",
  "reqLevel": 60,
  "xp": 116,
  "successChance": 0.83,
  "ingredients": {
   "meteoriteOre": 4,
   "saltOre": 3
  },
  "output": {
   "itemId": "smith_陨铁_boots",
   "qty": 1
  }
 },
 {
  "id": "smith_set_陨铁_ring",
  "name": "陨铁戒指",
  "category": "戒指",
  "reqLevel": 60,
  "xp": 116,
  "successChance": 0.83,
  "ingredients": {
   "meteoriteOre": 4,
   "saltOre": 3
  },
  "output": {
   "itemId": "smith_陨铁_ring",
   "qty": 1
  }
 },
 {
  "id": "星辰-weapon-smith_rec_25",
  "name": "星辰刀",
  "category": "刀",
  "reqLevel": 61,
  "xp": 1312,
  "successChance": 0.61,
  "ingredients": {
   "saltOre": 2,
   "starOre": 8
  },
  "output": {
   "itemId": "smith_ext_25",
   "qty": 1
  }
 },
 {
  "id": "星辰-offhand-smith_rec_26",
  "name": "星辰锅",
  "category": "锅",
  "reqLevel": 62,
  "xp": 1360,
  "successChance": 0.6,
  "ingredients": {
   "saltOre": 2,
   "starOre": 8
  },
  "output": {
   "itemId": "smith_ext_26",
   "qty": 1
  }
 },
 {
  "id": "星辰-offhand-smith_rec_27",
  "name": "星辰砧板",
  "category": "砧板",
  "reqLevel": 62,
  "xp": 1408,
  "successChance": 0.59,
  "ingredients": {
   "saltOre": 2,
   "starOre": 8
  },
  "output": {
   "itemId": "smith_ext_27",
   "qty": 1
  }
 },
 {
  "id": "星辰-body-smith_rec_28",
  "name": "星辰围裙",
  "category": "围裙",
  "reqLevel": 63,
  "xp": 1472,
  "successChance": 0.58,
  "ingredients": {
   "saltOre": 2,
   "starOre": 8
  },
  "output": {
   "itemId": "smith_ext_28",
   "qty": 1
  }
 },
 {
  "id": "星辰-helmet-smith_rec_29",
  "name": "星辰厨师帽",
  "category": "厨师帽",
  "reqLevel": 64,
  "xp": 1520,
  "successChance": 0.57,
  "ingredients": {
   "saltOre": 2,
   "starOre": 8
  },
  "output": {
   "itemId": "smith_ext_29",
   "qty": 1
  }
 },
 {
  "id": "星辰-amulet-smith_rec_30",
  "name": "星辰调味瓶",
  "category": "调味瓶",
  "reqLevel": 63,
  "xp": 1584,
  "successChance": 0.55,
  "ingredients": {
   "saltOre": 2,
   "starOre": 9
  },
  "output": {
   "itemId": "smith_ext_30",
   "qty": 1
  }
 },
 {
  "id": "smith_set_星辰_legs",
  "name": "星辰腿甲",
  "category": "腿甲",
  "reqLevel": 64,
  "xp": 124,
  "successChance": 0.82,
  "ingredients": {
   "starOre": 4,
   "saltOre": 3
  },
  "output": {
   "itemId": "smith_星辰_legs",
   "qty": 1
  }
 },
 {
  "id": "smith_set_星辰_boots",
  "name": "星辰靴子",
  "category": "靴子",
  "reqLevel": 65,
  "xp": 124,
  "successChance": 0.82,
  "ingredients": {
   "starOre": 4,
   "saltOre": 3
  },
  "output": {
   "itemId": "smith_星辰_boots",
   "qty": 1
  }
 },
 {
  "id": "smith_set_星辰_ring",
  "name": "星辰戒指",
  "category": "戒指",
  "reqLevel": 65,
  "xp": 124,
  "successChance": 0.82,
  "ingredients": {
   "starOre": 4,
   "saltOre": 3
  },
  "output": {
   "itemId": "smith_星辰_ring",
   "qty": 1
  }
 },
 {
  "id": "龙鳞-weapon-smith_rec2_13",
  "name": "龙鳞刀",
  "category": "刀",
  "reqLevel": 66,
  "xp": 656,
  "successChance": 0.76,
  "ingredients": {
   "saltOre": 2,
   "dragonScaleOre": 6
  },
  "output": {
   "itemId": "smith_ext2_13",
   "qty": 1
  }
 },
 {
  "id": "龙鳞-offhand-smith_rec2_14",
  "name": "龙鳞锅",
  "category": "锅",
  "reqLevel": 67,
  "xp": 704,
  "successChance": 0.75,
  "ingredients": {
   "saltOre": 2,
   "dragonScaleOre": 6
  },
  "output": {
   "itemId": "smith_ext2_14",
   "qty": 1
  }
 },
 {
  "id": "龙鳞-offhand-smith_rec2_15",
  "name": "龙鳞砧板",
  "category": "砧板",
  "reqLevel": 67,
  "xp": 768,
  "successChance": 0.73,
  "ingredients": {
   "saltOre": 2,
   "dragonScaleOre": 6
  },
  "output": {
   "itemId": "smith_ext2_15",
   "qty": 1
  }
 },
 {
  "id": "龙鳞-body-smith_rec2_16",
  "name": "龙鳞围裙",
  "category": "围裙",
  "reqLevel": 68,
  "xp": 816,
  "successChance": 0.72,
  "ingredients": {
   "saltOre": 2,
   "dragonScaleOre": 6
  },
  "output": {
   "itemId": "smith_ext2_16",
   "qty": 1
  }
 },
 {
  "id": "龙鳞-helmet-smith_rec2_17",
  "name": "龙鳞厨师帽",
  "category": "厨师帽",
  "reqLevel": 69,
  "xp": 880,
  "successChance": 0.71,
  "ingredients": {
   "saltOre": 2,
   "dragonScaleOre": 6
  },
  "output": {
   "itemId": "smith_ext2_17",
   "qty": 1
  }
 },
 {
  "id": "龙鳞-amulet-smith_rec2_18",
  "name": "龙鳞调味瓶",
  "category": "调味瓶",
  "reqLevel": 68,
  "xp": 928,
  "successChance": 0.7,
  "ingredients": {
   "saltOre": 2,
   "dragonScaleOre": 7
  },
  "output": {
   "itemId": "smith_ext2_18",
   "qty": 1
  }
 },
 {
  "id": "smith_set_龙鳞_legs",
  "name": "龙鳞腿甲",
  "category": "腿甲",
  "reqLevel": 69,
  "xp": 132,
  "successChance": 0.8099999999999999,
  "ingredients": {
   "dragonScaleOre": 4,
   "saltOre": 3
  },
  "output": {
   "itemId": "smith_龙鳞_legs",
   "qty": 1
  }
 },
 {
  "id": "smith_set_龙鳞_boots",
  "name": "龙鳞靴子",
  "category": "靴子",
  "reqLevel": 70,
  "xp": 132,
  "successChance": 0.8099999999999999,
  "ingredients": {
   "dragonScaleOre": 4,
   "saltOre": 3
  },
  "output": {
   "itemId": "smith_龙鳞_boots",
   "qty": 1
  }
 },
 {
  "id": "smith_set_龙鳞_ring",
  "name": "龙鳞戒指",
  "category": "戒指",
  "reqLevel": 70,
  "xp": 132,
  "successChance": 0.8099999999999999,
  "ingredients": {
   "dragonScaleOre": 4,
   "saltOre": 3
  },
  "output": {
   "itemId": "smith_龙鳞_ring",
   "qty": 1
  }
 },
 {
  "id": "琉璃-weapon-smith_rec2_19",
  "name": "琉璃刀",
  "category": "刀",
  "reqLevel": 71,
  "xp": 976,
  "successChance": 0.69,
  "ingredients": {
   "saltOre": 2,
   "glassOre": 7
  },
  "output": {
   "itemId": "smith_ext2_19",
   "qty": 1
  }
 },
 {
  "id": "琉璃-offhand-smith_rec2_20",
  "name": "琉璃锅",
  "category": "锅",
  "reqLevel": 72,
  "xp": 1040,
  "successChance": 0.67,
  "ingredients": {
   "saltOre": 2,
   "glassOre": 7
  },
  "output": {
   "itemId": "smith_ext2_20",
   "qty": 1
  }
 },
 {
  "id": "琉璃-offhand-smith_rec2_21",
  "name": "琉璃砧板",
  "category": "砧板",
  "reqLevel": 72,
  "xp": 1088,
  "successChance": 0.66,
  "ingredients": {
   "saltOre": 2,
   "glassOre": 7
  },
  "output": {
   "itemId": "smith_ext2_21",
   "qty": 1
  }
 },
 {
  "id": "琉璃-body-smith_rec2_22",
  "name": "琉璃围裙",
  "category": "围裙",
  "reqLevel": 73,
  "xp": 1136,
  "successChance": 0.65,
  "ingredients": {
   "saltOre": 2,
   "glassOre": 7
  },
  "output": {
   "itemId": "smith_ext2_22",
   "qty": 1
  }
 },
 {
  "id": "琉璃-helmet-smith_rec2_23",
  "name": "琉璃厨师帽",
  "category": "厨师帽",
  "reqLevel": 74,
  "xp": 1200,
  "successChance": 0.64,
  "ingredients": {
   "saltOre": 2,
   "glassOre": 7
  },
  "output": {
   "itemId": "smith_ext2_23",
   "qty": 1
  }
 },
 {
  "id": "琉璃-amulet-smith_rec2_24",
  "name": "琉璃调味瓶",
  "category": "调味瓶",
  "reqLevel": 73,
  "xp": 1248,
  "successChance": 0.63,
  "ingredients": {
   "saltOre": 2,
   "glassOre": 8
  },
  "output": {
   "itemId": "smith_ext2_24",
   "qty": 1
  }
 },
 {
  "id": "smith_set_琉璃_legs",
  "name": "琉璃腿甲",
  "category": "腿甲",
  "reqLevel": 74,
  "xp": 140,
  "successChance": 0.7999999999999999,
  "ingredients": {
   "glassOre": 5,
   "saltOre": 3
  },
  "output": {
   "itemId": "smith_琉璃_legs",
   "qty": 1
  }
 },
 {
  "id": "smith_set_琉璃_boots",
  "name": "琉璃靴子",
  "category": "靴子",
  "reqLevel": 75,
  "xp": 140,
  "successChance": 0.7999999999999999,
  "ingredients": {
   "glassOre": 5,
   "saltOre": 3
  },
  "output": {
   "itemId": "smith_琉璃_boots",
   "qty": 1
  }
 },
 {
  "id": "smith_set_琉璃_ring",
  "name": "琉璃戒指",
  "category": "戒指",
  "reqLevel": 75,
  "xp": 140,
  "successChance": 0.7999999999999999,
  "ingredients": {
   "glassOre": 5,
   "saltOre": 3
  },
  "output": {
   "itemId": "smith_琉璃_ring",
   "qty": 1
  }
 },
 {
  "id": "鎏金-weapon-smith_rec2_25",
  "name": "鎏金刀",
  "category": "刀",
  "reqLevel": 76,
  "xp": 1312,
  "successChance": 0.61,
  "ingredients": {
   "excavation_ext2_18": 8,
   "excavation_ext2_19": 2
  },
  "output": {
   "itemId": "smith_ext2_25",
   "qty": 1
  }
 },
 {
  "id": "鎏金-offhand-smith_rec2_26",
  "name": "鎏金锅",
  "category": "锅",
  "reqLevel": 77,
  "xp": 1360,
  "successChance": 0.6,
  "ingredients": {
   "excavation_ext2_18": 8,
   "excavation_ext2_19": 2
  },
  "output": {
   "itemId": "smith_ext2_26",
   "qty": 1
  }
 },
 {
  "id": "鎏金-offhand-smith_rec2_27",
  "name": "鎏金砧板",
  "category": "砧板",
  "reqLevel": 77,
  "xp": 1408,
  "successChance": 0.59,
  "ingredients": {
   "excavation_ext2_18": 8,
   "excavation_ext2_19": 2
  },
  "output": {
   "itemId": "smith_ext2_27",
   "qty": 1
  }
 },
 {
  "id": "鎏金-body-smith_rec2_28",
  "name": "鎏金围裙",
  "category": "围裙",
  "reqLevel": 78,
  "xp": 1472,
  "successChance": 0.58,
  "ingredients": {
   "excavation_ext2_18": 6,
   "excavation_ext2_19": 2
  },
  "output": {
   "itemId": "smith_ext2_28",
   "qty": 1
  }
 },
 {
  "id": "鎏金-helmet-smith_rec2_29",
  "name": "鎏金厨师帽",
  "category": "厨师帽",
  "reqLevel": 79,
  "xp": 1520,
  "successChance": 0.57,
  "ingredients": {
   "excavation_ext2_18": 8,
   "excavation_ext2_19": 2
  },
  "output": {
   "itemId": "smith_ext2_29",
   "qty": 1
  }
 },
 {
  "id": "鎏金-amulet-smith_rec2_30",
  "name": "鎏金调味瓶",
  "category": "调味瓶",
  "reqLevel": 78,
  "xp": 1584,
  "successChance": 0.55,
  "ingredients": {
   "excavation_ext2_18": 9,
   "excavation_ext2_19": 2
  },
  "output": {
   "itemId": "smith_ext2_30",
   "qty": 1
  }
 },
 {
  "id": "smith_set_鎏金_legs",
  "name": "鎏金腿甲",
  "category": "腿甲",
  "reqLevel": 79,
  "xp": 148,
  "successChance": 0.7899999999999999,
  "ingredients": {
   "giltOre": 5,
   "saltOre": 3
  },
  "output": {
   "itemId": "smith_鎏金_legs",
   "qty": 1
  }
 },
 {
  "id": "smith_set_鎏金_boots",
  "name": "鎏金靴子",
  "category": "靴子",
  "reqLevel": 80,
  "xp": 148,
  "successChance": 0.7899999999999999,
  "ingredients": {
   "giltOre": 5,
   "saltOre": 3
  },
  "output": {
   "itemId": "smith_鎏金_boots",
   "qty": 1
  }
 },
 {
  "id": "smith_set_鎏金_ring",
  "name": "鎏金戒指",
  "category": "戒指",
  "reqLevel": 80,
  "xp": 148,
  "successChance": 0.7899999999999999,
  "ingredients": {
   "giltOre": 5,
   "saltOre": 3
  },
  "output": {
   "itemId": "smith_鎏金_ring",
   "qty": 1
  }
 },
 {
  "id": "钨-amulet-tungstenAmulet",
  "name": "钨护符",
  "category": "饰品",
  "reqLevel": 83,
  "xp": 840,
  "successChance": 0.67,
  "ingredients": {
   "excavation_ext2_25": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "tungstenAmulet",
   "qty": 1
  }
 },
 {
  "id": "smith_set_钨_weapon",
  "name": "钨刀",
  "category": "刀",
  "reqLevel": 81,
  "xp": 156,
  "successChance": 0.7799999999999999,
  "ingredients": {
   "excavation_ext2_25": 5,
   "saltOre": 3
  },
  "output": {
   "itemId": "smith_钨_weapon",
   "qty": 1
  }
 },
 {
  "id": "smith_set_钨_offhand",
  "name": "钨锅",
  "category": "锅",
  "reqLevel": 82,
  "xp": 156,
  "successChance": 0.7799999999999999,
  "ingredients": {
   "excavation_ext2_25": 5,
   "saltOre": 3
  },
  "output": {
   "itemId": "smith_钨_offhand",
   "qty": 1
  }
 },
 {
  "id": "smith_set_钨_body",
  "name": "钨围裙",
  "category": "围裙",
  "reqLevel": 83,
  "xp": 156,
  "successChance": 0.7799999999999999,
  "ingredients": {
   "excavation_ext2_25": 5,
   "saltOre": 3
  },
  "output": {
   "itemId": "smith_钨_body",
   "qty": 1
  }
 },
 {
  "id": "smith_set_钨_helmet",
  "name": "钨厨师帽",
  "category": "厨师帽",
  "reqLevel": 84,
  "xp": 156,
  "successChance": 0.7799999999999999,
  "ingredients": {
   "excavation_ext2_25": 5,
   "saltOre": 3
  },
  "output": {
   "itemId": "smith_钨_helmet",
   "qty": 1
  }
 },
 {
  "id": "smith_set_钨_legs",
  "name": "钨腿甲",
  "category": "腿甲",
  "reqLevel": 84,
  "xp": 156,
  "successChance": 0.7799999999999999,
  "ingredients": {
   "excavation_ext2_25": 5,
   "saltOre": 3
  },
  "output": {
   "itemId": "smith_钨_legs",
   "qty": 1
  }
 },
 {
  "id": "smith_set_钨_boots",
  "name": "钨靴子",
  "category": "靴子",
  "reqLevel": 85,
  "xp": 156,
  "successChance": 0.7799999999999999,
  "ingredients": {
   "excavation_ext2_25": 5,
   "saltOre": 3
  },
  "output": {
   "itemId": "smith_钨_boots",
   "qty": 1
  }
 },
 {
  "id": "smith_set_钨_ring",
  "name": "钨戒指",
  "category": "戒指",
  "reqLevel": 85,
  "xp": 156,
  "successChance": 0.7799999999999999,
  "ingredients": {
   "excavation_ext2_25": 5,
   "saltOre": 3
  },
  "output": {
   "itemId": "smith_钨_ring",
   "qty": 1
  }
 },
 {
  "id": "锰-amulet-manganeseAmulet",
  "name": "锰护符",
  "category": "饰品",
  "reqLevel": 88,
  "xp": 960,
  "successChance": 0.65,
  "ingredients": {
   "excavation_ext2_27": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "manganeseAmulet",
   "qty": 1
  }
 },
 {
  "id": "smith_set_锰_weapon",
  "name": "锰刀",
  "category": "刀",
  "reqLevel": 86,
  "xp": 164,
  "successChance": 0.77,
  "ingredients": {
   "excavation_ext2_27": 5,
   "saltOre": 4
  },
  "output": {
   "itemId": "smith_锰_weapon",
   "qty": 1
  }
 },
 {
  "id": "smith_set_锰_offhand",
  "name": "锰锅",
  "category": "锅",
  "reqLevel": 87,
  "xp": 164,
  "successChance": 0.77,
  "ingredients": {
   "excavation_ext2_27": 5,
   "saltOre": 4
  },
  "output": {
   "itemId": "smith_锰_offhand",
   "qty": 1
  }
 },
 {
  "id": "smith_set_锰_body",
  "name": "锰围裙",
  "category": "围裙",
  "reqLevel": 88,
  "xp": 164,
  "successChance": 0.77,
  "ingredients": {
   "excavation_ext2_27": 5,
   "saltOre": 4
  },
  "output": {
   "itemId": "smith_锰_body",
   "qty": 1
  }
 },
 {
  "id": "smith_set_锰_helmet",
  "name": "锰厨师帽",
  "category": "厨师帽",
  "reqLevel": 89,
  "xp": 164,
  "successChance": 0.77,
  "ingredients": {
   "excavation_ext2_27": 5,
   "saltOre": 4
  },
  "output": {
   "itemId": "smith_锰_helmet",
   "qty": 1
  }
 },
 {
  "id": "smith_set_锰_legs",
  "name": "锰腿甲",
  "category": "腿甲",
  "reqLevel": 89,
  "xp": 164,
  "successChance": 0.77,
  "ingredients": {
   "excavation_ext2_27": 5,
   "saltOre": 4
  },
  "output": {
   "itemId": "smith_锰_legs",
   "qty": 1
  }
 },
 {
  "id": "smith_set_锰_boots",
  "name": "锰靴子",
  "category": "靴子",
  "reqLevel": 90,
  "xp": 164,
  "successChance": 0.77,
  "ingredients": {
   "excavation_ext2_27": 5,
   "saltOre": 4
  },
  "output": {
   "itemId": "smith_锰_boots",
   "qty": 1
  }
 },
 {
  "id": "smith_set_锰_ring",
  "name": "锰戒指",
  "category": "戒指",
  "reqLevel": 90,
  "xp": 164,
  "successChance": 0.77,
  "ingredients": {
   "excavation_ext2_27": 5,
   "saltOre": 4
  },
  "output": {
   "itemId": "smith_锰_ring",
   "qty": 1
  }
 },
 {
  "id": "钒-amulet-vanadiumAmulet",
  "name": "钒护符",
  "category": "饰品",
  "reqLevel": 93,
  "xp": 1050,
  "successChance": 0.63,
  "ingredients": {
   "excavation_ext2_28": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "vanadiumAmulet",
   "qty": 1
  }
 },
 {
  "id": "smith_set_钒_weapon",
  "name": "钒刀",
  "category": "刀",
  "reqLevel": 91,
  "xp": 172,
  "successChance": 0.76,
  "ingredients": {
   "excavation_ext2_28": 5,
   "saltOre": 4
  },
  "output": {
   "itemId": "smith_钒_weapon",
   "qty": 1
  }
 },
 {
  "id": "smith_set_钒_offhand",
  "name": "钒锅",
  "category": "锅",
  "reqLevel": 92,
  "xp": 172,
  "successChance": 0.76,
  "ingredients": {
   "excavation_ext2_28": 5,
   "saltOre": 4
  },
  "output": {
   "itemId": "smith_钒_offhand",
   "qty": 1
  }
 },
 {
  "id": "smith_set_钒_body",
  "name": "钒围裙",
  "category": "围裙",
  "reqLevel": 93,
  "xp": 172,
  "successChance": 0.76,
  "ingredients": {
   "excavation_ext2_28": 5,
   "saltOre": 4
  },
  "output": {
   "itemId": "smith_钒_body",
   "qty": 1
  }
 },
 {
  "id": "smith_set_钒_helmet",
  "name": "钒厨师帽",
  "category": "厨师帽",
  "reqLevel": 94,
  "xp": 172,
  "successChance": 0.76,
  "ingredients": {
   "excavation_ext2_28": 5,
   "saltOre": 4
  },
  "output": {
   "itemId": "smith_钒_helmet",
   "qty": 1
  }
 },
 {
  "id": "smith_set_钒_legs",
  "name": "钒腿甲",
  "category": "腿甲",
  "reqLevel": 94,
  "xp": 172,
  "successChance": 0.76,
  "ingredients": {
   "excavation_ext2_28": 5,
   "saltOre": 4
  },
  "output": {
   "itemId": "smith_钒_legs",
   "qty": 1
  }
 },
 {
  "id": "smith_set_钒_boots",
  "name": "钒靴子",
  "category": "靴子",
  "reqLevel": 95,
  "xp": 172,
  "successChance": 0.76,
  "ingredients": {
   "excavation_ext2_28": 5,
   "saltOre": 4
  },
  "output": {
   "itemId": "smith_钒_boots",
   "qty": 1
  }
 },
 {
  "id": "smith_set_钒_ring",
  "name": "钒戒指",
  "category": "戒指",
  "reqLevel": 95,
  "xp": 172,
  "successChance": 0.76,
  "ingredients": {
   "excavation_ext2_28": 5,
   "saltOre": 4
  },
  "output": {
   "itemId": "smith_钒_ring",
   "qty": 1
  }
 },
 {
  "id": "萤-ring-fluoriteRing",
  "name": "萤石戒指",
  "category": "饰品",
  "reqLevel": 100,
  "xp": 1200,
  "successChance": 0.6,
  "ingredients": {
   "excavation_ext2_30": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "fluoriteRing",
   "qty": 1
  }
 },
 {
  "id": "smith_set_萤_weapon",
  "name": "萤刀",
  "category": "刀",
  "reqLevel": 96,
  "xp": 180,
  "successChance": 0.75,
  "ingredients": {
   "excavation_ext2_30": 6,
   "saltOre": 4
  },
  "output": {
   "itemId": "smith_萤_weapon",
   "qty": 1
  }
 },
 {
  "id": "smith_set_萤_offhand",
  "name": "萤锅",
  "category": "锅",
  "reqLevel": 97,
  "xp": 180,
  "successChance": 0.75,
  "ingredients": {
   "excavation_ext2_30": 6,
   "saltOre": 4
  },
  "output": {
   "itemId": "smith_萤_offhand",
   "qty": 1
  }
 },
 {
  "id": "smith_set_萤_body",
  "name": "萤围裙",
  "category": "围裙",
  "reqLevel": 98,
  "xp": 180,
  "successChance": 0.75,
  "ingredients": {
   "excavation_ext2_30": 6,
   "saltOre": 4
  },
  "output": {
   "itemId": "smith_萤_body",
   "qty": 1
  }
 },
 {
  "id": "smith_set_萤_helmet",
  "name": "萤厨师帽",
  "category": "厨师帽",
  "reqLevel": 99,
  "xp": 180,
  "successChance": 0.75,
  "ingredients": {
   "excavation_ext2_30": 6,
   "saltOre": 4
  },
  "output": {
   "itemId": "smith_萤_helmet",
   "qty": 1
  }
 },
 {
  "id": "smith_set_萤_amulet",
  "name": "萤调味瓶",
  "category": "调味瓶",
  "reqLevel": 98,
  "xp": 180,
  "successChance": 0.75,
  "ingredients": {
   "excavation_ext2_30": 6,
   "saltOre": 4
  },
  "output": {
   "itemId": "smith_萤_amulet",
   "qty": 1
  }
 },
 {
  "id": "smith_set_萤_legs",
  "name": "萤腿甲",
  "category": "腿甲",
  "reqLevel": 99,
  "xp": 180,
  "successChance": 0.75,
  "ingredients": {
   "excavation_ext2_30": 6,
   "saltOre": 4
  },
  "output": {
   "itemId": "smith_萤_legs",
   "qty": 1
  }
 },
 {
  "id": "smith_set_萤_boots",
  "name": "萤靴子",
  "category": "靴子",
  "reqLevel": 100,
  "xp": 180,
  "successChance": 0.75,
  "ingredients": {
   "excavation_ext2_30": 6,
   "saltOre": 4
  },
  "output": {
   "itemId": "smith_萤_boots",
   "qty": 1
  }
 },
 {
  "id": "ext-amethystRing",
  "name": "紫水晶戒指",
  "category": "饰品",
  "reqLevel": 43,
  "xp": 290,
  "successChance": 0.8,
  "ingredients": {
   "excavation_ext2_13": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "amethystRing",
   "qty": 1
  }
 },
 {
  "id": "ext-inipamethyst_Weapon",
  "name": "紫水晶刀",
  "category": "刀",
  "reqLevel": 43,
  "xp": 290,
  "successChance": 0.8,
  "ingredients": {
   "excavation_ext2_13": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipamethyst_Weapon",
   "qty": 1
  }
 },
 {
  "id": "ext-inipamethyst_Pot",
  "name": "紫水晶锅",
  "category": "锅",
  "reqLevel": 43,
  "xp": 290,
  "successChance": 0.8,
  "ingredients": {
   "excavation_ext2_13": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipamethyst_Pot",
   "qty": 1
  }
 },
 {
  "id": "ext-inipamethyst_Board",
  "name": "紫水晶砧板",
  "category": "砧板",
  "reqLevel": 43,
  "xp": 290,
  "successChance": 0.8,
  "ingredients": {
   "excavation_ext2_13": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipamethyst_Board",
   "qty": 1
  }
 },
 {
  "id": "ext-inipamethyst_Body",
  "name": "紫水晶围裙",
  "category": "围裙",
  "reqLevel": 43,
  "xp": 290,
  "successChance": 0.8,
  "ingredients": {
   "excavation_ext2_13": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipamethyst_Body",
   "qty": 1
  }
 },
 {
  "id": "ext-inipamethyst_Helmet",
  "name": "紫水晶厨师帽",
  "category": "厨师帽",
  "reqLevel": 43,
  "xp": 290,
  "successChance": 0.8,
  "ingredients": {
   "excavation_ext2_13": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipamethyst_Helmet",
   "qty": 1
  }
 },
 {
  "id": "ext-inipamethyst_Amulet",
  "name": "紫水晶护符",
  "category": "护符",
  "reqLevel": 43,
  "xp": 290,
  "successChance": 0.8,
  "ingredients": {
   "excavation_ext2_13": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipamethyst_Amulet",
   "qty": 1
  }
 },
 {
  "id": "ext-inipamethyst_Legs",
  "name": "紫水晶腿甲",
  "category": "腿甲",
  "reqLevel": 43,
  "xp": 290,
  "successChance": 0.8,
  "ingredients": {
   "excavation_ext2_13": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipamethyst_Legs",
   "qty": 1
  }
 },
 {
  "id": "ext-inipamethyst_Boots",
  "name": "紫水晶靴子",
  "category": "靴子",
  "reqLevel": 43,
  "xp": 290,
  "successChance": 0.8,
  "ingredients": {
   "excavation_ext2_13": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipamethyst_Boots",
   "qty": 1
  }
 },
 {
  "id": "ext-turquoiseRing",
  "name": "绿松石戒指",
  "category": "饰品",
  "reqLevel": 46,
  "xp": 320,
  "successChance": 0.79,
  "ingredients": {
   "excavation_ext2_14": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "turquoiseRing",
   "qty": 1
  }
 },
 {
  "id": "ext-inipturquoise_Weapon",
  "name": "绿松石刀",
  "category": "刀",
  "reqLevel": 46,
  "xp": 320,
  "successChance": 0.79,
  "ingredients": {
   "excavation_ext2_14": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipturquoise_Weapon",
   "qty": 1
  }
 },
 {
  "id": "ext-inipturquoise_Pot",
  "name": "绿松石锅",
  "category": "锅",
  "reqLevel": 46,
  "xp": 320,
  "successChance": 0.79,
  "ingredients": {
   "excavation_ext2_14": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipturquoise_Pot",
   "qty": 1
  }
 },
 {
  "id": "ext-inipturquoise_Board",
  "name": "绿松石砧板",
  "category": "砧板",
  "reqLevel": 46,
  "xp": 320,
  "successChance": 0.79,
  "ingredients": {
   "excavation_ext2_14": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipturquoise_Board",
   "qty": 1
  }
 },
 {
  "id": "ext-inipturquoise_Body",
  "name": "绿松石围裙",
  "category": "围裙",
  "reqLevel": 46,
  "xp": 320,
  "successChance": 0.79,
  "ingredients": {
   "excavation_ext2_14": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipturquoise_Body",
   "qty": 1
  }
 },
 {
  "id": "ext-inipturquoise_Helmet",
  "name": "绿松石厨师帽",
  "category": "厨师帽",
  "reqLevel": 46,
  "xp": 320,
  "successChance": 0.79,
  "ingredients": {
   "excavation_ext2_14": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipturquoise_Helmet",
   "qty": 1
  }
 },
 {
  "id": "ext-inipturquoise_Amulet",
  "name": "绿松石护符",
  "category": "护符",
  "reqLevel": 46,
  "xp": 320,
  "successChance": 0.79,
  "ingredients": {
   "excavation_ext2_14": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipturquoise_Amulet",
   "qty": 1
  }
 },
 {
  "id": "ext-inipturquoise_Legs",
  "name": "绿松石腿甲",
  "category": "腿甲",
  "reqLevel": 46,
  "xp": 320,
  "successChance": 0.79,
  "ingredients": {
   "excavation_ext2_14": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipturquoise_Legs",
   "qty": 1
  }
 },
 {
  "id": "ext-inipturquoise_Boots",
  "name": "绿松石靴子",
  "category": "靴子",
  "reqLevel": 46,
  "xp": 320,
  "successChance": 0.79,
  "ingredients": {
   "excavation_ext2_14": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipturquoise_Boots",
   "qty": 1
  }
 },
 {
  "id": "ext-rubyRing",
  "name": "红宝石戒指",
  "category": "饰品",
  "reqLevel": 50,
  "xp": 355,
  "successChance": 0.78,
  "ingredients": {
   "excavation_ext2_15": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "rubyRing",
   "qty": 1
  }
 },
 {
  "id": "ext-inipruby_Weapon",
  "name": "红宝石刀",
  "category": "刀",
  "reqLevel": 50,
  "xp": 355,
  "successChance": 0.78,
  "ingredients": {
   "excavation_ext2_15": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipruby_Weapon",
   "qty": 1
  }
 },
 {
  "id": "ext-inipruby_Pot",
  "name": "红宝石锅",
  "category": "锅",
  "reqLevel": 50,
  "xp": 355,
  "successChance": 0.78,
  "ingredients": {
   "excavation_ext2_15": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipruby_Pot",
   "qty": 1
  }
 },
 {
  "id": "ext-inipruby_Board",
  "name": "红宝石砧板",
  "category": "砧板",
  "reqLevel": 50,
  "xp": 355,
  "successChance": 0.78,
  "ingredients": {
   "excavation_ext2_15": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipruby_Board",
   "qty": 1
  }
 },
 {
  "id": "ext-inipruby_Body",
  "name": "红宝石围裙",
  "category": "围裙",
  "reqLevel": 50,
  "xp": 355,
  "successChance": 0.78,
  "ingredients": {
   "excavation_ext2_15": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipruby_Body",
   "qty": 1
  }
 },
 {
  "id": "ext-inipruby_Helmet",
  "name": "红宝石厨师帽",
  "category": "厨师帽",
  "reqLevel": 50,
  "xp": 355,
  "successChance": 0.78,
  "ingredients": {
   "excavation_ext2_15": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipruby_Helmet",
   "qty": 1
  }
 },
 {
  "id": "ext-inipruby_Amulet",
  "name": "红宝石护符",
  "category": "护符",
  "reqLevel": 50,
  "xp": 355,
  "successChance": 0.78,
  "ingredients": {
   "excavation_ext2_15": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipruby_Amulet",
   "qty": 1
  }
 },
 {
  "id": "ext-inipruby_Legs",
  "name": "红宝石腿甲",
  "category": "腿甲",
  "reqLevel": 50,
  "xp": 355,
  "successChance": 0.78,
  "ingredients": {
   "excavation_ext2_15": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipruby_Legs",
   "qty": 1
  }
 },
 {
  "id": "ext-inipruby_Boots",
  "name": "红宝石靴子",
  "category": "靴子",
  "reqLevel": 50,
  "xp": 355,
  "successChance": 0.78,
  "ingredients": {
   "excavation_ext2_15": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipruby_Boots",
   "qty": 1
  }
 },
 {
  "id": "ext-emeraldRing",
  "name": "祖母绿戒指",
  "category": "饰品",
  "reqLevel": 53,
  "xp": 385,
  "successChance": 0.77,
  "ingredients": {
   "excavation_ext2_16": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "emeraldRing",
   "qty": 1
  }
 },
 {
  "id": "ext-inipemerald_Weapon",
  "name": "祖母绿刀",
  "category": "刀",
  "reqLevel": 53,
  "xp": 385,
  "successChance": 0.77,
  "ingredients": {
   "excavation_ext2_16": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipemerald_Weapon",
   "qty": 1
  }
 },
 {
  "id": "ext-inipemerald_Pot",
  "name": "祖母绿锅",
  "category": "锅",
  "reqLevel": 53,
  "xp": 385,
  "successChance": 0.77,
  "ingredients": {
   "excavation_ext2_16": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipemerald_Pot",
   "qty": 1
  }
 },
 {
  "id": "ext-inipemerald_Board",
  "name": "祖母绿砧板",
  "category": "砧板",
  "reqLevel": 53,
  "xp": 385,
  "successChance": 0.77,
  "ingredients": {
   "excavation_ext2_16": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipemerald_Board",
   "qty": 1
  }
 },
 {
  "id": "ext-inipemerald_Body",
  "name": "祖母绿围裙",
  "category": "围裙",
  "reqLevel": 53,
  "xp": 385,
  "successChance": 0.77,
  "ingredients": {
   "excavation_ext2_16": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipemerald_Body",
   "qty": 1
  }
 },
 {
  "id": "ext-inipemerald_Helmet",
  "name": "祖母绿厨师帽",
  "category": "厨师帽",
  "reqLevel": 53,
  "xp": 385,
  "successChance": 0.77,
  "ingredients": {
   "excavation_ext2_16": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipemerald_Helmet",
   "qty": 1
  }
 },
 {
  "id": "ext-inipemerald_Amulet",
  "name": "祖母绿护符",
  "category": "护符",
  "reqLevel": 53,
  "xp": 385,
  "successChance": 0.77,
  "ingredients": {
   "excavation_ext2_16": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipemerald_Amulet",
   "qty": 1
  }
 },
 {
  "id": "ext-inipemerald_Legs",
  "name": "祖母绿腿甲",
  "category": "腿甲",
  "reqLevel": 53,
  "xp": 385,
  "successChance": 0.77,
  "ingredients": {
   "excavation_ext2_16": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipemerald_Legs",
   "qty": 1
  }
 },
 {
  "id": "ext-inipemerald_Boots",
  "name": "祖母绿靴子",
  "category": "靴子",
  "reqLevel": 53,
  "xp": 385,
  "successChance": 0.77,
  "ingredients": {
   "excavation_ext2_16": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipemerald_Boots",
   "qty": 1
  }
 },
 {
  "id": "ext-diamondRing",
  "name": "钻石戒指",
  "category": "饰品",
  "reqLevel": 57,
  "xp": 425,
  "successChance": 0.76,
  "ingredients": {
   "excavation_ext2_17": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "diamondRing",
   "qty": 1
  }
 },
 {
  "id": "ext-inipdiamond_Weapon",
  "name": "钻石刀",
  "category": "刀",
  "reqLevel": 57,
  "xp": 425,
  "successChance": 0.76,
  "ingredients": {
   "excavation_ext2_17": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipdiamond_Weapon",
   "qty": 1
  }
 },
 {
  "id": "ext-inipdiamond_Pot",
  "name": "钻石锅",
  "category": "锅",
  "reqLevel": 57,
  "xp": 425,
  "successChance": 0.76,
  "ingredients": {
   "excavation_ext2_17": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipdiamond_Pot",
   "qty": 1
  }
 },
 {
  "id": "ext-inipdiamond_Board",
  "name": "钻石砧板",
  "category": "砧板",
  "reqLevel": 57,
  "xp": 425,
  "successChance": 0.76,
  "ingredients": {
   "excavation_ext2_17": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipdiamond_Board",
   "qty": 1
  }
 },
 {
  "id": "ext-inipdiamond_Body",
  "name": "钻石围裙",
  "category": "围裙",
  "reqLevel": 57,
  "xp": 425,
  "successChance": 0.76,
  "ingredients": {
   "excavation_ext2_17": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipdiamond_Body",
   "qty": 1
  }
 },
 {
  "id": "ext-inipdiamond_Helmet",
  "name": "钻石厨师帽",
  "category": "厨师帽",
  "reqLevel": 57,
  "xp": 425,
  "successChance": 0.76,
  "ingredients": {
   "excavation_ext2_17": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipdiamond_Helmet",
   "qty": 1
  }
 },
 {
  "id": "ext-inipdiamond_Amulet",
  "name": "钻石护符",
  "category": "护符",
  "reqLevel": 57,
  "xp": 425,
  "successChance": 0.76,
  "ingredients": {
   "excavation_ext2_17": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipdiamond_Amulet",
   "qty": 1
  }
 },
 {
  "id": "ext-inipdiamond_Legs",
  "name": "钻石腿甲",
  "category": "腿甲",
  "reqLevel": 57,
  "xp": 425,
  "successChance": 0.76,
  "ingredients": {
   "excavation_ext2_17": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipdiamond_Legs",
   "qty": 1
  }
 },
 {
  "id": "ext-inipdiamond_Boots",
  "name": "钻石靴子",
  "category": "靴子",
  "reqLevel": 57,
  "xp": 425,
  "successChance": 0.76,
  "ingredients": {
   "excavation_ext2_17": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipdiamond_Boots",
   "qty": 1
  }
 },
 {
  "id": "ext-tinAmulet",
  "name": "锡护符",
  "category": "饰品",
  "reqLevel": 67,
  "xp": 550,
  "successChance": 0.73,
  "ingredients": {
   "excavation_ext2_20": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "tinAmulet",
   "qty": 1
  }
 },
 {
  "id": "ext-iniptin_Weapon",
  "name": "锡刀",
  "category": "刀",
  "reqLevel": 67,
  "xp": 550,
  "successChance": 0.73,
  "ingredients": {
   "excavation_ext2_20": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "iniptin_Weapon",
   "qty": 1
  }
 },
 {
  "id": "ext-iniptin_Pot",
  "name": "锡锅",
  "category": "锅",
  "reqLevel": 67,
  "xp": 550,
  "successChance": 0.73,
  "ingredients": {
   "excavation_ext2_20": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "iniptin_Pot",
   "qty": 1
  }
 },
 {
  "id": "ext-iniptin_Board",
  "name": "锡砧板",
  "category": "砧板",
  "reqLevel": 67,
  "xp": 550,
  "successChance": 0.73,
  "ingredients": {
   "excavation_ext2_20": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "iniptin_Board",
   "qty": 1
  }
 },
 {
  "id": "ext-iniptin_Body",
  "name": "锡围裙",
  "category": "围裙",
  "reqLevel": 67,
  "xp": 550,
  "successChance": 0.73,
  "ingredients": {
   "excavation_ext2_20": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "iniptin_Body",
   "qty": 1
  }
 },
 {
  "id": "ext-iniptin_Helmet",
  "name": "锡厨师帽",
  "category": "厨师帽",
  "reqLevel": 67,
  "xp": 550,
  "successChance": 0.73,
  "ingredients": {
   "excavation_ext2_20": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "iniptin_Helmet",
   "qty": 1
  }
 },
 {
  "id": "ext-iniptin_Legs",
  "name": "锡腿甲",
  "category": "腿甲",
  "reqLevel": 67,
  "xp": 550,
  "successChance": 0.73,
  "ingredients": {
   "excavation_ext2_20": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "iniptin_Legs",
   "qty": 1
  }
 },
 {
  "id": "ext-iniptin_Boots",
  "name": "锡靴子",
  "category": "靴子",
  "reqLevel": 67,
  "xp": 550,
  "successChance": 0.73,
  "ingredients": {
   "excavation_ext2_20": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "iniptin_Boots",
   "qty": 1
  }
 },
 {
  "id": "ext-iniptin_Ring",
  "name": "锡戒指",
  "category": "戒指",
  "reqLevel": 67,
  "xp": 550,
  "successChance": 0.73,
  "ingredients": {
   "excavation_ext2_20": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "iniptin_Ring",
   "qty": 1
  }
 },
 {
  "id": "ext-leadAmulet",
  "name": "铅护符",
  "category": "饰品",
  "reqLevel": 70,
  "xp": 600,
  "successChance": 0.72,
  "ingredients": {
   "excavation_ext2_21": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "leadAmulet",
   "qty": 1
  }
 },
 {
  "id": "ext-iniplead_Weapon",
  "name": "铅刀",
  "category": "刀",
  "reqLevel": 70,
  "xp": 600,
  "successChance": 0.72,
  "ingredients": {
   "excavation_ext2_21": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "iniplead_Weapon",
   "qty": 1
  }
 },
 {
  "id": "ext-iniplead_Pot",
  "name": "铅锅",
  "category": "锅",
  "reqLevel": 70,
  "xp": 600,
  "successChance": 0.72,
  "ingredients": {
   "excavation_ext2_21": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "iniplead_Pot",
   "qty": 1
  }
 },
 {
  "id": "ext-iniplead_Board",
  "name": "铅砧板",
  "category": "砧板",
  "reqLevel": 70,
  "xp": 600,
  "successChance": 0.72,
  "ingredients": {
   "excavation_ext2_21": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "iniplead_Board",
   "qty": 1
  }
 },
 {
  "id": "ext-iniplead_Body",
  "name": "铅围裙",
  "category": "围裙",
  "reqLevel": 70,
  "xp": 600,
  "successChance": 0.72,
  "ingredients": {
   "excavation_ext2_21": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "iniplead_Body",
   "qty": 1
  }
 },
 {
  "id": "ext-iniplead_Helmet",
  "name": "铅厨师帽",
  "category": "厨师帽",
  "reqLevel": 70,
  "xp": 600,
  "successChance": 0.72,
  "ingredients": {
   "excavation_ext2_21": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "iniplead_Helmet",
   "qty": 1
  }
 },
 {
  "id": "ext-iniplead_Legs",
  "name": "铅腿甲",
  "category": "腿甲",
  "reqLevel": 70,
  "xp": 600,
  "successChance": 0.72,
  "ingredients": {
   "excavation_ext2_21": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "iniplead_Legs",
   "qty": 1
  }
 },
 {
  "id": "ext-iniplead_Boots",
  "name": "铅靴子",
  "category": "靴子",
  "reqLevel": 70,
  "xp": 600,
  "successChance": 0.72,
  "ingredients": {
   "excavation_ext2_21": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "iniplead_Boots",
   "qty": 1
  }
 },
 {
  "id": "ext-iniplead_Ring",
  "name": "铅戒指",
  "category": "戒指",
  "reqLevel": 70,
  "xp": 600,
  "successChance": 0.72,
  "ingredients": {
   "excavation_ext2_21": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "iniplead_Ring",
   "qty": 1
  }
 },
 {
  "id": "ext-zincAmulet",
  "name": "锌护符",
  "category": "饰品",
  "reqLevel": 73,
  "xp": 640,
  "successChance": 0.71,
  "ingredients": {
   "excavation_ext2_22": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "zincAmulet",
   "qty": 1
  }
 },
 {
  "id": "ext-inipzinc_Weapon",
  "name": "锌刀",
  "category": "刀",
  "reqLevel": 73,
  "xp": 640,
  "successChance": 0.71,
  "ingredients": {
   "excavation_ext2_22": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipzinc_Weapon",
   "qty": 1
  }
 },
 {
  "id": "ext-inipzinc_Pot",
  "name": "锌锅",
  "category": "锅",
  "reqLevel": 73,
  "xp": 640,
  "successChance": 0.71,
  "ingredients": {
   "excavation_ext2_22": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipzinc_Pot",
   "qty": 1
  }
 },
 {
  "id": "ext-inipzinc_Board",
  "name": "锌砧板",
  "category": "砧板",
  "reqLevel": 73,
  "xp": 640,
  "successChance": 0.71,
  "ingredients": {
   "excavation_ext2_22": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipzinc_Board",
   "qty": 1
  }
 },
 {
  "id": "ext-inipzinc_Body",
  "name": "锌围裙",
  "category": "围裙",
  "reqLevel": 73,
  "xp": 640,
  "successChance": 0.71,
  "ingredients": {
   "excavation_ext2_22": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipzinc_Body",
   "qty": 1
  }
 },
 {
  "id": "ext-inipzinc_Helmet",
  "name": "锌厨师帽",
  "category": "厨师帽",
  "reqLevel": 73,
  "xp": 640,
  "successChance": 0.71,
  "ingredients": {
   "excavation_ext2_22": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipzinc_Helmet",
   "qty": 1
  }
 },
 {
  "id": "ext-inipzinc_Legs",
  "name": "锌腿甲",
  "category": "腿甲",
  "reqLevel": 73,
  "xp": 640,
  "successChance": 0.71,
  "ingredients": {
   "excavation_ext2_22": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipzinc_Legs",
   "qty": 1
  }
 },
 {
  "id": "ext-inipzinc_Boots",
  "name": "锌靴子",
  "category": "靴子",
  "reqLevel": 73,
  "xp": 640,
  "successChance": 0.71,
  "ingredients": {
   "excavation_ext2_22": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipzinc_Boots",
   "qty": 1
  }
 },
 {
  "id": "ext-inipzinc_Ring",
  "name": "锌戒指",
  "category": "戒指",
  "reqLevel": 73,
  "xp": 640,
  "successChance": 0.71,
  "ingredients": {
   "excavation_ext2_22": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipzinc_Ring",
   "qty": 1
  }
 },
 {
  "id": "ext-nickelAmulet",
  "name": "镍护符",
  "category": "饰品",
  "reqLevel": 77,
  "xp": 700,
  "successChance": 0.7,
  "ingredients": {
   "excavation_ext2_23": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "nickelAmulet",
   "qty": 1
  }
 },
 {
  "id": "ext-inipnickel_Weapon",
  "name": "镍刀",
  "category": "刀",
  "reqLevel": 77,
  "xp": 700,
  "successChance": 0.7,
  "ingredients": {
   "excavation_ext2_23": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipnickel_Weapon",
   "qty": 1
  }
 },
 {
  "id": "ext-inipnickel_Pot",
  "name": "镍锅",
  "category": "锅",
  "reqLevel": 77,
  "xp": 700,
  "successChance": 0.7,
  "ingredients": {
   "excavation_ext2_23": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipnickel_Pot",
   "qty": 1
  }
 },
 {
  "id": "ext-inipnickel_Board",
  "name": "镍砧板",
  "category": "砧板",
  "reqLevel": 77,
  "xp": 700,
  "successChance": 0.7,
  "ingredients": {
   "excavation_ext2_23": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipnickel_Board",
   "qty": 1
  }
 },
 {
  "id": "ext-inipnickel_Body",
  "name": "镍围裙",
  "category": "围裙",
  "reqLevel": 77,
  "xp": 700,
  "successChance": 0.7,
  "ingredients": {
   "excavation_ext2_23": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipnickel_Body",
   "qty": 1
  }
 },
 {
  "id": "ext-inipnickel_Helmet",
  "name": "镍厨师帽",
  "category": "厨师帽",
  "reqLevel": 77,
  "xp": 700,
  "successChance": 0.7,
  "ingredients": {
   "excavation_ext2_23": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipnickel_Helmet",
   "qty": 1
  }
 },
 {
  "id": "ext-inipnickel_Legs",
  "name": "镍腿甲",
  "category": "腿甲",
  "reqLevel": 77,
  "xp": 700,
  "successChance": 0.7,
  "ingredients": {
   "excavation_ext2_23": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipnickel_Legs",
   "qty": 1
  }
 },
 {
  "id": "ext-inipnickel_Boots",
  "name": "镍靴子",
  "category": "靴子",
  "reqLevel": 77,
  "xp": 700,
  "successChance": 0.7,
  "ingredients": {
   "excavation_ext2_23": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipnickel_Boots",
   "qty": 1
  }
 },
 {
  "id": "ext-inipnickel_Ring",
  "name": "镍戒指",
  "category": "戒指",
  "reqLevel": 77,
  "xp": 700,
  "successChance": 0.7,
  "ingredients": {
   "excavation_ext2_23": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipnickel_Ring",
   "qty": 1
  }
 },
 {
  "id": "ext-cobaltAmulet",
  "name": "钴护符",
  "category": "饰品",
  "reqLevel": 80,
  "xp": 760,
  "successChance": 0.69,
  "ingredients": {
   "excavation_ext2_24": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "cobaltAmulet",
   "qty": 1
  }
 },
 {
  "id": "ext-inipcobalt_Weapon",
  "name": "钴刀",
  "category": "刀",
  "reqLevel": 80,
  "xp": 760,
  "successChance": 0.69,
  "ingredients": {
   "excavation_ext2_24": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipcobalt_Weapon",
   "qty": 1
  }
 },
 {
  "id": "ext-inipcobalt_Pot",
  "name": "钴锅",
  "category": "锅",
  "reqLevel": 80,
  "xp": 760,
  "successChance": 0.69,
  "ingredients": {
   "excavation_ext2_24": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipcobalt_Pot",
   "qty": 1
  }
 },
 {
  "id": "ext-inipcobalt_Board",
  "name": "钴砧板",
  "category": "砧板",
  "reqLevel": 80,
  "xp": 760,
  "successChance": 0.69,
  "ingredients": {
   "excavation_ext2_24": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipcobalt_Board",
   "qty": 1
  }
 },
 {
  "id": "ext-inipcobalt_Body",
  "name": "钴围裙",
  "category": "围裙",
  "reqLevel": 80,
  "xp": 760,
  "successChance": 0.69,
  "ingredients": {
   "excavation_ext2_24": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipcobalt_Body",
   "qty": 1
  }
 },
 {
  "id": "ext-inipcobalt_Helmet",
  "name": "钴厨师帽",
  "category": "厨师帽",
  "reqLevel": 80,
  "xp": 760,
  "successChance": 0.69,
  "ingredients": {
   "excavation_ext2_24": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipcobalt_Helmet",
   "qty": 1
  }
 },
 {
  "id": "ext-inipcobalt_Legs",
  "name": "钴腿甲",
  "category": "腿甲",
  "reqLevel": 80,
  "xp": 760,
  "successChance": 0.69,
  "ingredients": {
   "excavation_ext2_24": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipcobalt_Legs",
   "qty": 1
  }
 },
 {
  "id": "ext-inipcobalt_Boots",
  "name": "钴靴子",
  "category": "靴子",
  "reqLevel": 80,
  "xp": 760,
  "successChance": 0.69,
  "ingredients": {
   "excavation_ext2_24": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipcobalt_Boots",
   "qty": 1
  }
 },
 {
  "id": "ext-inipcobalt_Ring",
  "name": "钴戒指",
  "category": "戒指",
  "reqLevel": 80,
  "xp": 760,
  "successChance": 0.69,
  "ingredients": {
   "excavation_ext2_24": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipcobalt_Ring",
   "qty": 1
  }
 },
 {
  "id": "ext-titaniumAmulet",
  "name": "钛护符",
  "category": "饰品",
  "reqLevel": 87,
  "xp": 900,
  "successChance": 0.66,
  "ingredients": {
   "excavation_ext2_26": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "titaniumAmulet",
   "qty": 1
  }
 },
 {
  "id": "ext-iniptitanium_Weapon",
  "name": "钛刀",
  "category": "刀",
  "reqLevel": 87,
  "xp": 900,
  "successChance": 0.66,
  "ingredients": {
   "excavation_ext2_26": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "iniptitanium_Weapon",
   "qty": 1
  }
 },
 {
  "id": "ext-iniptitanium_Pot",
  "name": "钛锅",
  "category": "锅",
  "reqLevel": 87,
  "xp": 900,
  "successChance": 0.66,
  "ingredients": {
   "excavation_ext2_26": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "iniptitanium_Pot",
   "qty": 1
  }
 },
 {
  "id": "ext-iniptitanium_Board",
  "name": "钛砧板",
  "category": "砧板",
  "reqLevel": 87,
  "xp": 900,
  "successChance": 0.66,
  "ingredients": {
   "excavation_ext2_26": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "iniptitanium_Board",
   "qty": 1
  }
 },
 {
  "id": "ext-iniptitanium_Body",
  "name": "钛围裙",
  "category": "围裙",
  "reqLevel": 87,
  "xp": 900,
  "successChance": 0.66,
  "ingredients": {
   "excavation_ext2_26": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "iniptitanium_Body",
   "qty": 1
  }
 },
 {
  "id": "ext-iniptitanium_Helmet",
  "name": "钛厨师帽",
  "category": "厨师帽",
  "reqLevel": 87,
  "xp": 900,
  "successChance": 0.66,
  "ingredients": {
   "excavation_ext2_26": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "iniptitanium_Helmet",
   "qty": 1
  }
 },
 {
  "id": "ext-iniptitanium_Legs",
  "name": "钛腿甲",
  "category": "腿甲",
  "reqLevel": 87,
  "xp": 900,
  "successChance": 0.66,
  "ingredients": {
   "excavation_ext2_26": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "iniptitanium_Legs",
   "qty": 1
  }
 },
 {
  "id": "ext-iniptitanium_Boots",
  "name": "钛靴子",
  "category": "靴子",
  "reqLevel": 87,
  "xp": 900,
  "successChance": 0.66,
  "ingredients": {
   "excavation_ext2_26": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "iniptitanium_Boots",
   "qty": 1
  }
 },
 {
  "id": "ext-iniptitanium_Ring",
  "name": "钛戒指",
  "category": "戒指",
  "reqLevel": 87,
  "xp": 900,
  "successChance": 0.66,
  "ingredients": {
   "excavation_ext2_26": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "iniptitanium_Ring",
   "qty": 1
  }
 },
 {
  "id": "ext-graphiteAmulet",
  "name": "石墨护符",
  "category": "饰品",
  "reqLevel": 97,
  "xp": 1130,
  "successChance": 0.62,
  "ingredients": {
   "excavation_ext2_29": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "graphiteAmulet",
   "qty": 1
  }
 },
 {
  "id": "ext-inipgraphite_Weapon",
  "name": "石墨刀",
  "category": "刀",
  "reqLevel": 97,
  "xp": 1130,
  "successChance": 0.62,
  "ingredients": {
   "excavation_ext2_29": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipgraphite_Weapon",
   "qty": 1
  }
 },
 {
  "id": "ext-inipgraphite_Pot",
  "name": "石墨锅",
  "category": "锅",
  "reqLevel": 97,
  "xp": 1130,
  "successChance": 0.62,
  "ingredients": {
   "excavation_ext2_29": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipgraphite_Pot",
   "qty": 1
  }
 },
 {
  "id": "ext-inipgraphite_Board",
  "name": "石墨砧板",
  "category": "砧板",
  "reqLevel": 97,
  "xp": 1130,
  "successChance": 0.62,
  "ingredients": {
   "excavation_ext2_29": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipgraphite_Board",
   "qty": 1
  }
 },
 {
  "id": "ext-inipgraphite_Body",
  "name": "石墨围裙",
  "category": "围裙",
  "reqLevel": 97,
  "xp": 1130,
  "successChance": 0.62,
  "ingredients": {
   "excavation_ext2_29": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipgraphite_Body",
   "qty": 1
  }
 },
 {
  "id": "ext-inipgraphite_Helmet",
  "name": "石墨厨师帽",
  "category": "厨师帽",
  "reqLevel": 97,
  "xp": 1130,
  "successChance": 0.62,
  "ingredients": {
   "excavation_ext2_29": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipgraphite_Helmet",
   "qty": 1
  }
 },
 {
  "id": "ext-inipgraphite_Legs",
  "name": "石墨腿甲",
  "category": "腿甲",
  "reqLevel": 97,
  "xp": 1130,
  "successChance": 0.62,
  "ingredients": {
   "excavation_ext2_29": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipgraphite_Legs",
   "qty": 1
  }
 },
 {
  "id": "ext-inipgraphite_Boots",
  "name": "石墨靴子",
  "category": "靴子",
  "reqLevel": 97,
  "xp": 1130,
  "successChance": 0.62,
  "ingredients": {
   "excavation_ext2_29": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipgraphite_Boots",
   "qty": 1
  }
 },
 {
  "id": "ext-inipgraphite_Ring",
  "name": "石墨戒指",
  "category": "戒指",
  "reqLevel": 97,
  "xp": 1130,
  "successChance": 0.62,
  "ingredients": {
   "excavation_ext2_29": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipgraphite_Ring",
   "qty": 1
  }
 },
 {
  "id": "ext-gypsumAmulet",
  "name": "石膏护符",
  "category": "饰品",
  "reqLevel": 73,
  "xp": 640,
  "successChance": 0.71,
  "ingredients": {
   "excavation_ext_22": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "gypsumAmulet",
   "qty": 1
  }
 },
 {
  "id": "ext-inipgypsum_Weapon",
  "name": "石膏刀",
  "category": "刀",
  "reqLevel": 73,
  "xp": 640,
  "successChance": 0.71,
  "ingredients": {
   "excavation_ext_22": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipgypsum_Weapon",
   "qty": 1
  }
 },
 {
  "id": "ext-inipgypsum_Pot",
  "name": "石膏锅",
  "category": "锅",
  "reqLevel": 73,
  "xp": 640,
  "successChance": 0.71,
  "ingredients": {
   "excavation_ext_22": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipgypsum_Pot",
   "qty": 1
  }
 },
 {
  "id": "ext-inipgypsum_Board",
  "name": "石膏砧板",
  "category": "砧板",
  "reqLevel": 73,
  "xp": 640,
  "successChance": 0.71,
  "ingredients": {
   "excavation_ext_22": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipgypsum_Board",
   "qty": 1
  }
 },
 {
  "id": "ext-inipgypsum_Body",
  "name": "石膏围裙",
  "category": "围裙",
  "reqLevel": 73,
  "xp": 640,
  "successChance": 0.71,
  "ingredients": {
   "excavation_ext_22": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipgypsum_Body",
   "qty": 1
  }
 },
 {
  "id": "ext-inipgypsum_Helmet",
  "name": "石膏厨师帽",
  "category": "厨师帽",
  "reqLevel": 73,
  "xp": 640,
  "successChance": 0.71,
  "ingredients": {
   "excavation_ext_22": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipgypsum_Helmet",
   "qty": 1
  }
 },
 {
  "id": "ext-inipgypsum_Legs",
  "name": "石膏腿甲",
  "category": "腿甲",
  "reqLevel": 73,
  "xp": 640,
  "successChance": 0.71,
  "ingredients": {
   "excavation_ext_22": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipgypsum_Legs",
   "qty": 1
  }
 },
 {
  "id": "ext-inipgypsum_Boots",
  "name": "石膏靴子",
  "category": "靴子",
  "reqLevel": 73,
  "xp": 640,
  "successChance": 0.71,
  "ingredients": {
   "excavation_ext_22": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipgypsum_Boots",
   "qty": 1
  }
 },
 {
  "id": "ext-inipgypsum_Ring",
  "name": "石膏戒指",
  "category": "戒指",
  "reqLevel": 73,
  "xp": 640,
  "successChance": 0.71,
  "ingredients": {
   "excavation_ext_22": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipgypsum_Ring",
   "qty": 1
  }
 },
 {
  "id": "ext-saltpeterAmulet",
  "name": "硝石护符",
  "category": "饰品",
  "reqLevel": 77,
  "xp": 700,
  "successChance": 0.7,
  "ingredients": {
   "excavation_ext_23": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "saltpeterAmulet",
   "qty": 1
  }
 },
 {
  "id": "ext-inipsaltpeter_Weapon",
  "name": "硝石刀",
  "category": "刀",
  "reqLevel": 77,
  "xp": 700,
  "successChance": 0.7,
  "ingredients": {
   "excavation_ext_23": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipsaltpeter_Weapon",
   "qty": 1
  }
 },
 {
  "id": "ext-inipsaltpeter_Pot",
  "name": "硝石锅",
  "category": "锅",
  "reqLevel": 77,
  "xp": 700,
  "successChance": 0.7,
  "ingredients": {
   "excavation_ext_23": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipsaltpeter_Pot",
   "qty": 1
  }
 },
 {
  "id": "ext-inipsaltpeter_Board",
  "name": "硝石砧板",
  "category": "砧板",
  "reqLevel": 77,
  "xp": 700,
  "successChance": 0.7,
  "ingredients": {
   "excavation_ext_23": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipsaltpeter_Board",
   "qty": 1
  }
 },
 {
  "id": "ext-inipsaltpeter_Body",
  "name": "硝石围裙",
  "category": "围裙",
  "reqLevel": 77,
  "xp": 700,
  "successChance": 0.7,
  "ingredients": {
   "excavation_ext_23": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipsaltpeter_Body",
   "qty": 1
  }
 },
 {
  "id": "ext-inipsaltpeter_Helmet",
  "name": "硝石厨师帽",
  "category": "厨师帽",
  "reqLevel": 77,
  "xp": 700,
  "successChance": 0.7,
  "ingredients": {
   "excavation_ext_23": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipsaltpeter_Helmet",
   "qty": 1
  }
 },
 {
  "id": "ext-inipsaltpeter_Legs",
  "name": "硝石腿甲",
  "category": "腿甲",
  "reqLevel": 77,
  "xp": 700,
  "successChance": 0.7,
  "ingredients": {
   "excavation_ext_23": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipsaltpeter_Legs",
   "qty": 1
  }
 },
 {
  "id": "ext-inipsaltpeter_Boots",
  "name": "硝石靴子",
  "category": "靴子",
  "reqLevel": 77,
  "xp": 700,
  "successChance": 0.7,
  "ingredients": {
   "excavation_ext_23": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipsaltpeter_Boots",
   "qty": 1
  }
 },
 {
  "id": "ext-inipsaltpeter_Ring",
  "name": "硝石戒指",
  "category": "戒指",
  "reqLevel": 77,
  "xp": 700,
  "successChance": 0.7,
  "ingredients": {
   "excavation_ext_23": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipsaltpeter_Ring",
   "qty": 1
  }
 },
 {
  "id": "ext-sulfurAmulet",
  "name": "硫磺护符",
  "category": "饰品",
  "reqLevel": 80,
  "xp": 760,
  "successChance": 0.69,
  "ingredients": {
   "excavation_ext_24": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "sulfurAmulet",
   "qty": 1
  }
 },
 {
  "id": "ext-inipsulfur_Weapon",
  "name": "硫磺刀",
  "category": "刀",
  "reqLevel": 80,
  "xp": 760,
  "successChance": 0.69,
  "ingredients": {
   "excavation_ext_24": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipsulfur_Weapon",
   "qty": 1
  }
 },
 {
  "id": "ext-inipsulfur_Pot",
  "name": "硫磺锅",
  "category": "锅",
  "reqLevel": 80,
  "xp": 760,
  "successChance": 0.69,
  "ingredients": {
   "excavation_ext_24": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipsulfur_Pot",
   "qty": 1
  }
 },
 {
  "id": "ext-inipsulfur_Board",
  "name": "硫磺砧板",
  "category": "砧板",
  "reqLevel": 80,
  "xp": 760,
  "successChance": 0.69,
  "ingredients": {
   "excavation_ext_24": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipsulfur_Board",
   "qty": 1
  }
 },
 {
  "id": "ext-inipsulfur_Body",
  "name": "硫磺围裙",
  "category": "围裙",
  "reqLevel": 80,
  "xp": 760,
  "successChance": 0.69,
  "ingredients": {
   "excavation_ext_24": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipsulfur_Body",
   "qty": 1
  }
 },
 {
  "id": "ext-inipsulfur_Helmet",
  "name": "硫磺厨师帽",
  "category": "厨师帽",
  "reqLevel": 80,
  "xp": 760,
  "successChance": 0.69,
  "ingredients": {
   "excavation_ext_24": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipsulfur_Helmet",
   "qty": 1
  }
 },
 {
  "id": "ext-inipsulfur_Legs",
  "name": "硫磺腿甲",
  "category": "腿甲",
  "reqLevel": 80,
  "xp": 760,
  "successChance": 0.69,
  "ingredients": {
   "excavation_ext_24": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipsulfur_Legs",
   "qty": 1
  }
 },
 {
  "id": "ext-inipsulfur_Boots",
  "name": "硫磺靴子",
  "category": "靴子",
  "reqLevel": 80,
  "xp": 760,
  "successChance": 0.69,
  "ingredients": {
   "excavation_ext_24": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipsulfur_Boots",
   "qty": 1
  }
 },
 {
  "id": "ext-inipsulfur_Ring",
  "name": "硫磺戒指",
  "category": "戒指",
  "reqLevel": 80,
  "xp": 760,
  "successChance": 0.69,
  "ingredients": {
   "excavation_ext_24": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipsulfur_Ring",
   "qty": 1
  }
 },
 {
  "id": "ext-alumAmulet",
  "name": "明矾护符",
  "category": "饰品",
  "reqLevel": 84,
  "xp": 840,
  "successChance": 0.67,
  "ingredients": {
   "excavation_ext_25": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "alumAmulet",
   "qty": 1
  }
 },
 {
  "id": "ext-inipalum_Weapon",
  "name": "明矾刀",
  "category": "刀",
  "reqLevel": 84,
  "xp": 840,
  "successChance": 0.67,
  "ingredients": {
   "excavation_ext_25": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipalum_Weapon",
   "qty": 1
  }
 },
 {
  "id": "ext-inipalum_Pot",
  "name": "明矾锅",
  "category": "锅",
  "reqLevel": 84,
  "xp": 840,
  "successChance": 0.67,
  "ingredients": {
   "excavation_ext_25": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipalum_Pot",
   "qty": 1
  }
 },
 {
  "id": "ext-inipalum_Board",
  "name": "明矾砧板",
  "category": "砧板",
  "reqLevel": 84,
  "xp": 840,
  "successChance": 0.67,
  "ingredients": {
   "excavation_ext_25": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipalum_Board",
   "qty": 1
  }
 },
 {
  "id": "ext-inipalum_Body",
  "name": "明矾围裙",
  "category": "围裙",
  "reqLevel": 84,
  "xp": 840,
  "successChance": 0.67,
  "ingredients": {
   "excavation_ext_25": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipalum_Body",
   "qty": 1
  }
 },
 {
  "id": "ext-inipalum_Helmet",
  "name": "明矾厨师帽",
  "category": "厨师帽",
  "reqLevel": 84,
  "xp": 840,
  "successChance": 0.67,
  "ingredients": {
   "excavation_ext_25": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipalum_Helmet",
   "qty": 1
  }
 },
 {
  "id": "ext-inipalum_Legs",
  "name": "明矾腿甲",
  "category": "腿甲",
  "reqLevel": 84,
  "xp": 840,
  "successChance": 0.67,
  "ingredients": {
   "excavation_ext_25": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipalum_Legs",
   "qty": 1
  }
 },
 {
  "id": "ext-inipalum_Boots",
  "name": "明矾靴子",
  "category": "靴子",
  "reqLevel": 84,
  "xp": 840,
  "successChance": 0.67,
  "ingredients": {
   "excavation_ext_25": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipalum_Boots",
   "qty": 1
  }
 },
 {
  "id": "ext-inipalum_Ring",
  "name": "明矾戒指",
  "category": "戒指",
  "reqLevel": 84,
  "xp": 840,
  "successChance": 0.67,
  "ingredients": {
   "excavation_ext_25": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipalum_Ring",
   "qty": 1
  }
 },
 {
  "id": "ext-micaAmulet",
  "name": "云母护符",
  "category": "饰品",
  "reqLevel": 87,
  "xp": 900,
  "successChance": 0.66,
  "ingredients": {
   "excavation_ext_26": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "micaAmulet",
   "qty": 1
  }
 },
 {
  "id": "ext-inipmica_Weapon",
  "name": "云母刀",
  "category": "刀",
  "reqLevel": 87,
  "xp": 900,
  "successChance": 0.66,
  "ingredients": {
   "excavation_ext_26": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipmica_Weapon",
   "qty": 1
  }
 },
 {
  "id": "ext-inipmica_Pot",
  "name": "云母锅",
  "category": "锅",
  "reqLevel": 87,
  "xp": 900,
  "successChance": 0.66,
  "ingredients": {
   "excavation_ext_26": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipmica_Pot",
   "qty": 1
  }
 },
 {
  "id": "ext-inipmica_Board",
  "name": "云母砧板",
  "category": "砧板",
  "reqLevel": 87,
  "xp": 900,
  "successChance": 0.66,
  "ingredients": {
   "excavation_ext_26": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipmica_Board",
   "qty": 1
  }
 },
 {
  "id": "ext-inipmica_Body",
  "name": "云母围裙",
  "category": "围裙",
  "reqLevel": 87,
  "xp": 900,
  "successChance": 0.66,
  "ingredients": {
   "excavation_ext_26": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipmica_Body",
   "qty": 1
  }
 },
 {
  "id": "ext-inipmica_Helmet",
  "name": "云母厨师帽",
  "category": "厨师帽",
  "reqLevel": 87,
  "xp": 900,
  "successChance": 0.66,
  "ingredients": {
   "excavation_ext_26": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipmica_Helmet",
   "qty": 1
  }
 },
 {
  "id": "ext-inipmica_Legs",
  "name": "云母腿甲",
  "category": "腿甲",
  "reqLevel": 87,
  "xp": 900,
  "successChance": 0.66,
  "ingredients": {
   "excavation_ext_26": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipmica_Legs",
   "qty": 1
  }
 },
 {
  "id": "ext-inipmica_Boots",
  "name": "云母靴子",
  "category": "靴子",
  "reqLevel": 87,
  "xp": 900,
  "successChance": 0.66,
  "ingredients": {
   "excavation_ext_26": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipmica_Boots",
   "qty": 1
  }
 },
 {
  "id": "ext-inipmica_Ring",
  "name": "云母戒指",
  "category": "戒指",
  "reqLevel": 87,
  "xp": 900,
  "successChance": 0.66,
  "ingredients": {
   "excavation_ext_26": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipmica_Ring",
   "qty": 1
  }
 },
 {
  "id": "ext-quartzAmulet",
  "name": "石英护符",
  "category": "饰品",
  "reqLevel": 90,
  "xp": 960,
  "successChance": 0.65,
  "ingredients": {
   "excavation_ext_27": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "quartzAmulet",
   "qty": 1
  }
 },
 {
  "id": "ext-inipquartz_Weapon",
  "name": "石英刀",
  "category": "刀",
  "reqLevel": 90,
  "xp": 960,
  "successChance": 0.65,
  "ingredients": {
   "excavation_ext_27": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipquartz_Weapon",
   "qty": 1
  }
 },
 {
  "id": "ext-inipquartz_Pot",
  "name": "石英锅",
  "category": "锅",
  "reqLevel": 90,
  "xp": 960,
  "successChance": 0.65,
  "ingredients": {
   "excavation_ext_27": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipquartz_Pot",
   "qty": 1
  }
 },
 {
  "id": "ext-inipquartz_Board",
  "name": "石英砧板",
  "category": "砧板",
  "reqLevel": 90,
  "xp": 960,
  "successChance": 0.65,
  "ingredients": {
   "excavation_ext_27": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipquartz_Board",
   "qty": 1
  }
 },
 {
  "id": "ext-inipquartz_Body",
  "name": "石英围裙",
  "category": "围裙",
  "reqLevel": 90,
  "xp": 960,
  "successChance": 0.65,
  "ingredients": {
   "excavation_ext_27": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipquartz_Body",
   "qty": 1
  }
 },
 {
  "id": "ext-inipquartz_Helmet",
  "name": "石英厨师帽",
  "category": "厨师帽",
  "reqLevel": 90,
  "xp": 960,
  "successChance": 0.65,
  "ingredients": {
   "excavation_ext_27": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipquartz_Helmet",
   "qty": 1
  }
 },
 {
  "id": "ext-inipquartz_Legs",
  "name": "石英腿甲",
  "category": "腿甲",
  "reqLevel": 90,
  "xp": 960,
  "successChance": 0.65,
  "ingredients": {
   "excavation_ext_27": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipquartz_Legs",
   "qty": 1
  }
 },
 {
  "id": "ext-inipquartz_Boots",
  "name": "石英靴子",
  "category": "靴子",
  "reqLevel": 90,
  "xp": 960,
  "successChance": 0.65,
  "ingredients": {
   "excavation_ext_27": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipquartz_Boots",
   "qty": 1
  }
 },
 {
  "id": "ext-inipquartz_Ring",
  "name": "石英戒指",
  "category": "戒指",
  "reqLevel": 90,
  "xp": 960,
  "successChance": 0.65,
  "ingredients": {
   "excavation_ext_27": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipquartz_Ring",
   "qty": 1
  }
 },
 {
  "id": "ext-jadeRing",
  "name": "翡翠戒指",
  "category": "饰品",
  "reqLevel": 94,
  "xp": 1050,
  "successChance": 0.63,
  "ingredients": {
   "excavation_ext_28": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "jadeRing",
   "qty": 1
  }
 },
 {
  "id": "ext-inipjade_Weapon",
  "name": "翡翠刀",
  "category": "刀",
  "reqLevel": 94,
  "xp": 1050,
  "successChance": 0.63,
  "ingredients": {
   "excavation_ext_28": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipjade_Weapon",
   "qty": 1
  }
 },
 {
  "id": "ext-inipjade_Pot",
  "name": "翡翠锅",
  "category": "锅",
  "reqLevel": 94,
  "xp": 1050,
  "successChance": 0.63,
  "ingredients": {
   "excavation_ext_28": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipjade_Pot",
   "qty": 1
  }
 },
 {
  "id": "ext-inipjade_Board",
  "name": "翡翠砧板",
  "category": "砧板",
  "reqLevel": 94,
  "xp": 1050,
  "successChance": 0.63,
  "ingredients": {
   "excavation_ext_28": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipjade_Board",
   "qty": 1
  }
 },
 {
  "id": "ext-inipjade_Body",
  "name": "翡翠围裙",
  "category": "围裙",
  "reqLevel": 94,
  "xp": 1050,
  "successChance": 0.63,
  "ingredients": {
   "excavation_ext_28": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipjade_Body",
   "qty": 1
  }
 },
 {
  "id": "ext-inipjade_Helmet",
  "name": "翡翠厨师帽",
  "category": "厨师帽",
  "reqLevel": 94,
  "xp": 1050,
  "successChance": 0.63,
  "ingredients": {
   "excavation_ext_28": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipjade_Helmet",
   "qty": 1
  }
 },
 {
  "id": "ext-inipjade_Amulet",
  "name": "翡翠护符",
  "category": "护符",
  "reqLevel": 94,
  "xp": 1050,
  "successChance": 0.63,
  "ingredients": {
   "excavation_ext_28": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipjade_Amulet",
   "qty": 1
  }
 },
 {
  "id": "ext-inipjade_Legs",
  "name": "翡翠腿甲",
  "category": "腿甲",
  "reqLevel": 94,
  "xp": 1050,
  "successChance": 0.63,
  "ingredients": {
   "excavation_ext_28": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipjade_Legs",
   "qty": 1
  }
 },
 {
  "id": "ext-inipjade_Boots",
  "name": "翡翠靴子",
  "category": "靴子",
  "reqLevel": 94,
  "xp": 1050,
  "successChance": 0.63,
  "ingredients": {
   "excavation_ext_28": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipjade_Boots",
   "qty": 1
  }
 },
 {
  "id": "ext-agateRing",
  "name": "玛瑙戒指",
  "category": "饰品",
  "reqLevel": 97,
  "xp": 1130,
  "successChance": 0.62,
  "ingredients": {
   "excavation_ext_29": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "agateRing",
   "qty": 1
  }
 },
 {
  "id": "ext-inipagate_Weapon",
  "name": "玛瑙刀",
  "category": "刀",
  "reqLevel": 97,
  "xp": 1130,
  "successChance": 0.62,
  "ingredients": {
   "excavation_ext_29": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipagate_Weapon",
   "qty": 1
  }
 },
 {
  "id": "ext-inipagate_Pot",
  "name": "玛瑙锅",
  "category": "锅",
  "reqLevel": 97,
  "xp": 1130,
  "successChance": 0.62,
  "ingredients": {
   "excavation_ext_29": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipagate_Pot",
   "qty": 1
  }
 },
 {
  "id": "ext-inipagate_Board",
  "name": "玛瑙砧板",
  "category": "砧板",
  "reqLevel": 97,
  "xp": 1130,
  "successChance": 0.62,
  "ingredients": {
   "excavation_ext_29": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipagate_Board",
   "qty": 1
  }
 },
 {
  "id": "ext-inipagate_Body",
  "name": "玛瑙围裙",
  "category": "围裙",
  "reqLevel": 97,
  "xp": 1130,
  "successChance": 0.62,
  "ingredients": {
   "excavation_ext_29": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipagate_Body",
   "qty": 1
  }
 },
 {
  "id": "ext-inipagate_Helmet",
  "name": "玛瑙厨师帽",
  "category": "厨师帽",
  "reqLevel": 97,
  "xp": 1130,
  "successChance": 0.62,
  "ingredients": {
   "excavation_ext_29": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipagate_Helmet",
   "qty": 1
  }
 },
 {
  "id": "ext-inipagate_Amulet",
  "name": "玛瑙护符",
  "category": "护符",
  "reqLevel": 97,
  "xp": 1130,
  "successChance": 0.62,
  "ingredients": {
   "excavation_ext_29": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipagate_Amulet",
   "qty": 1
  }
 },
 {
  "id": "ext-inipagate_Legs",
  "name": "玛瑙腿甲",
  "category": "腿甲",
  "reqLevel": 97,
  "xp": 1130,
  "successChance": 0.62,
  "ingredients": {
   "excavation_ext_29": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipagate_Legs",
   "qty": 1
  }
 },
 {
  "id": "ext-inipagate_Boots",
  "name": "玛瑙靴子",
  "category": "靴子",
  "reqLevel": 97,
  "xp": 1130,
  "successChance": 0.62,
  "ingredients": {
   "excavation_ext_29": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipagate_Boots",
   "qty": 1
  }
 },
 {
  "id": "ext-sapphireRing",
  "name": "蓝晶戒指",
  "category": "饰品",
  "reqLevel": 99,
  "xp": 1200,
  "successChance": 0.6,
  "ingredients": {
   "excavation_ext_30": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "sapphireRing",
   "qty": 1
  }
 },
 {
  "id": "ext-inipsapphire_Weapon",
  "name": "蓝晶刀",
  "category": "刀",
  "reqLevel": 99,
  "xp": 1200,
  "successChance": 0.6,
  "ingredients": {
   "excavation_ext_30": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipsapphire_Weapon",
   "qty": 1
  }
 },
 {
  "id": "ext-inipsapphire_Pot",
  "name": "蓝晶锅",
  "category": "锅",
  "reqLevel": 99,
  "xp": 1200,
  "successChance": 0.6,
  "ingredients": {
   "excavation_ext_30": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipsapphire_Pot",
   "qty": 1
  }
 },
 {
  "id": "ext-inipsapphire_Board",
  "name": "蓝晶砧板",
  "category": "砧板",
  "reqLevel": 99,
  "xp": 1200,
  "successChance": 0.6,
  "ingredients": {
   "excavation_ext_30": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipsapphire_Board",
   "qty": 1
  }
 },
 {
  "id": "ext-inipsapphire_Body",
  "name": "蓝晶围裙",
  "category": "围裙",
  "reqLevel": 99,
  "xp": 1200,
  "successChance": 0.6,
  "ingredients": {
   "excavation_ext_30": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipsapphire_Body",
   "qty": 1
  }
 },
 {
  "id": "ext-inipsapphire_Helmet",
  "name": "蓝晶厨师帽",
  "category": "厨师帽",
  "reqLevel": 99,
  "xp": 1200,
  "successChance": 0.6,
  "ingredients": {
   "excavation_ext_30": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipsapphire_Helmet",
   "qty": 1
  }
 },
 {
  "id": "ext-inipsapphire_Amulet",
  "name": "蓝晶护符",
  "category": "护符",
  "reqLevel": 99,
  "xp": 1200,
  "successChance": 0.6,
  "ingredients": {
   "excavation_ext_30": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipsapphire_Amulet",
   "qty": 1
  }
 },
 {
  "id": "ext-inipsapphire_Legs",
  "name": "蓝晶腿甲",
  "category": "腿甲",
  "reqLevel": 99,
  "xp": 1200,
  "successChance": 0.6,
  "ingredients": {
   "excavation_ext_30": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipsapphire_Legs",
   "qty": 1
  }
 },
 {
  "id": "ext-inipsapphire_Boots",
  "name": "蓝晶靴子",
  "category": "靴子",
  "reqLevel": 99,
  "xp": 1200,
  "successChance": 0.6,
  "ingredients": {
   "excavation_ext_30": 2,
   "saltOre": 1
  },
  "output": {
   "itemId": "inipsapphire_Boots",
   "qty": 1
  }
 }
]
export const SMITHING_SET_ITEMS = [
 {
  "id": "smith_铜_legs",
  "name": "铜腿甲",
  "type": "equipment",
  "category": "legs",
  "tier": 1,
  "value": 60,
  "stackable": false,
  "slot": "legs",
  "quality": "普通",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_铜_boots",
  "name": "铜靴子",
  "type": "equipment",
  "category": "boots",
  "tier": 1,
  "value": 60,
  "stackable": false,
  "slot": "boots",
  "quality": "普通",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_铜_ring",
  "name": "铜戒指",
  "type": "equipment",
  "category": "ring",
  "tier": 1,
  "value": 60,
  "stackable": false,
  "slot": "ring",
  "quality": "普通",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "smith_铁_legs",
  "name": "铁腿甲",
  "type": "equipment",
  "category": "legs",
  "tier": 1,
  "value": 90,
  "stackable": false,
  "slot": "legs",
  "quality": "普通",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_铁_boots",
  "name": "铁靴子",
  "type": "equipment",
  "category": "boots",
  "tier": 1,
  "value": 90,
  "stackable": false,
  "slot": "boots",
  "quality": "普通",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_铁_ring",
  "name": "铁戒指",
  "type": "equipment",
  "category": "ring",
  "tier": 1,
  "value": 90,
  "stackable": false,
  "slot": "ring",
  "quality": "普通",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "smith_青铜_legs",
  "name": "青铜腿甲",
  "type": "equipment",
  "category": "legs",
  "tier": 2,
  "value": 120,
  "stackable": false,
  "slot": "legs",
  "quality": "精良",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_青铜_boots",
  "name": "青铜靴子",
  "type": "equipment",
  "category": "boots",
  "tier": 2,
  "value": 120,
  "stackable": false,
  "slot": "boots",
  "quality": "精良",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_青铜_ring",
  "name": "青铜戒指",
  "type": "equipment",
  "category": "ring",
  "tier": 2,
  "value": 120,
  "stackable": false,
  "slot": "ring",
  "quality": "精良",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "smith_钢_legs",
  "name": "钢腿甲",
  "type": "equipment",
  "category": "legs",
  "tier": 2,
  "value": 150,
  "stackable": false,
  "slot": "legs",
  "quality": "精良",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_钢_boots",
  "name": "钢靴子",
  "type": "equipment",
  "category": "boots",
  "tier": 2,
  "value": 150,
  "stackable": false,
  "slot": "boots",
  "quality": "精良",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_钢_ring",
  "name": "钢戒指",
  "type": "equipment",
  "category": "ring",
  "tier": 2,
  "value": 150,
  "stackable": false,
  "slot": "ring",
  "quality": "精良",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "smith_银_legs",
  "name": "银腿甲",
  "type": "equipment",
  "category": "legs",
  "tier": 3,
  "value": 180,
  "stackable": false,
  "slot": "legs",
  "quality": "精良",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_银_boots",
  "name": "银靴子",
  "type": "equipment",
  "category": "boots",
  "tier": 3,
  "value": 180,
  "stackable": false,
  "slot": "boots",
  "quality": "精良",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_银_ring",
  "name": "银戒指",
  "type": "equipment",
  "category": "ring",
  "tier": 3,
  "value": 180,
  "stackable": false,
  "slot": "ring",
  "quality": "精良",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "smith_秘银_legs",
  "name": "秘银腿甲",
  "type": "equipment",
  "category": "legs",
  "tier": 3,
  "value": 210,
  "stackable": false,
  "slot": "legs",
  "quality": "稀有",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_秘银_boots",
  "name": "秘银靴子",
  "type": "equipment",
  "category": "boots",
  "tier": 3,
  "value": 210,
  "stackable": false,
  "slot": "boots",
  "quality": "稀有",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_秘银_ring",
  "name": "秘银戒指",
  "type": "equipment",
  "category": "ring",
  "tier": 3,
  "value": 210,
  "stackable": false,
  "slot": "ring",
  "quality": "稀有",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "smith_金_legs",
  "name": "金腿甲",
  "type": "equipment",
  "category": "legs",
  "tier": 4,
  "value": 240,
  "stackable": false,
  "slot": "legs",
  "quality": "稀有",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_金_boots",
  "name": "金靴子",
  "type": "equipment",
  "category": "boots",
  "tier": 4,
  "value": 240,
  "stackable": false,
  "slot": "boots",
  "quality": "稀有",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_金_ring",
  "name": "金戒指",
  "type": "equipment",
  "category": "ring",
  "tier": 4,
  "value": 240,
  "stackable": false,
  "slot": "ring",
  "quality": "稀有",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "smith_精金_legs",
  "name": "精金腿甲",
  "type": "equipment",
  "category": "legs",
  "tier": 4,
  "value": 270,
  "stackable": false,
  "slot": "legs",
  "quality": "史诗",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_精金_boots",
  "name": "精金靴子",
  "type": "equipment",
  "category": "boots",
  "tier": 4,
  "value": 270,
  "stackable": false,
  "slot": "boots",
  "quality": "史诗",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_精金_ring",
  "name": "精金戒指",
  "type": "equipment",
  "category": "ring",
  "tier": 4,
  "value": 270,
  "stackable": false,
  "slot": "ring",
  "quality": "史诗",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "smith_水晶_legs",
  "name": "水晶腿甲",
  "type": "equipment",
  "category": "legs",
  "tier": 5,
  "value": 300,
  "stackable": false,
  "slot": "legs",
  "quality": "史诗",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_水晶_boots",
  "name": "水晶靴子",
  "type": "equipment",
  "category": "boots",
  "tier": 5,
  "value": 300,
  "stackable": false,
  "slot": "boots",
  "quality": "史诗",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_水晶_ring",
  "name": "水晶戒指",
  "type": "equipment",
  "category": "ring",
  "tier": 5,
  "value": 300,
  "stackable": false,
  "slot": "ring",
  "quality": "史诗",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "smith_玄铁_legs",
  "name": "玄铁腿甲",
  "type": "equipment",
  "category": "legs",
  "tier": 5,
  "value": 330,
  "stackable": false,
  "slot": "legs",
  "quality": "传说",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_玄铁_boots",
  "name": "玄铁靴子",
  "type": "equipment",
  "category": "boots",
  "tier": 5,
  "value": 330,
  "stackable": false,
  "slot": "boots",
  "quality": "传说",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_玄铁_ring",
  "name": "玄铁戒指",
  "type": "equipment",
  "category": "ring",
  "tier": 5,
  "value": 330,
  "stackable": false,
  "slot": "ring",
  "quality": "传说",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "smith_寒铁_legs",
  "name": "寒铁腿甲",
  "type": "equipment",
  "category": "legs",
  "tier": 6,
  "value": 360,
  "stackable": false,
  "slot": "legs",
  "quality": "传说",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_寒铁_boots",
  "name": "寒铁靴子",
  "type": "equipment",
  "category": "boots",
  "tier": 6,
  "value": 360,
  "stackable": false,
  "slot": "boots",
  "quality": "传说",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_寒铁_ring",
  "name": "寒铁戒指",
  "type": "equipment",
  "category": "ring",
  "tier": 6,
  "value": 360,
  "stackable": false,
  "slot": "ring",
  "quality": "传说",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "smith_陨铁_legs",
  "name": "陨铁腿甲",
  "type": "equipment",
  "category": "legs",
  "tier": 6,
  "value": 390,
  "stackable": false,
  "slot": "legs",
  "quality": "传说",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_陨铁_boots",
  "name": "陨铁靴子",
  "type": "equipment",
  "category": "boots",
  "tier": 6,
  "value": 390,
  "stackable": false,
  "slot": "boots",
  "quality": "传说",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_陨铁_ring",
  "name": "陨铁戒指",
  "type": "equipment",
  "category": "ring",
  "tier": 6,
  "value": 390,
  "stackable": false,
  "slot": "ring",
  "quality": "传说",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "smith_星辰_legs",
  "name": "星辰腿甲",
  "type": "equipment",
  "category": "legs",
  "tier": 7,
  "value": 420,
  "stackable": false,
  "slot": "legs",
  "quality": "神话",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_星辰_boots",
  "name": "星辰靴子",
  "type": "equipment",
  "category": "boots",
  "tier": 7,
  "value": 420,
  "stackable": false,
  "slot": "boots",
  "quality": "神话",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_星辰_ring",
  "name": "星辰戒指",
  "type": "equipment",
  "category": "ring",
  "tier": 7,
  "value": 420,
  "stackable": false,
  "slot": "ring",
  "quality": "神话",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "smith_龙鳞_legs",
  "name": "龙鳞腿甲",
  "type": "equipment",
  "category": "legs",
  "tier": 7,
  "value": 450,
  "stackable": false,
  "slot": "legs",
  "quality": "神话",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_龙鳞_boots",
  "name": "龙鳞靴子",
  "type": "equipment",
  "category": "boots",
  "tier": 7,
  "value": 450,
  "stackable": false,
  "slot": "boots",
  "quality": "神话",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_龙鳞_ring",
  "name": "龙鳞戒指",
  "type": "equipment",
  "category": "ring",
  "tier": 7,
  "value": 450,
  "stackable": false,
  "slot": "ring",
  "quality": "神话",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "smith_琉璃_legs",
  "name": "琉璃腿甲",
  "type": "equipment",
  "category": "legs",
  "tier": 8,
  "value": 480,
  "stackable": false,
  "slot": "legs",
  "quality": "神话",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_琉璃_boots",
  "name": "琉璃靴子",
  "type": "equipment",
  "category": "boots",
  "tier": 8,
  "value": 480,
  "stackable": false,
  "slot": "boots",
  "quality": "神话",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_琉璃_ring",
  "name": "琉璃戒指",
  "type": "equipment",
  "category": "ring",
  "tier": 8,
  "value": 480,
  "stackable": false,
  "slot": "ring",
  "quality": "神话",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "smith_鎏金_legs",
  "name": "鎏金腿甲",
  "type": "equipment",
  "category": "legs",
  "tier": 8,
  "value": 510,
  "stackable": false,
  "slot": "legs",
  "quality": "神话",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_鎏金_boots",
  "name": "鎏金靴子",
  "type": "equipment",
  "category": "boots",
  "tier": 8,
  "value": 510,
  "stackable": false,
  "slot": "boots",
  "quality": "神话",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_鎏金_ring",
  "name": "鎏金戒指",
  "type": "equipment",
  "category": "ring",
  "tier": 8,
  "value": 510,
  "stackable": false,
  "slot": "ring",
  "quality": "神话",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "smith_钨_weapon",
  "name": "钨刀",
  "type": "equipment",
  "category": "weapon",
  "tier": 9,
  "value": 540,
  "stackable": false,
  "slot": "weapon",
  "quality": "神话",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "smith_钨_offhand",
  "name": "钨锅",
  "type": "equipment",
  "category": "offhand",
  "tier": 9,
  "value": 540,
  "stackable": false,
  "slot": "offhand",
  "quality": "神话",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_钨_body",
  "name": "钨围裙",
  "type": "equipment",
  "category": "body",
  "tier": 9,
  "value": 540,
  "stackable": false,
  "slot": "body",
  "quality": "神话",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_钨_helmet",
  "name": "钨厨师帽",
  "type": "equipment",
  "category": "helmet",
  "tier": 9,
  "value": 540,
  "stackable": false,
  "slot": "helmet",
  "quality": "神话",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_钨_legs",
  "name": "钨腿甲",
  "type": "equipment",
  "category": "legs",
  "tier": 9,
  "value": 540,
  "stackable": false,
  "slot": "legs",
  "quality": "神话",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_钨_boots",
  "name": "钨靴子",
  "type": "equipment",
  "category": "boots",
  "tier": 9,
  "value": 540,
  "stackable": false,
  "slot": "boots",
  "quality": "神话",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_钨_ring",
  "name": "钨戒指",
  "type": "equipment",
  "category": "ring",
  "tier": 9,
  "value": 540,
  "stackable": false,
  "slot": "ring",
  "quality": "神话",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "smith_锰_weapon",
  "name": "锰刀",
  "type": "equipment",
  "category": "weapon",
  "tier": 9,
  "value": 570,
  "stackable": false,
  "slot": "weapon",
  "quality": "神话",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "smith_锰_offhand",
  "name": "锰锅",
  "type": "equipment",
  "category": "offhand",
  "tier": 9,
  "value": 570,
  "stackable": false,
  "slot": "offhand",
  "quality": "神话",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_锰_body",
  "name": "锰围裙",
  "type": "equipment",
  "category": "body",
  "tier": 9,
  "value": 570,
  "stackable": false,
  "slot": "body",
  "quality": "神话",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_锰_helmet",
  "name": "锰厨师帽",
  "type": "equipment",
  "category": "helmet",
  "tier": 9,
  "value": 570,
  "stackable": false,
  "slot": "helmet",
  "quality": "神话",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_锰_legs",
  "name": "锰腿甲",
  "type": "equipment",
  "category": "legs",
  "tier": 9,
  "value": 570,
  "stackable": false,
  "slot": "legs",
  "quality": "神话",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_锰_boots",
  "name": "锰靴子",
  "type": "equipment",
  "category": "boots",
  "tier": 9,
  "value": 570,
  "stackable": false,
  "slot": "boots",
  "quality": "神话",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_锰_ring",
  "name": "锰戒指",
  "type": "equipment",
  "category": "ring",
  "tier": 9,
  "value": 570,
  "stackable": false,
  "slot": "ring",
  "quality": "神话",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "smith_钒_weapon",
  "name": "钒刀",
  "type": "equipment",
  "category": "weapon",
  "tier": 10,
  "value": 600,
  "stackable": false,
  "slot": "weapon",
  "quality": "神话",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "smith_钒_offhand",
  "name": "钒锅",
  "type": "equipment",
  "category": "offhand",
  "tier": 10,
  "value": 600,
  "stackable": false,
  "slot": "offhand",
  "quality": "神话",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_钒_body",
  "name": "钒围裙",
  "type": "equipment",
  "category": "body",
  "tier": 10,
  "value": 600,
  "stackable": false,
  "slot": "body",
  "quality": "神话",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_钒_helmet",
  "name": "钒厨师帽",
  "type": "equipment",
  "category": "helmet",
  "tier": 10,
  "value": 600,
  "stackable": false,
  "slot": "helmet",
  "quality": "神话",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_钒_legs",
  "name": "钒腿甲",
  "type": "equipment",
  "category": "legs",
  "tier": 10,
  "value": 600,
  "stackable": false,
  "slot": "legs",
  "quality": "神话",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_钒_boots",
  "name": "钒靴子",
  "type": "equipment",
  "category": "boots",
  "tier": 10,
  "value": 600,
  "stackable": false,
  "slot": "boots",
  "quality": "神话",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_钒_ring",
  "name": "钒戒指",
  "type": "equipment",
  "category": "ring",
  "tier": 10,
  "value": 600,
  "stackable": false,
  "slot": "ring",
  "quality": "神话",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "smith_萤_weapon",
  "name": "萤刀",
  "type": "equipment",
  "category": "weapon",
  "tier": 10,
  "value": 630,
  "stackable": false,
  "slot": "weapon",
  "quality": "神话",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "smith_萤_offhand",
  "name": "萤锅",
  "type": "equipment",
  "category": "offhand",
  "tier": 10,
  "value": 630,
  "stackable": false,
  "slot": "offhand",
  "quality": "神话",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_萤_body",
  "name": "萤围裙",
  "type": "equipment",
  "category": "body",
  "tier": 10,
  "value": 630,
  "stackable": false,
  "slot": "body",
  "quality": "神话",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_萤_helmet",
  "name": "萤厨师帽",
  "type": "equipment",
  "category": "helmet",
  "tier": 10,
  "value": 630,
  "stackable": false,
  "slot": "helmet",
  "quality": "神话",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_萤_amulet",
  "name": "萤调味瓶",
  "type": "equipment",
  "category": "amulet",
  "tier": 10,
  "value": 630,
  "stackable": false,
  "slot": "amulet",
  "quality": "神话",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_萤_legs",
  "name": "萤腿甲",
  "type": "equipment",
  "category": "legs",
  "tier": 10,
  "value": 630,
  "stackable": false,
  "slot": "legs",
  "quality": "神话",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "smith_萤_boots",
  "name": "萤靴子",
  "type": "equipment",
  "category": "boots",
  "tier": 10,
  "value": 630,
  "stackable": false,
  "slot": "boots",
  "quality": "神话",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipamethyst_Weapon",
  "name": "紫水晶刀",
  "type": "equipment",
  "category": "weapon",
  "tier": 5,
  "value": 180,
  "stackable": false,
  "slot": "weapon",
  "quality": "精良",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipamethyst_Pot",
  "name": "紫水晶锅",
  "type": "equipment",
  "category": "offhand",
  "tier": 5,
  "value": 180,
  "stackable": false,
  "slot": "offhand",
  "quality": "精良",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipamethyst_Board",
  "name": "紫水晶砧板",
  "type": "equipment",
  "category": "offhand",
  "tier": 5,
  "value": 180,
  "stackable": false,
  "slot": "offhand",
  "quality": "精良",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipamethyst_Body",
  "name": "紫水晶围裙",
  "type": "equipment",
  "category": "body",
  "tier": 5,
  "value": 180,
  "stackable": false,
  "slot": "body",
  "quality": "精良",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipamethyst_Helmet",
  "name": "紫水晶厨师帽",
  "type": "equipment",
  "category": "helmet",
  "tier": 5,
  "value": 180,
  "stackable": false,
  "slot": "helmet",
  "quality": "精良",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipamethyst_Amulet",
  "name": "紫水晶护符",
  "type": "equipment",
  "category": "amulet",
  "tier": 5,
  "value": 180,
  "stackable": false,
  "slot": "amulet",
  "quality": "精良",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipamethyst_Legs",
  "name": "紫水晶腿甲",
  "type": "equipment",
  "category": "legs",
  "tier": 5,
  "value": 180,
  "stackable": false,
  "slot": "legs",
  "quality": "精良",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipamethyst_Boots",
  "name": "紫水晶靴子",
  "type": "equipment",
  "category": "boots",
  "tier": 5,
  "value": 180,
  "stackable": false,
  "slot": "boots",
  "quality": "精良",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipturquoise_Weapon",
  "name": "绿松石刀",
  "type": "equipment",
  "category": "weapon",
  "tier": 5,
  "value": 180,
  "stackable": false,
  "slot": "weapon",
  "quality": "精良",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipturquoise_Pot",
  "name": "绿松石锅",
  "type": "equipment",
  "category": "offhand",
  "tier": 5,
  "value": 180,
  "stackable": false,
  "slot": "offhand",
  "quality": "精良",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipturquoise_Board",
  "name": "绿松石砧板",
  "type": "equipment",
  "category": "offhand",
  "tier": 5,
  "value": 180,
  "stackable": false,
  "slot": "offhand",
  "quality": "精良",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipturquoise_Body",
  "name": "绿松石围裙",
  "type": "equipment",
  "category": "body",
  "tier": 5,
  "value": 180,
  "stackable": false,
  "slot": "body",
  "quality": "精良",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipturquoise_Helmet",
  "name": "绿松石厨师帽",
  "type": "equipment",
  "category": "helmet",
  "tier": 5,
  "value": 180,
  "stackable": false,
  "slot": "helmet",
  "quality": "精良",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipturquoise_Amulet",
  "name": "绿松石护符",
  "type": "equipment",
  "category": "amulet",
  "tier": 5,
  "value": 180,
  "stackable": false,
  "slot": "amulet",
  "quality": "精良",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipturquoise_Legs",
  "name": "绿松石腿甲",
  "type": "equipment",
  "category": "legs",
  "tier": 5,
  "value": 180,
  "stackable": false,
  "slot": "legs",
  "quality": "精良",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipturquoise_Boots",
  "name": "绿松石靴子",
  "type": "equipment",
  "category": "boots",
  "tier": 5,
  "value": 180,
  "stackable": false,
  "slot": "boots",
  "quality": "精良",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipruby_Weapon",
  "name": "红宝石刀",
  "type": "equipment",
  "category": "weapon",
  "tier": 5,
  "value": 180,
  "stackable": false,
  "slot": "weapon",
  "quality": "精良",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipruby_Pot",
  "name": "红宝石锅",
  "type": "equipment",
  "category": "offhand",
  "tier": 5,
  "value": 180,
  "stackable": false,
  "slot": "offhand",
  "quality": "精良",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipruby_Board",
  "name": "红宝石砧板",
  "type": "equipment",
  "category": "offhand",
  "tier": 5,
  "value": 180,
  "stackable": false,
  "slot": "offhand",
  "quality": "精良",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipruby_Body",
  "name": "红宝石围裙",
  "type": "equipment",
  "category": "body",
  "tier": 5,
  "value": 180,
  "stackable": false,
  "slot": "body",
  "quality": "精良",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipruby_Helmet",
  "name": "红宝石厨师帽",
  "type": "equipment",
  "category": "helmet",
  "tier": 5,
  "value": 180,
  "stackable": false,
  "slot": "helmet",
  "quality": "精良",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipruby_Amulet",
  "name": "红宝石护符",
  "type": "equipment",
  "category": "amulet",
  "tier": 5,
  "value": 180,
  "stackable": false,
  "slot": "amulet",
  "quality": "精良",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipruby_Legs",
  "name": "红宝石腿甲",
  "type": "equipment",
  "category": "legs",
  "tier": 5,
  "value": 180,
  "stackable": false,
  "slot": "legs",
  "quality": "精良",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipruby_Boots",
  "name": "红宝石靴子",
  "type": "equipment",
  "category": "boots",
  "tier": 5,
  "value": 180,
  "stackable": false,
  "slot": "boots",
  "quality": "精良",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipemerald_Weapon",
  "name": "祖母绿刀",
  "type": "equipment",
  "category": "weapon",
  "tier": 6,
  "value": 210,
  "stackable": false,
  "slot": "weapon",
  "quality": "稀有",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipemerald_Pot",
  "name": "祖母绿锅",
  "type": "equipment",
  "category": "offhand",
  "tier": 6,
  "value": 210,
  "stackable": false,
  "slot": "offhand",
  "quality": "稀有",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipemerald_Board",
  "name": "祖母绿砧板",
  "type": "equipment",
  "category": "offhand",
  "tier": 6,
  "value": 210,
  "stackable": false,
  "slot": "offhand",
  "quality": "稀有",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipemerald_Body",
  "name": "祖母绿围裙",
  "type": "equipment",
  "category": "body",
  "tier": 6,
  "value": 210,
  "stackable": false,
  "slot": "body",
  "quality": "稀有",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipemerald_Helmet",
  "name": "祖母绿厨师帽",
  "type": "equipment",
  "category": "helmet",
  "tier": 6,
  "value": 210,
  "stackable": false,
  "slot": "helmet",
  "quality": "稀有",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipemerald_Amulet",
  "name": "祖母绿护符",
  "type": "equipment",
  "category": "amulet",
  "tier": 6,
  "value": 210,
  "stackable": false,
  "slot": "amulet",
  "quality": "稀有",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipemerald_Legs",
  "name": "祖母绿腿甲",
  "type": "equipment",
  "category": "legs",
  "tier": 6,
  "value": 210,
  "stackable": false,
  "slot": "legs",
  "quality": "稀有",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipemerald_Boots",
  "name": "祖母绿靴子",
  "type": "equipment",
  "category": "boots",
  "tier": 6,
  "value": 210,
  "stackable": false,
  "slot": "boots",
  "quality": "稀有",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipdiamond_Weapon",
  "name": "钻石刀",
  "type": "equipment",
  "category": "weapon",
  "tier": 6,
  "value": 210,
  "stackable": false,
  "slot": "weapon",
  "quality": "稀有",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipdiamond_Pot",
  "name": "钻石锅",
  "type": "equipment",
  "category": "offhand",
  "tier": 6,
  "value": 210,
  "stackable": false,
  "slot": "offhand",
  "quality": "稀有",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipdiamond_Board",
  "name": "钻石砧板",
  "type": "equipment",
  "category": "offhand",
  "tier": 6,
  "value": 210,
  "stackable": false,
  "slot": "offhand",
  "quality": "稀有",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipdiamond_Body",
  "name": "钻石围裙",
  "type": "equipment",
  "category": "body",
  "tier": 6,
  "value": 210,
  "stackable": false,
  "slot": "body",
  "quality": "稀有",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipdiamond_Helmet",
  "name": "钻石厨师帽",
  "type": "equipment",
  "category": "helmet",
  "tier": 6,
  "value": 210,
  "stackable": false,
  "slot": "helmet",
  "quality": "稀有",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipdiamond_Amulet",
  "name": "钻石护符",
  "type": "equipment",
  "category": "amulet",
  "tier": 6,
  "value": 210,
  "stackable": false,
  "slot": "amulet",
  "quality": "稀有",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipdiamond_Legs",
  "name": "钻石腿甲",
  "type": "equipment",
  "category": "legs",
  "tier": 6,
  "value": 210,
  "stackable": false,
  "slot": "legs",
  "quality": "稀有",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipdiamond_Boots",
  "name": "钻石靴子",
  "type": "equipment",
  "category": "boots",
  "tier": 6,
  "value": 210,
  "stackable": false,
  "slot": "boots",
  "quality": "稀有",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "iniptin_Weapon",
  "name": "锡刀",
  "type": "equipment",
  "category": "weapon",
  "tier": 7,
  "value": 240,
  "stackable": false,
  "slot": "weapon",
  "quality": "普通",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "iniptin_Pot",
  "name": "锡锅",
  "type": "equipment",
  "category": "offhand",
  "tier": 7,
  "value": 240,
  "stackable": false,
  "slot": "offhand",
  "quality": "普通",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "iniptin_Board",
  "name": "锡砧板",
  "type": "equipment",
  "category": "offhand",
  "tier": 7,
  "value": 240,
  "stackable": false,
  "slot": "offhand",
  "quality": "普通",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "iniptin_Body",
  "name": "锡围裙",
  "type": "equipment",
  "category": "body",
  "tier": 7,
  "value": 240,
  "stackable": false,
  "slot": "body",
  "quality": "普通",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "iniptin_Helmet",
  "name": "锡厨师帽",
  "type": "equipment",
  "category": "helmet",
  "tier": 7,
  "value": 240,
  "stackable": false,
  "slot": "helmet",
  "quality": "普通",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "iniptin_Legs",
  "name": "锡腿甲",
  "type": "equipment",
  "category": "legs",
  "tier": 7,
  "value": 240,
  "stackable": false,
  "slot": "legs",
  "quality": "普通",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "iniptin_Boots",
  "name": "锡靴子",
  "type": "equipment",
  "category": "boots",
  "tier": 7,
  "value": 240,
  "stackable": false,
  "slot": "boots",
  "quality": "普通",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "iniptin_Ring",
  "name": "锡戒指",
  "type": "equipment",
  "category": "ring",
  "tier": 7,
  "value": 240,
  "stackable": false,
  "slot": "ring",
  "quality": "普通",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "iniplead_Weapon",
  "name": "铅刀",
  "type": "equipment",
  "category": "weapon",
  "tier": 7,
  "value": 240,
  "stackable": false,
  "slot": "weapon",
  "quality": "普通",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "iniplead_Pot",
  "name": "铅锅",
  "type": "equipment",
  "category": "offhand",
  "tier": 7,
  "value": 240,
  "stackable": false,
  "slot": "offhand",
  "quality": "普通",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "iniplead_Board",
  "name": "铅砧板",
  "type": "equipment",
  "category": "offhand",
  "tier": 7,
  "value": 240,
  "stackable": false,
  "slot": "offhand",
  "quality": "普通",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "iniplead_Body",
  "name": "铅围裙",
  "type": "equipment",
  "category": "body",
  "tier": 7,
  "value": 240,
  "stackable": false,
  "slot": "body",
  "quality": "普通",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "iniplead_Helmet",
  "name": "铅厨师帽",
  "type": "equipment",
  "category": "helmet",
  "tier": 7,
  "value": 240,
  "stackable": false,
  "slot": "helmet",
  "quality": "普通",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "iniplead_Legs",
  "name": "铅腿甲",
  "type": "equipment",
  "category": "legs",
  "tier": 7,
  "value": 240,
  "stackable": false,
  "slot": "legs",
  "quality": "普通",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "iniplead_Boots",
  "name": "铅靴子",
  "type": "equipment",
  "category": "boots",
  "tier": 7,
  "value": 240,
  "stackable": false,
  "slot": "boots",
  "quality": "普通",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "iniplead_Ring",
  "name": "铅戒指",
  "type": "equipment",
  "category": "ring",
  "tier": 7,
  "value": 240,
  "stackable": false,
  "slot": "ring",
  "quality": "普通",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipzinc_Weapon",
  "name": "锌刀",
  "type": "equipment",
  "category": "weapon",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "weapon",
  "quality": "精良",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipzinc_Pot",
  "name": "锌锅",
  "type": "equipment",
  "category": "offhand",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "offhand",
  "quality": "精良",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipzinc_Board",
  "name": "锌砧板",
  "type": "equipment",
  "category": "offhand",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "offhand",
  "quality": "精良",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipzinc_Body",
  "name": "锌围裙",
  "type": "equipment",
  "category": "body",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "body",
  "quality": "精良",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipzinc_Helmet",
  "name": "锌厨师帽",
  "type": "equipment",
  "category": "helmet",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "helmet",
  "quality": "精良",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipzinc_Legs",
  "name": "锌腿甲",
  "type": "equipment",
  "category": "legs",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "legs",
  "quality": "精良",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipzinc_Boots",
  "name": "锌靴子",
  "type": "equipment",
  "category": "boots",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "boots",
  "quality": "精良",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipzinc_Ring",
  "name": "锌戒指",
  "type": "equipment",
  "category": "ring",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "ring",
  "quality": "精良",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipnickel_Weapon",
  "name": "镍刀",
  "type": "equipment",
  "category": "weapon",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "weapon",
  "quality": "精良",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipnickel_Pot",
  "name": "镍锅",
  "type": "equipment",
  "category": "offhand",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "offhand",
  "quality": "精良",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipnickel_Board",
  "name": "镍砧板",
  "type": "equipment",
  "category": "offhand",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "offhand",
  "quality": "精良",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipnickel_Body",
  "name": "镍围裙",
  "type": "equipment",
  "category": "body",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "body",
  "quality": "精良",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipnickel_Helmet",
  "name": "镍厨师帽",
  "type": "equipment",
  "category": "helmet",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "helmet",
  "quality": "精良",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipnickel_Legs",
  "name": "镍腿甲",
  "type": "equipment",
  "category": "legs",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "legs",
  "quality": "精良",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipnickel_Boots",
  "name": "镍靴子",
  "type": "equipment",
  "category": "boots",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "boots",
  "quality": "精良",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipnickel_Ring",
  "name": "镍戒指",
  "type": "equipment",
  "category": "ring",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "ring",
  "quality": "精良",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipcobalt_Weapon",
  "name": "钴刀",
  "type": "equipment",
  "category": "weapon",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "weapon",
  "quality": "稀有",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipcobalt_Pot",
  "name": "钴锅",
  "type": "equipment",
  "category": "offhand",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "offhand",
  "quality": "稀有",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipcobalt_Board",
  "name": "钴砧板",
  "type": "equipment",
  "category": "offhand",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "offhand",
  "quality": "稀有",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipcobalt_Body",
  "name": "钴围裙",
  "type": "equipment",
  "category": "body",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "body",
  "quality": "稀有",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipcobalt_Helmet",
  "name": "钴厨师帽",
  "type": "equipment",
  "category": "helmet",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "helmet",
  "quality": "稀有",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipcobalt_Legs",
  "name": "钴腿甲",
  "type": "equipment",
  "category": "legs",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "legs",
  "quality": "稀有",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipcobalt_Boots",
  "name": "钴靴子",
  "type": "equipment",
  "category": "boots",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "boots",
  "quality": "稀有",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipcobalt_Ring",
  "name": "钴戒指",
  "type": "equipment",
  "category": "ring",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "ring",
  "quality": "稀有",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "iniptitanium_Weapon",
  "name": "钛刀",
  "type": "equipment",
  "category": "weapon",
  "tier": 9,
  "value": 300,
  "stackable": false,
  "slot": "weapon",
  "quality": "稀有",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "iniptitanium_Pot",
  "name": "钛锅",
  "type": "equipment",
  "category": "offhand",
  "tier": 9,
  "value": 300,
  "stackable": false,
  "slot": "offhand",
  "quality": "稀有",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "iniptitanium_Board",
  "name": "钛砧板",
  "type": "equipment",
  "category": "offhand",
  "tier": 9,
  "value": 300,
  "stackable": false,
  "slot": "offhand",
  "quality": "稀有",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "iniptitanium_Body",
  "name": "钛围裙",
  "type": "equipment",
  "category": "body",
  "tier": 9,
  "value": 300,
  "stackable": false,
  "slot": "body",
  "quality": "稀有",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "iniptitanium_Helmet",
  "name": "钛厨师帽",
  "type": "equipment",
  "category": "helmet",
  "tier": 9,
  "value": 300,
  "stackable": false,
  "slot": "helmet",
  "quality": "稀有",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "iniptitanium_Legs",
  "name": "钛腿甲",
  "type": "equipment",
  "category": "legs",
  "tier": 9,
  "value": 300,
  "stackable": false,
  "slot": "legs",
  "quality": "稀有",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "iniptitanium_Boots",
  "name": "钛靴子",
  "type": "equipment",
  "category": "boots",
  "tier": 9,
  "value": 300,
  "stackable": false,
  "slot": "boots",
  "quality": "稀有",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "iniptitanium_Ring",
  "name": "钛戒指",
  "type": "equipment",
  "category": "ring",
  "tier": 9,
  "value": 300,
  "stackable": false,
  "slot": "ring",
  "quality": "稀有",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipgraphite_Weapon",
  "name": "石墨刀",
  "type": "equipment",
  "category": "weapon",
  "tier": 10,
  "value": 330,
  "stackable": false,
  "slot": "weapon",
  "quality": "传说",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipgraphite_Pot",
  "name": "石墨锅",
  "type": "equipment",
  "category": "offhand",
  "tier": 10,
  "value": 330,
  "stackable": false,
  "slot": "offhand",
  "quality": "传说",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipgraphite_Board",
  "name": "石墨砧板",
  "type": "equipment",
  "category": "offhand",
  "tier": 10,
  "value": 330,
  "stackable": false,
  "slot": "offhand",
  "quality": "传说",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipgraphite_Body",
  "name": "石墨围裙",
  "type": "equipment",
  "category": "body",
  "tier": 10,
  "value": 330,
  "stackable": false,
  "slot": "body",
  "quality": "传说",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipgraphite_Helmet",
  "name": "石墨厨师帽",
  "type": "equipment",
  "category": "helmet",
  "tier": 10,
  "value": 330,
  "stackable": false,
  "slot": "helmet",
  "quality": "传说",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipgraphite_Legs",
  "name": "石墨腿甲",
  "type": "equipment",
  "category": "legs",
  "tier": 10,
  "value": 330,
  "stackable": false,
  "slot": "legs",
  "quality": "传说",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipgraphite_Boots",
  "name": "石墨靴子",
  "type": "equipment",
  "category": "boots",
  "tier": 10,
  "value": 330,
  "stackable": false,
  "slot": "boots",
  "quality": "传说",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipgraphite_Ring",
  "name": "石墨戒指",
  "type": "equipment",
  "category": "ring",
  "tier": 10,
  "value": 330,
  "stackable": false,
  "slot": "ring",
  "quality": "传说",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipgypsum_Weapon",
  "name": "石膏刀",
  "type": "equipment",
  "category": "weapon",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "weapon",
  "quality": "普通",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipgypsum_Pot",
  "name": "石膏锅",
  "type": "equipment",
  "category": "offhand",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "offhand",
  "quality": "普通",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipgypsum_Board",
  "name": "石膏砧板",
  "type": "equipment",
  "category": "offhand",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "offhand",
  "quality": "普通",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipgypsum_Body",
  "name": "石膏围裙",
  "type": "equipment",
  "category": "body",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "body",
  "quality": "普通",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipgypsum_Helmet",
  "name": "石膏厨师帽",
  "type": "equipment",
  "category": "helmet",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "helmet",
  "quality": "普通",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipgypsum_Legs",
  "name": "石膏腿甲",
  "type": "equipment",
  "category": "legs",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "legs",
  "quality": "普通",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipgypsum_Boots",
  "name": "石膏靴子",
  "type": "equipment",
  "category": "boots",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "boots",
  "quality": "普通",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipgypsum_Ring",
  "name": "石膏戒指",
  "type": "equipment",
  "category": "ring",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "ring",
  "quality": "普通",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipsaltpeter_Weapon",
  "name": "硝石刀",
  "type": "equipment",
  "category": "weapon",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "weapon",
  "quality": "精良",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipsaltpeter_Pot",
  "name": "硝石锅",
  "type": "equipment",
  "category": "offhand",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "offhand",
  "quality": "精良",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipsaltpeter_Board",
  "name": "硝石砧板",
  "type": "equipment",
  "category": "offhand",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "offhand",
  "quality": "精良",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipsaltpeter_Body",
  "name": "硝石围裙",
  "type": "equipment",
  "category": "body",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "body",
  "quality": "精良",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipsaltpeter_Helmet",
  "name": "硝石厨师帽",
  "type": "equipment",
  "category": "helmet",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "helmet",
  "quality": "精良",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipsaltpeter_Legs",
  "name": "硝石腿甲",
  "type": "equipment",
  "category": "legs",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "legs",
  "quality": "精良",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipsaltpeter_Boots",
  "name": "硝石靴子",
  "type": "equipment",
  "category": "boots",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "boots",
  "quality": "精良",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipsaltpeter_Ring",
  "name": "硝石戒指",
  "type": "equipment",
  "category": "ring",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "ring",
  "quality": "精良",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipsulfur_Weapon",
  "name": "硫磺刀",
  "type": "equipment",
  "category": "weapon",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "weapon",
  "quality": "精良",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipsulfur_Pot",
  "name": "硫磺锅",
  "type": "equipment",
  "category": "offhand",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "offhand",
  "quality": "精良",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipsulfur_Board",
  "name": "硫磺砧板",
  "type": "equipment",
  "category": "offhand",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "offhand",
  "quality": "精良",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipsulfur_Body",
  "name": "硫磺围裙",
  "type": "equipment",
  "category": "body",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "body",
  "quality": "精良",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipsulfur_Helmet",
  "name": "硫磺厨师帽",
  "type": "equipment",
  "category": "helmet",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "helmet",
  "quality": "精良",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipsulfur_Legs",
  "name": "硫磺腿甲",
  "type": "equipment",
  "category": "legs",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "legs",
  "quality": "精良",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipsulfur_Boots",
  "name": "硫磺靴子",
  "type": "equipment",
  "category": "boots",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "boots",
  "quality": "精良",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipsulfur_Ring",
  "name": "硫磺戒指",
  "type": "equipment",
  "category": "ring",
  "tier": 8,
  "value": 270,
  "stackable": false,
  "slot": "ring",
  "quality": "精良",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipalum_Weapon",
  "name": "明矾刀",
  "type": "equipment",
  "category": "weapon",
  "tier": 9,
  "value": 300,
  "stackable": false,
  "slot": "weapon",
  "quality": "稀有",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipalum_Pot",
  "name": "明矾锅",
  "type": "equipment",
  "category": "offhand",
  "tier": 9,
  "value": 300,
  "stackable": false,
  "slot": "offhand",
  "quality": "稀有",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipalum_Board",
  "name": "明矾砧板",
  "type": "equipment",
  "category": "offhand",
  "tier": 9,
  "value": 300,
  "stackable": false,
  "slot": "offhand",
  "quality": "稀有",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipalum_Body",
  "name": "明矾围裙",
  "type": "equipment",
  "category": "body",
  "tier": 9,
  "value": 300,
  "stackable": false,
  "slot": "body",
  "quality": "稀有",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipalum_Helmet",
  "name": "明矾厨师帽",
  "type": "equipment",
  "category": "helmet",
  "tier": 9,
  "value": 300,
  "stackable": false,
  "slot": "helmet",
  "quality": "稀有",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipalum_Legs",
  "name": "明矾腿甲",
  "type": "equipment",
  "category": "legs",
  "tier": 9,
  "value": 300,
  "stackable": false,
  "slot": "legs",
  "quality": "稀有",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipalum_Boots",
  "name": "明矾靴子",
  "type": "equipment",
  "category": "boots",
  "tier": 9,
  "value": 300,
  "stackable": false,
  "slot": "boots",
  "quality": "稀有",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipalum_Ring",
  "name": "明矾戒指",
  "type": "equipment",
  "category": "ring",
  "tier": 9,
  "value": 300,
  "stackable": false,
  "slot": "ring",
  "quality": "稀有",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipmica_Weapon",
  "name": "云母刀",
  "type": "equipment",
  "category": "weapon",
  "tier": 9,
  "value": 300,
  "stackable": false,
  "slot": "weapon",
  "quality": "稀有",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipmica_Pot",
  "name": "云母锅",
  "type": "equipment",
  "category": "offhand",
  "tier": 9,
  "value": 300,
  "stackable": false,
  "slot": "offhand",
  "quality": "稀有",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipmica_Board",
  "name": "云母砧板",
  "type": "equipment",
  "category": "offhand",
  "tier": 9,
  "value": 300,
  "stackable": false,
  "slot": "offhand",
  "quality": "稀有",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipmica_Body",
  "name": "云母围裙",
  "type": "equipment",
  "category": "body",
  "tier": 9,
  "value": 300,
  "stackable": false,
  "slot": "body",
  "quality": "稀有",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipmica_Helmet",
  "name": "云母厨师帽",
  "type": "equipment",
  "category": "helmet",
  "tier": 9,
  "value": 300,
  "stackable": false,
  "slot": "helmet",
  "quality": "稀有",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipmica_Legs",
  "name": "云母腿甲",
  "type": "equipment",
  "category": "legs",
  "tier": 9,
  "value": 300,
  "stackable": false,
  "slot": "legs",
  "quality": "稀有",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipmica_Boots",
  "name": "云母靴子",
  "type": "equipment",
  "category": "boots",
  "tier": 9,
  "value": 300,
  "stackable": false,
  "slot": "boots",
  "quality": "稀有",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipmica_Ring",
  "name": "云母戒指",
  "type": "equipment",
  "category": "ring",
  "tier": 9,
  "value": 300,
  "stackable": false,
  "slot": "ring",
  "quality": "稀有",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipquartz_Weapon",
  "name": "石英刀",
  "type": "equipment",
  "category": "weapon",
  "tier": 9,
  "value": 300,
  "stackable": false,
  "slot": "weapon",
  "quality": "稀有",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipquartz_Pot",
  "name": "石英锅",
  "type": "equipment",
  "category": "offhand",
  "tier": 9,
  "value": 300,
  "stackable": false,
  "slot": "offhand",
  "quality": "稀有",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipquartz_Board",
  "name": "石英砧板",
  "type": "equipment",
  "category": "offhand",
  "tier": 9,
  "value": 300,
  "stackable": false,
  "slot": "offhand",
  "quality": "稀有",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipquartz_Body",
  "name": "石英围裙",
  "type": "equipment",
  "category": "body",
  "tier": 9,
  "value": 300,
  "stackable": false,
  "slot": "body",
  "quality": "稀有",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipquartz_Helmet",
  "name": "石英厨师帽",
  "type": "equipment",
  "category": "helmet",
  "tier": 9,
  "value": 300,
  "stackable": false,
  "slot": "helmet",
  "quality": "稀有",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipquartz_Legs",
  "name": "石英腿甲",
  "type": "equipment",
  "category": "legs",
  "tier": 9,
  "value": 300,
  "stackable": false,
  "slot": "legs",
  "quality": "稀有",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipquartz_Boots",
  "name": "石英靴子",
  "type": "equipment",
  "category": "boots",
  "tier": 9,
  "value": 300,
  "stackable": false,
  "slot": "boots",
  "quality": "稀有",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipquartz_Ring",
  "name": "石英戒指",
  "type": "equipment",
  "category": "ring",
  "tier": 9,
  "value": 300,
  "stackable": false,
  "slot": "ring",
  "quality": "稀有",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipjade_Weapon",
  "name": "翡翠刀",
  "type": "equipment",
  "category": "weapon",
  "tier": 10,
  "value": 330,
  "stackable": false,
  "slot": "weapon",
  "quality": "传说",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipjade_Pot",
  "name": "翡翠锅",
  "type": "equipment",
  "category": "offhand",
  "tier": 10,
  "value": 330,
  "stackable": false,
  "slot": "offhand",
  "quality": "传说",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipjade_Board",
  "name": "翡翠砧板",
  "type": "equipment",
  "category": "offhand",
  "tier": 10,
  "value": 330,
  "stackable": false,
  "slot": "offhand",
  "quality": "传说",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipjade_Body",
  "name": "翡翠围裙",
  "type": "equipment",
  "category": "body",
  "tier": 10,
  "value": 330,
  "stackable": false,
  "slot": "body",
  "quality": "传说",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipjade_Helmet",
  "name": "翡翠厨师帽",
  "type": "equipment",
  "category": "helmet",
  "tier": 10,
  "value": 330,
  "stackable": false,
  "slot": "helmet",
  "quality": "传说",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipjade_Amulet",
  "name": "翡翠护符",
  "type": "equipment",
  "category": "amulet",
  "tier": 10,
  "value": 330,
  "stackable": false,
  "slot": "amulet",
  "quality": "传说",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipjade_Legs",
  "name": "翡翠腿甲",
  "type": "equipment",
  "category": "legs",
  "tier": 10,
  "value": 330,
  "stackable": false,
  "slot": "legs",
  "quality": "传说",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipjade_Boots",
  "name": "翡翠靴子",
  "type": "equipment",
  "category": "boots",
  "tier": 10,
  "value": 330,
  "stackable": false,
  "slot": "boots",
  "quality": "传说",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipagate_Weapon",
  "name": "玛瑙刀",
  "type": "equipment",
  "category": "weapon",
  "tier": 10,
  "value": 330,
  "stackable": false,
  "slot": "weapon",
  "quality": "传说",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipagate_Pot",
  "name": "玛瑙锅",
  "type": "equipment",
  "category": "offhand",
  "tier": 10,
  "value": 330,
  "stackable": false,
  "slot": "offhand",
  "quality": "传说",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipagate_Board",
  "name": "玛瑙砧板",
  "type": "equipment",
  "category": "offhand",
  "tier": 10,
  "value": 330,
  "stackable": false,
  "slot": "offhand",
  "quality": "传说",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipagate_Body",
  "name": "玛瑙围裙",
  "type": "equipment",
  "category": "body",
  "tier": 10,
  "value": 330,
  "stackable": false,
  "slot": "body",
  "quality": "传说",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipagate_Helmet",
  "name": "玛瑙厨师帽",
  "type": "equipment",
  "category": "helmet",
  "tier": 10,
  "value": 330,
  "stackable": false,
  "slot": "helmet",
  "quality": "传说",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipagate_Amulet",
  "name": "玛瑙护符",
  "type": "equipment",
  "category": "amulet",
  "tier": 10,
  "value": 330,
  "stackable": false,
  "slot": "amulet",
  "quality": "传说",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipagate_Legs",
  "name": "玛瑙腿甲",
  "type": "equipment",
  "category": "legs",
  "tier": 10,
  "value": 330,
  "stackable": false,
  "slot": "legs",
  "quality": "传说",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipagate_Boots",
  "name": "玛瑙靴子",
  "type": "equipment",
  "category": "boots",
  "tier": 10,
  "value": 330,
  "stackable": false,
  "slot": "boots",
  "quality": "传说",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipsapphire_Weapon",
  "name": "蓝晶刀",
  "type": "equipment",
  "category": "weapon",
  "tier": 10,
  "value": 330,
  "stackable": false,
  "slot": "weapon",
  "quality": "传说",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipsapphire_Pot",
  "name": "蓝晶锅",
  "type": "equipment",
  "category": "offhand",
  "tier": 10,
  "value": 330,
  "stackable": false,
  "slot": "offhand",
  "quality": "传说",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipsapphire_Board",
  "name": "蓝晶砧板",
  "type": "equipment",
  "category": "offhand",
  "tier": 10,
  "value": 330,
  "stackable": false,
  "slot": "offhand",
  "quality": "传说",
  "stats": {
   "attack": 1
  }
 },
 {
  "id": "inipsapphire_Body",
  "name": "蓝晶围裙",
  "type": "equipment",
  "category": "body",
  "tier": 10,
  "value": 330,
  "stackable": false,
  "slot": "body",
  "quality": "传说",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipsapphire_Helmet",
  "name": "蓝晶厨师帽",
  "type": "equipment",
  "category": "helmet",
  "tier": 10,
  "value": 330,
  "stackable": false,
  "slot": "helmet",
  "quality": "传说",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipsapphire_Amulet",
  "name": "蓝晶护符",
  "type": "equipment",
  "category": "amulet",
  "tier": 10,
  "value": 330,
  "stackable": false,
  "slot": "amulet",
  "quality": "传说",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipsapphire_Legs",
  "name": "蓝晶腿甲",
  "type": "equipment",
  "category": "legs",
  "tier": 10,
  "value": 330,
  "stackable": false,
  "slot": "legs",
  "quality": "传说",
  "stats": {
   "defense": 1
  }
 },
 {
  "id": "inipsapphire_Boots",
  "name": "蓝晶靴子",
  "type": "equipment",
  "category": "boots",
  "tier": 10,
  "value": 330,
  "stackable": false,
  "slot": "boots",
  "quality": "传说",
  "stats": {
   "defense": 1
  }
 }
]
