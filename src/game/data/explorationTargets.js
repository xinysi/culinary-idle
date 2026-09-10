// 美食探索目标扩充（生成器产出，勿手改）— 2026-09-01
// 由 scripts/gen/gen_exploration_targets.mjs 生成：200 个探索目标，等级 1~99，
// intervalSec/xp 递增、baseSuccess 递减、failGold 递增，战利品按等级带匹配全物品库。
// 🔒 本文件属「已固定」冻结数据（AGENTS.md 数据铁律）：勿重跑生成器——它会改写目标名称与战利品。
export const EXPLORATION_TARGETS_ALL = [
 {
  "id": "explore_001",
  "name": "家常小馆",
  "reqLevel": 1,
  "intervalSec": 3,
  "xp": 10,
  "baseSuccess": 0.85,
  "failGold": 5,
  "loot": [
   {
    "type": "gold",
    "min": 2,
    "max": 6,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "chili_young",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "wildDish_552",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "wildDish_551",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_002",
  "name": "根茎铺",
  "reqLevel": 1,
  "intervalSec": 3,
  "xp": 10,
  "baseSuccess": 0.85,
  "failGold": 5,
  "loot": [
   {
    "type": "gold",
    "min": 2,
    "max": 6,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "potato",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "brewFix_1",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_003",
  "name": "果摊",
  "reqLevel": 2,
  "intervalSec": 3.1,
  "xp": 15,
  "baseSuccess": 0.85,
  "failGold": 6,
  "loot": [
   {
    "type": "gold",
    "min": 2,
    "max": 7,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "foraging_ext_02",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "appleJuice",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "cooking_ext2_02",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_004",
  "name": "肉铺",
  "reqLevel": 2,
  "intervalSec": 3.1,
  "xp": 15,
  "baseSuccess": 0.85,
  "failGold": 6,
  "loot": [
   {
    "type": "gold",
    "min": 2,
    "max": 7,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "hunting_ext2_02",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "boiledCabbage",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_005",
  "name": "早市菜摊",
  "reqLevel": 3,
  "intervalSec": 3.1,
  "xp": 20,
  "baseSuccess": 0.84,
  "failGold": 8,
  "loot": [
   {
    "type": "gold",
    "min": 3,
    "max": 10,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "peppercorn_young",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "yieldTonic1",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "cooking_ext_03",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_006",
  "name": "菜摊",
  "reqLevel": 3,
  "intervalSec": 3.1,
  "xp": 20,
  "baseSuccess": 0.84,
  "failGold": 8,
  "loot": [
   {
    "type": "gold",
    "min": 3,
    "max": 10,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "ginger_young",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "wildDish_29",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_007",
  "name": "蔬菜棚",
  "reqLevel": 4,
  "intervalSec": 3.2,
  "xp": 24,
  "baseSuccess": 0.84,
  "failGold": 9,
  "loot": [
   {
    "type": "gold",
    "min": 4,
    "max": 11,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "winterMelon_young",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cornOnCob",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "brewing_ext2_02",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_008",
  "name": "豆芽坊",
  "reqLevel": 4,
  "intervalSec": 3.2,
  "xp": 24,
  "baseSuccess": 0.84,
  "failGold": 9,
  "loot": [
   {
    "type": "gold",
    "min": 4,
    "max": 11,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "foraging_ext_15_young",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "steamedSweetPotato",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_009",
  "name": "野菜摊",
  "reqLevel": 5,
  "intervalSec": 3.2,
  "xp": 29,
  "baseSuccess": 0.84,
  "failGold": 11,
  "loot": [
   {
    "type": "gold",
    "min": 4,
    "max": 13,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "excavation_ext2_01",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "baking_ext2_01",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "steamedSweetPotato",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_010",
  "name": "时蔬摊",
  "reqLevel": 5,
  "intervalSec": 3.2,
  "xp": 29,
  "baseSuccess": 0.84,
  "failGold": 11,
  "loot": [
   {
    "type": "gold",
    "min": 4,
    "max": 13,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "basil_young",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "brewing_ext2_02",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_011",
  "name": "糖葫芦摊",
  "reqLevel": 6,
  "intervalSec": 3.3,
  "xp": 34,
  "baseSuccess": 0.84,
  "failGold": 12,
  "loot": [
   {
    "type": "gold",
    "min": 5,
    "max": 14,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "preserving_ext_01",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "yieldTonic1",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "fruitPlatter",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_012",
  "name": "山货摊",
  "reqLevel": 6,
  "intervalSec": 3.3,
  "xp": 34,
  "baseSuccess": 0.84,
  "failGold": 12,
  "loot": [
   {
    "type": "gold",
    "min": 5,
    "max": 14,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "excavation_ext_03",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "wildDish_555",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_013",
  "name": "茶摊",
  "reqLevel": 7,
  "intervalSec": 3.3,
  "xp": 39,
  "baseSuccess": 0.83,
  "failGold": 13,
  "loot": [
   {
    "type": "gold",
    "min": 5,
    "max": 16,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "salt",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "brewing_ext_03",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "brewing_ext_01",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_014",
  "name": "糖水铺",
  "reqLevel": 7,
  "intervalSec": 3.3,
  "xp": 39,
  "baseSuccess": 0.83,
  "failGold": 13,
  "loot": [
   {
    "type": "gold",
    "min": 5,
    "max": 16,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "preserving_ext2_02",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "brewing_ext2_81",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_015",
  "name": "夜宵档",
  "reqLevel": 8,
  "intervalSec": 3.4,
  "xp": 44,
  "baseSuccess": 0.83,
  "failGold": 15,
  "loot": [
   {
    "type": "gold",
    "min": 6,
    "max": 18,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "hunting_ext_03",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cooking_ext_04",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "wildDish_30",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_016",
  "name": "薯芋摊",
  "reqLevel": 8,
  "intervalSec": 3.4,
  "xp": 44,
  "baseSuccess": 0.83,
  "failGold": 15,
  "loot": [
   {
    "type": "gold",
    "min": 6,
    "max": 18,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "excavation_ext_02",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "sweetBread",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_017",
  "name": "田园蔬宴",
  "reqLevel": 9,
  "intervalSec": 3.4,
  "xp": 48,
  "baseSuccess": 0.83,
  "failGold": 16,
  "loot": [
   {
    "type": "gold",
    "min": 6,
    "max": 19,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "strawberry_young",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "greenRadishSalad",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "baking_ext_02",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_018",
  "name": "小炒摊",
  "reqLevel": 9,
  "intervalSec": 3.4,
  "xp": 48,
  "baseSuccess": 0.83,
  "failGold": 16,
  "loot": [
   {
    "type": "gold",
    "min": 6,
    "max": 19,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "preserving_ext_02",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cooking_ext_04",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_019",
  "name": "调料铺",
  "reqLevel": 10,
  "intervalSec": 3.5,
  "xp": 53,
  "baseSuccess": 0.83,
  "failGold": 17,
  "loot": [
   {
    "type": "gold",
    "min": 7,
    "max": 20,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "spiceFix_1",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cooking_ext2_02",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "preservTier1",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_020",
  "name": "水产档",
  "reqLevel": 10,
  "intervalSec": 3.5,
  "xp": 53,
  "baseSuccess": 0.83,
  "failGold": 17,
  "loot": [
   {
    "type": "gold",
    "min": 7,
    "max": 20,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "perch",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "wildDish_551",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_021",
  "name": "豆浆摊",
  "reqLevel": 11,
  "intervalSec": 3.5,
  "xp": 58,
  "baseSuccess": 0.82,
  "failGold": 19,
  "loot": [
   {
    "type": "gold",
    "min": 8,
    "max": 23,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "fishing_ext2_04",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "brewing_ext2_05",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "brewing_ext2_81",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_022",
  "name": "鱼摊",
  "reqLevel": 11,
  "intervalSec": 3.5,
  "xp": 58,
  "baseSuccess": 0.82,
  "failGold": 19,
  "loot": [
   {
    "type": "gold",
    "min": 8,
    "max": 23,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "fishing_ext2_04",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "wildDish_553",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_023",
  "name": "小饭馆",
  "reqLevel": 12,
  "intervalSec": 3.6,
  "xp": 63,
  "baseSuccess": 0.82,
  "failGold": 20,
  "loot": [
   {
    "type": "gold",
    "min": 8,
    "max": 24,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "preserving_ext_03",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "wildDish_551",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "cornTortilla",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_024",
  "name": "山珍御膳",
  "reqLevel": 12,
  "intervalSec": 3.6,
  "xp": 63,
  "baseSuccess": 0.82,
  "failGold": 20,
  "loot": [
   {
    "type": "gold",
    "min": 8,
    "max": 24,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "excavation_ext2_05",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "steamedSweetPotato",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_025",
  "name": "大排档",
  "reqLevel": 13,
  "intervalSec": 3.6,
  "xp": 68,
  "baseSuccess": 0.82,
  "failGold": 22,
  "loot": [
   {
    "type": "gold",
    "min": 9,
    "max": 26,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "hunting_ext_04",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "wildDish_553",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "waterChestnutStir",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_026",
  "name": "国宴厨房",
  "reqLevel": 13,
  "intervalSec": 3.6,
  "xp": 68,
  "baseSuccess": 0.82,
  "failGold": 22,
  "loot": [
   {
    "type": "gold",
    "min": 9,
    "max": 26,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "doubanjiang",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "sweetSourCabbage",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_027",
  "name": "香草摊",
  "reqLevel": 14,
  "intervalSec": 3.7,
  "xp": 72,
  "baseSuccess": 0.82,
  "failGold": 23,
  "loot": [
   {
    "type": "gold",
    "min": 9,
    "max": 28,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "chrysanthemum",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "baking_ext2_04",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "herbalTea",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_028",
  "name": "肉摊",
  "reqLevel": 14,
  "intervalSec": 3.7,
  "xp": 72,
  "baseSuccess": 0.82,
  "failGold": 23,
  "loot": [
   {
    "type": "gold",
    "min": 9,
    "max": 28,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "boarMeat",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "wildDish_30",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_029",
  "name": "粤菜馆",
  "reqLevel": 15,
  "intervalSec": 3.7,
  "xp": 77,
  "baseSuccess": 0.81,
  "failGold": 24,
  "loot": [
   {
    "type": "gold",
    "min": 10,
    "max": 29,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "eggplant_young",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cooking_ext2_01",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "wildDish_32",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_030",
  "name": "滋补坊",
  "reqLevel": 15,
  "intervalSec": 3.7,
  "xp": 77,
  "baseSuccess": 0.81,
  "failGold": 24,
  "loot": [
   {
    "type": "gold",
    "min": 10,
    "max": 29,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "excavation_ext_04",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cooking_ext2_01",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_031",
  "name": "湘菜馆",
  "reqLevel": 16,
  "intervalSec": 3.8,
  "xp": 82,
  "baseSuccess": 0.81,
  "failGold": 26,
  "loot": [
   {
    "type": "gold",
    "min": 10,
    "max": 31,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "hunting_ext_04",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cooking_ext_04",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "cooking_ext2_06",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_032",
  "name": "小渔村",
  "reqLevel": 16,
  "intervalSec": 3.8,
  "xp": 82,
  "baseSuccess": 0.81,
  "failGold": 26,
  "loot": [
   {
    "type": "gold",
    "min": 10,
    "max": 31,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "fishing_ext2_04",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "arrowheadSoup",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_033",
  "name": "鲜味档",
  "reqLevel": 17,
  "intervalSec": 3.8,
  "xp": 87,
  "baseSuccess": 0.81,
  "failGold": 27,
  "loot": [
   {
    "type": "gold",
    "min": 11,
    "max": 32,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "fishing_ext_05",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "codSteak",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "brewing_ext_04",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_034",
  "name": "御膳房",
  "reqLevel": 17,
  "intervalSec": 3.8,
  "xp": 87,
  "baseSuccess": 0.81,
  "failGold": 27,
  "loot": [
   {
    "type": "gold",
    "min": 11,
    "max": 32,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "doubanjiang",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "ironPlateRabbit",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_035",
  "name": "鲜果摊",
  "reqLevel": 18,
  "intervalSec": 3.9,
  "xp": 92,
  "baseSuccess": 0.81,
  "failGold": 28,
  "loot": [
   {
    "type": "gold",
    "min": 11,
    "max": 34,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "foraging_ext2_06",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cooking_ext_02",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "brewing_ext_07",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_036",
  "name": "药膳坊",
  "reqLevel": 18,
  "intervalSec": 3.9,
  "xp": 92,
  "baseSuccess": 0.81,
  "failGold": 28,
  "loot": [
   {
    "type": "gold",
    "min": 11,
    "max": 34,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "excavation_ext2_05",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "brewing_ext2_05",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_037",
  "name": "渔摊",
  "reqLevel": 19,
  "intervalSec": 3.9,
  "xp": 96,
  "baseSuccess": 0.8,
  "failGold": 30,
  "loot": [
   {
    "type": "gold",
    "min": 12,
    "max": 36,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "fishing_ext_06",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "wildBBQ",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "herbalTea",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_038",
  "name": "豆制品铺",
  "reqLevel": 19,
  "intervalSec": 3.9,
  "xp": 96,
  "baseSuccess": 0.8,
  "failGold": 30,
  "loot": [
   {
    "type": "gold",
    "min": 12,
    "max": 36,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "rosemary_young",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "brewing_ext2_06",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_039",
  "name": "灵芝药膳馆",
  "reqLevel": 20,
  "intervalSec": 4,
  "xp": 101,
  "baseSuccess": 0.8,
  "failGold": 31,
  "loot": [
   {
    "type": "gold",
    "min": 12,
    "max": 37,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "excavation_ext2_07",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "grouperSteam",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "orangeJuice",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_040",
  "name": "茶水摊",
  "reqLevel": 20,
  "intervalSec": 4,
  "xp": 101,
  "baseSuccess": 0.8,
  "failGold": 31,
  "loot": [
   {
    "type": "gold",
    "min": 12,
    "max": 37,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "preserving_ext_07",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "brewing_ext_08",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_041",
  "name": "饮子铺",
  "reqLevel": 21,
  "intervalSec": 4,
  "xp": 106,
  "baseSuccess": 0.8,
  "failGold": 33,
  "loot": [
   {
    "type": "gold",
    "min": 13,
    "max": 40,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "foraging_ext2_06",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "brewing_ext2_07",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "cherryJuice",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_042",
  "name": "味摊",
  "reqLevel": 21,
  "intervalSec": 4,
  "xp": 106,
  "baseSuccess": 0.8,
  "failGold": 33,
  "loot": [
   {
    "type": "gold",
    "min": 13,
    "max": 40,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "chili",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cooking_ext_02",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_043",
  "name": "盛宴堂",
  "reqLevel": 22,
  "intervalSec": 4.1,
  "xp": 111,
  "baseSuccess": 0.8,
  "failGold": 34,
  "loot": [
   {
    "type": "gold",
    "min": 14,
    "max": 41,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "excavation_ext_06",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "arrowheadSoup",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "wildDish_6",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_044",
  "name": "山膳阁",
  "reqLevel": 22,
  "intervalSec": 4.1,
  "xp": 111,
  "baseSuccess": 0.8,
  "failGold": 34,
  "loot": [
   {
    "type": "gold",
    "min": 14,
    "max": 41,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "excavation_ext2_08",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "swordfishSteak",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_045",
  "name": "鲜果铺",
  "reqLevel": 23,
  "intervalSec": 4.1,
  "xp": 116,
  "baseSuccess": 0.79,
  "failGold": 35,
  "loot": [
   {
    "type": "gold",
    "min": 14,
    "max": 42,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "foraging_ext2_08",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "brewing_ext2_84",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "baking_ext_07",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_046",
  "name": "粮铺",
  "reqLevel": 23,
  "intervalSec": 4.1,
  "xp": 116,
  "baseSuccess": 0.79,
  "failGold": 35,
  "loot": [
   {
    "type": "gold",
    "min": 14,
    "max": 42,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "preserving_ext2_08",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "baconFriedRice",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_047",
  "name": "东北菜馆",
  "reqLevel": 24,
  "intervalSec": 4.2,
  "xp": 120,
  "baseSuccess": 0.79,
  "failGold": 37,
  "loot": [
   {
    "type": "gold",
    "min": 15,
    "max": 44,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "ume",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "braisedPerch",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "ironPlateRabbit",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_048",
  "name": "滋补堂",
  "reqLevel": 24,
  "intervalSec": 4.2,
  "xp": 120,
  "baseSuccess": 0.79,
  "failGold": 37,
  "loot": [
   {
    "type": "gold",
    "min": 15,
    "max": 44,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "excavation_ext_07",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "baking_ext2_09",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_049",
  "name": "海鲜小摊",
  "reqLevel": 25,
  "intervalSec": 4.2,
  "xp": 125,
  "baseSuccess": 0.79,
  "failGold": 38,
  "loot": [
   {
    "type": "gold",
    "min": 15,
    "max": 46,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "fishing_ext2_07",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cooking_ext2_09",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "baking_ext_08",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_050",
  "name": "盐铺",
  "reqLevel": 25,
  "intervalSec": 4.2,
  "xp": 125,
  "baseSuccess": 0.79,
  "failGold": 38,
  "loot": [
   {
    "type": "gold",
    "min": 15,
    "max": 46,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "spiceFix_2",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cooking_ext_09",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_051",
  "name": "药膳堂",
  "reqLevel": 26,
  "intervalSec": 4.3,
  "xp": 130,
  "baseSuccess": 0.79,
  "failGold": 39,
  "loot": [
   {
    "type": "gold",
    "min": 16,
    "max": 47,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "excavation_ext_07",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "energyBiscuit",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "wildDish_7",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_052",
  "name": "深海鲜舫",
  "reqLevel": 26,
  "intervalSec": 4.3,
  "xp": 130,
  "baseSuccess": 0.79,
  "failGold": 39,
  "loot": [
   {
    "type": "gold",
    "min": 16,
    "max": 47,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "fishing_ext2_08",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "wildDish_37",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_053",
  "name": "五味居",
  "reqLevel": 27,
  "intervalSec": 4.3,
  "xp": 135,
  "baseSuccess": 0.78,
  "failGold": 41,
  "loot": [
   {
    "type": "gold",
    "min": 16,
    "max": 49,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "excavation_ext_09",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "yuxiangPork",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "wildBBQ",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_054",
  "name": "刺身店",
  "reqLevel": 27,
  "intervalSec": 4.3,
  "xp": 135,
  "baseSuccess": 0.78,
  "failGold": 41,
  "loot": [
   {
    "type": "gold",
    "min": 16,
    "max": 49,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "fishing_ext2_09",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "silverCarpBraised",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_055",
  "name": "果汁铺",
  "reqLevel": 28,
  "intervalSec": 4.4,
  "xp": 139,
  "baseSuccess": 0.78,
  "failGold": 42,
  "loot": [
   {
    "type": "gold",
    "min": 17,
    "max": 50,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "spiceMixing_ext2_08",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "brewing_ext2_86",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "brewing_ext_09",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_056",
  "name": "味料摊",
  "reqLevel": 28,
  "intervalSec": 4.4,
  "xp": 139,
  "baseSuccess": 0.78,
  "failGold": 42,
  "loot": [
   {
    "type": "gold",
    "min": 17,
    "max": 50,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "cumin",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "silverCarpBraised",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_057",
  "name": "法式餐厅",
  "reqLevel": 29,
  "intervalSec": 4.4,
  "xp": 144,
  "baseSuccess": 0.78,
  "failGold": 44,
  "loot": [
   {
    "type": "gold",
    "min": 18,
    "max": 53,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "fishing_ext_09",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "blackCarpBraised",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "cooking_ext_07",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_058",
  "name": "米其林后厨",
  "reqLevel": 29,
  "intervalSec": 4.4,
  "xp": 144,
  "baseSuccess": 0.78,
  "failGold": 44,
  "loot": [
   {
    "type": "gold",
    "min": 18,
    "max": 53,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "spiceMixing_ext2_08",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "yuxiangPork",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_059",
  "name": "茶餐厅",
  "reqLevel": 30,
  "intervalSec": 4.5,
  "xp": 149,
  "baseSuccess": 0.78,
  "failGold": 45,
  "loot": [
   {
    "type": "gold",
    "min": 18,
    "max": 54,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "fishing_ext2_10",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cooking_ext_11",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "venisonSteak",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_060",
  "name": "日料店",
  "reqLevel": 30,
  "intervalSec": 4.5,
  "xp": 149,
  "baseSuccess": 0.78,
  "failGold": 45,
  "loot": [
   {
    "type": "gold",
    "min": 18,
    "max": 54,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "spiceMixing_ext_02",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cookDown_12",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_061",
  "name": "家常菜馆",
  "reqLevel": 31,
  "intervalSec": 4.5,
  "xp": 154,
  "baseSuccess": 0.77,
  "failGold": 46,
  "loot": [
   {
    "type": "gold",
    "min": 18,
    "max": 55,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "foraging_ext_09",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "braisedEggplant",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "wildDish_556",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_062",
  "name": "探店博主",
  "reqLevel": 31,
  "intervalSec": 4.5,
  "xp": 154,
  "baseSuccess": 0.77,
  "failGold": 46,
  "loot": [
   {
    "type": "gold",
    "min": 18,
    "max": 55,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "excavation_ext2_10",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cooking_ext_10",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_063",
  "name": "茗茶居",
  "reqLevel": 32,
  "intervalSec": 4.6,
  "xp": 159,
  "baseSuccess": 0.77,
  "failGold": 48,
  "loot": [
   {
    "type": "gold",
    "min": 19,
    "max": 58,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "sodaWater",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cookDown_1",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "strawberryJuice",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_064",
  "name": "海味餐厅",
  "reqLevel": 32,
  "intervalSec": 4.6,
  "xp": 159,
  "baseSuccess": 0.77,
  "failGold": 48,
  "loot": [
   {
    "type": "gold",
    "min": 19,
    "max": 58,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "fishing_ext_09",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "hairtailFry",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_065",
  "name": "美食主播",
  "reqLevel": 33,
  "intervalSec": 4.6,
  "xp": 163,
  "baseSuccess": 0.77,
  "failGold": 49,
  "loot": [
   {
    "type": "gold",
    "min": 20,
    "max": 59,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "excavation_ext2_11",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cookDown_9",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "brewing_ext2_85",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_066",
  "name": "卤味铺",
  "reqLevel": 33,
  "intervalSec": 4.6,
  "xp": 163,
  "baseSuccess": 0.77,
  "failGold": 49,
  "loot": [
   {
    "type": "gold",
    "min": 20,
    "max": 59,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "hunting_ext_09",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "boiledFish",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_067",
  "name": "风味馆",
  "reqLevel": 34,
  "intervalSec": 4.7,
  "xp": 168,
  "baseSuccess": 0.77,
  "failGold": 50,
  "loot": [
   {
    "type": "gold",
    "min": 20,
    "max": 60,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "jinyingziPowder",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "grassCarpBoiled",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "wildDish_37",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_068",
  "name": "美食家私宅",
  "reqLevel": 34,
  "intervalSec": 4.7,
  "xp": 168,
  "baseSuccess": 0.77,
  "failGold": 50,
  "loot": [
   {
    "type": "gold",
    "min": 20,
    "max": 60,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "excavation_ext_10",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cookDown_1",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_069",
  "name": "川味馆",
  "reqLevel": 35,
  "intervalSec": 4.7,
  "xp": 173,
  "baseSuccess": 0.76,
  "failGold": 52,
  "loot": [
   {
    "type": "gold",
    "min": 21,
    "max": 62,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "spiceMixing_ext_07",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "tilapiaBraised",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "cookDown_19",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_070",
  "name": "调香坊",
  "reqLevel": 35,
  "intervalSec": 4.7,
  "xp": 173,
  "baseSuccess": 0.76,
  "failGold": 52,
  "loot": [
   {
    "type": "gold",
    "min": 21,
    "max": 62,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "clove",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "brewing_ext2_12",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_071",
  "name": "果酱坊",
  "reqLevel": 36,
  "intervalSec": 4.8,
  "xp": 178,
  "baseSuccess": 0.76,
  "failGold": 53,
  "loot": [
   {
    "type": "gold",
    "min": 21,
    "max": 64,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "foraging_ext_11",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cookDown_7",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "bakeDown_4",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_072",
  "name": "咖喱坊",
  "reqLevel": 36,
  "intervalSec": 4.8,
  "xp": 178,
  "baseSuccess": 0.76,
  "failGold": 53,
  "loot": [
   {
    "type": "gold",
    "min": 21,
    "max": 64,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "bayLeaf",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "wildDish_9",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_073",
  "name": "烧肉居",
  "reqLevel": 37,
  "intervalSec": 4.8,
  "xp": 183,
  "baseSuccess": 0.76,
  "failGold": 55,
  "loot": [
   {
    "type": "gold",
    "min": 22,
    "max": 66,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "goatMeat",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "bakeDown_3",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "cookDown_5",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_074",
  "name": "蚝油坊",
  "reqLevel": 37,
  "intervalSec": 4.8,
  "xp": 183,
  "baseSuccess": 0.76,
  "failGold": 55,
  "loot": [
   {
    "type": "gold",
    "min": 22,
    "max": 66,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "wuweiziPowder",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "baking_ext2_10",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_075",
  "name": "农家乐",
  "reqLevel": 38,
  "intervalSec": 4.9,
  "xp": 187,
  "baseSuccess": 0.76,
  "failGold": 56,
  "loot": [
   {
    "type": "gold",
    "min": 22,
    "max": 67,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "foraging_ext2_11",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cookDown_21",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "blackCarpBraised",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_076",
  "name": "私房菜馆",
  "reqLevel": 38,
  "intervalSec": 4.9,
  "xp": 187,
  "baseSuccess": 0.76,
  "failGold": 56,
  "loot": [
   {
    "type": "gold",
    "min": 22,
    "max": 67,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "spiceMixing_ext_08",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cookDown_5",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_077",
  "name": "美食博主工作室",
  "reqLevel": 39,
  "intervalSec": 4.9,
  "xp": 192,
  "baseSuccess": 0.75,
  "failGold": 57,
  "loot": [
   {
    "type": "gold",
    "min": 23,
    "max": 68,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "excavation_ext2_12",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "bakeDown_7",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "cookDown_19",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_078",
  "name": "蜜饯铺",
  "reqLevel": 39,
  "intervalSec": 4.9,
  "xp": 192,
  "baseSuccess": 0.75,
  "failGold": 57,
  "loot": [
   {
    "type": "gold",
    "min": 23,
    "max": 68,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "foraging_ext_12",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cookDown_21",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_079",
  "name": "意式餐厅",
  "reqLevel": 40,
  "intervalSec": 5,
  "xp": 197,
  "baseSuccess": 0.75,
  "failGold": 59,
  "loot": [
   {
    "type": "gold",
    "min": 24,
    "max": 71,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "preserving_ext2_13",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cookDown_13",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "vanillaCake",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_080",
  "name": "国色天香阁",
  "reqLevel": 40,
  "intervalSec": 5,
  "xp": 197,
  "baseSuccess": 0.75,
  "failGold": 59,
  "loot": [
   {
    "type": "gold",
    "min": 24,
    "max": 71,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "preserving_ext2_13",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cookDown_18",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_081",
  "name": "泰式餐厅",
  "reqLevel": 41,
  "intervalSec": 5,
  "xp": 202,
  "baseSuccess": 0.75,
  "failGold": 60,
  "loot": [
   {
    "type": "gold",
    "min": 24,
    "max": 72,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "spiceMixing_ext_10",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "wildDish_13",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "octopusGarlic",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_082",
  "name": "果品铺",
  "reqLevel": 41,
  "intervalSec": 5,
  "xp": 202,
  "baseSuccess": 0.75,
  "failGold": 60,
  "loot": [
   {
    "type": "gold",
    "min": 24,
    "max": 72,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "foraging_ext2_13",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "yellowCroakerBraised",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_083",
  "name": "泡芙铺",
  "reqLevel": 42,
  "intervalSec": 5.1,
  "xp": 207,
  "baseSuccess": 0.75,
  "failGold": 61,
  "loot": [
   {
    "type": "gold",
    "min": 24,
    "max": 73,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "preserving_ext2_14",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "bakeDown_20",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "bakeDown_3",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_084",
  "name": "醋坊",
  "reqLevel": 42,
  "intervalSec": 5.1,
  "xp": 207,
  "baseSuccess": 0.75,
  "failGold": 61,
  "loot": [
   {
    "type": "gold",
    "min": 24,
    "max": 73,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "wuzhuyuPowder",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "baking_ext_14",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_085",
  "name": "深夜食堂",
  "reqLevel": 43,
  "intervalSec": 5.1,
  "xp": 211,
  "baseSuccess": 0.74,
  "failGold": 63,
  "loot": [
   {
    "type": "gold",
    "min": 25,
    "max": 76,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "figPreserve",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "wildDish_39",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "wildDish_41",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_086",
  "name": "茶艺馆",
  "reqLevel": 43,
  "intervalSec": 5.1,
  "xp": 211,
  "baseSuccess": 0.74,
  "failGold": 63,
  "loot": [
   {
    "type": "gold",
    "min": 25,
    "max": 76,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "spiceMixing_ext2_03",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "brewing_ext2_12",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_087",
  "name": "果切摊",
  "reqLevel": 44,
  "intervalSec": 5.2,
  "xp": 216,
  "baseSuccess": 0.74,
  "failGold": 64,
  "loot": [
   {
    "type": "gold",
    "min": 26,
    "max": 77,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "foraging_ext2_14",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "sweetRiceWine",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "yieldTonic3",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_088",
  "name": "酱园",
  "reqLevel": 44,
  "intervalSec": 5.2,
  "xp": 216,
  "baseSuccess": 0.74,
  "failGold": 64,
  "loot": [
   {
    "type": "gold",
    "min": 26,
    "max": 77,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "wuzhuyuPowder",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "garlicLobster",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_089",
  "name": "仙果斋",
  "reqLevel": 45,
  "intervalSec": 5.2,
  "xp": 221,
  "baseSuccess": 0.74,
  "failGold": 66,
  "loot": [
   {
    "type": "gold",
    "min": 26,
    "max": 79,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "foraging_ext2_13",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "lycheeJuice",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "baking_ext2_14",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_090",
  "name": "酥点坊",
  "reqLevel": 45,
  "intervalSec": 5.2,
  "xp": 221,
  "baseSuccess": 0.74,
  "failGold": 66,
  "loot": [
   {
    "type": "gold",
    "min": 26,
    "max": 79,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "pistachioRoast",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "bakeDown_6",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_091",
  "name": "美食评论家",
  "reqLevel": 46,
  "intervalSec": 5.3,
  "xp": 226,
  "baseSuccess": 0.74,
  "failGold": 67,
  "loot": [
   {
    "type": "gold",
    "min": 27,
    "max": 80,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "excavation_ext_13",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "brewing_ext2_14",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "cooking_ext2_16",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_092",
  "name": "烧腊铺",
  "reqLevel": 46,
  "intervalSec": 5.3,
  "xp": 226,
  "baseSuccess": 0.74,
  "failGold": 67,
  "loot": [
   {
    "type": "gold",
    "min": 27,
    "max": 80,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "bisonMeat",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "baking_ext_13",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_093",
  "name": "火腿铺",
  "reqLevel": 47,
  "intervalSec": 5.3,
  "xp": 231,
  "baseSuccess": 0.73,
  "failGold": 68,
  "loot": [
   {
    "type": "gold",
    "min": 27,
    "max": 82,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "bisonMeat",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cuttlefishSoup",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "bakeDown_5",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_094",
  "name": "火锅底料坊",
  "reqLevel": 47,
  "intervalSec": 5.3,
  "xp": 231,
  "baseSuccess": 0.73,
  "failGold": 68,
  "loot": [
   {
    "type": "gold",
    "min": 27,
    "max": 82,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "amomum",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "baking_ext2_13",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_095",
  "name": "甜品铺",
  "reqLevel": 48,
  "intervalSec": 5.4,
  "xp": 235,
  "baseSuccess": 0.73,
  "failGold": 70,
  "loot": [
   {
    "type": "gold",
    "min": 28,
    "max": 84,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "fishing_ext2_14",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "vanillaCake",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "baking_ext_14",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_096",
  "name": "烤鱼铺",
  "reqLevel": 48,
  "intervalSec": 5.4,
  "xp": 235,
  "baseSuccess": 0.73,
  "failGold": 70,
  "loot": [
   {
    "type": "gold",
    "min": 28,
    "max": 84,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "fishing_ext2_14",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "xpTonic3",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_097",
  "name": "渔港食堂",
  "reqLevel": 49,
  "intervalSec": 5.4,
  "xp": 240,
  "baseSuccess": 0.73,
  "failGold": 71,
  "loot": [
   {
    "type": "gold",
    "min": 28,
    "max": 85,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "fishing_ext2_15",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "bakeDown_14",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "cuttlefishSoup",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_098",
  "name": "蛋糕铺",
  "reqLevel": 49,
  "intervalSec": 5.4,
  "xp": 240,
  "baseSuccess": 0.73,
  "failGold": 71,
  "loot": [
   {
    "type": "gold",
    "min": 28,
    "max": 85,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "spiceMixing_ext2_03",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "baking_ext2_15",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_099",
  "name": "酱油坊",
  "reqLevel": 50,
  "intervalSec": 5.5,
  "xp": 245,
  "baseSuccess": 0.72,
  "failGold": 73,
  "loot": [
   {
    "type": "gold",
    "min": 29,
    "max": 88,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "mysterySpice",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "yamJuice",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "rosemaryBread",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_100",
  "name": "深夜饭堂",
  "reqLevel": 50,
  "intervalSec": 5.5,
  "xp": 245,
  "baseSuccess": 0.72,
  "failGold": 73,
  "loot": [
   {
    "type": "gold",
    "min": 29,
    "max": 88,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "spiceMixing_ext2_16",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "wildDish_42",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_101",
  "name": "蟠桃宴席",
  "reqLevel": 51,
  "intervalSec": 5.6,
  "xp": 250,
  "baseSuccess": 0.72,
  "failGold": 74,
  "loot": [
   {
    "type": "gold",
    "min": 30,
    "max": 89,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "foraging_ext_16",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "bassaFry",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "baking_ext2_16",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_102",
  "name": "海鲜排档",
  "reqLevel": 51,
  "intervalSec": 5.6,
  "xp": 250,
  "baseSuccess": 0.72,
  "failGold": 74,
  "loot": [
   {
    "type": "gold",
    "min": 30,
    "max": 89,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "fishing_ext2_16",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "oysterGarlic",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_103",
  "name": "凉茶铺",
  "reqLevel": 52,
  "intervalSec": 5.6,
  "xp": 255,
  "baseSuccess": 0.72,
  "failGold": 75,
  "loot": [
   {
    "type": "gold",
    "min": 30,
    "max": 90,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "preserving_ext2_16",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "brewing_ext_14",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "bakeDown_19",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_104",
  "name": "果饮坊",
  "reqLevel": 52,
  "intervalSec": 5.6,
  "xp": 255,
  "baseSuccess": 0.72,
  "failGold": 75,
  "loot": [
   {
    "type": "gold",
    "min": 30,
    "max": 90,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "longanDry",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "brewing_ext_17",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_105",
  "name": "饺子馆",
  "reqLevel": 53,
  "intervalSec": 5.7,
  "xp": 259,
  "baseSuccess": 0.72,
  "failGold": 77,
  "loot": [
   {
    "type": "gold",
    "min": 31,
    "max": 92,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "excavation_ext_17",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "sushiPlatter",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "bakeDown_15",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_106",
  "name": "时令果庄",
  "reqLevel": 53,
  "intervalSec": 5.7,
  "xp": 259,
  "baseSuccess": 0.72,
  "failGold": 77,
  "loot": [
   {
    "type": "gold",
    "min": 31,
    "max": 92,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "foraging_ext2_16",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "wuchangSteam",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_107",
  "name": "甜馨居",
  "reqLevel": 54,
  "intervalSec": 5.7,
  "xp": 264,
  "baseSuccess": 0.71,
  "failGold": 78,
  "loot": [
   {
    "type": "gold",
    "min": 31,
    "max": 94,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "loquatPreserve",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "baking_ext2_16",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "cooking_ext2_18",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_108",
  "name": "可丽饼铺",
  "reqLevel": 54,
  "intervalSec": 5.7,
  "xp": 264,
  "baseSuccess": 0.71,
  "failGold": 78,
  "loot": [
   {
    "type": "gold",
    "min": 31,
    "max": 94,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "spiceMixing_ext_17",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cooking_ext_01",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_109",
  "name": "腊味铺",
  "reqLevel": 55,
  "intervalSec": 5.8,
  "xp": 269,
  "baseSuccess": 0.71,
  "failGold": 79,
  "loot": [
   {
    "type": "gold",
    "min": 32,
    "max": 95,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "foraging_ext_16",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "wildDish_43",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "goatHotpot",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_110",
  "name": "卤味轩",
  "reqLevel": 55,
  "intervalSec": 5.8,
  "xp": 269,
  "baseSuccess": 0.71,
  "failGold": 79,
  "loot": [
   {
    "type": "gold",
    "min": 32,
    "max": 95,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "hunting_ext_17",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "bakeDown_14",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_111",
  "name": "咖啡厅",
  "reqLevel": 56,
  "intervalSec": 5.8,
  "xp": 274,
  "baseSuccess": 0.71,
  "failGold": 81,
  "loot": [
   {
    "type": "gold",
    "min": 32,
    "max": 97,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "preserving_ext_18",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "brewing_ext2_16",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "baking_ext_16",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_112",
  "name": "奶茶店",
  "reqLevel": 56,
  "intervalSec": 5.8,
  "xp": 274,
  "baseSuccess": 0.71,
  "failGold": 81,
  "loot": [
   {
    "type": "gold",
    "min": 32,
    "max": 97,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "hawthornPreserve",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "brewing_ext_18",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_113",
  "name": "松饼铺",
  "reqLevel": 57,
  "intervalSec": 5.9,
  "xp": 279,
  "baseSuccess": 0.71,
  "failGold": 82,
  "loot": [
   {
    "type": "gold",
    "min": 33,
    "max": 98,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "loquatPreserve",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "baking_ext_18",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "mangoWine",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_114",
  "name": "时令果园",
  "reqLevel": 57,
  "intervalSec": 5.9,
  "xp": 279,
  "baseSuccess": 0.71,
  "failGold": 82,
  "loot": [
   {
    "type": "gold",
    "min": 33,
    "max": 98,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "foraging_ext2_17",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "lobsterCongee",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_115",
  "name": "鲜鱼馆",
  "reqLevel": 58,
  "intervalSec": 5.9,
  "xp": 283,
  "baseSuccess": 0.7,
  "failGold": 84,
  "loot": [
   {
    "type": "gold",
    "min": 34,
    "max": 101,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "fishing_ext_17",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "durianPastry",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "brewing_ext_18",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_116",
  "name": "水果摊",
  "reqLevel": 58,
  "intervalSec": 5.9,
  "xp": 283,
  "baseSuccess": 0.7,
  "failGold": 84,
  "loot": [
   {
    "type": "gold",
    "min": 34,
    "max": 101,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "foraging_ext2_17",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "agarSalad",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_117",
  "name": "蛋挞铺",
  "reqLevel": 59,
  "intervalSec": 6,
  "xp": 288,
  "baseSuccess": 0.7,
  "failGold": 85,
  "loot": [
   {
    "type": "gold",
    "min": 34,
    "max": 102,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "excavation_ext2_17",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "bakeDown_16",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "wildDish_43",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_118",
  "name": "酒馆",
  "reqLevel": 59,
  "intervalSec": 6,
  "xp": 288,
  "baseSuccess": 0.7,
  "failGold": 85,
  "loot": [
   {
    "type": "gold",
    "min": 34,
    "max": 102,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "preserving_ext_17",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "gojiWine",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_119",
  "name": "渔家宴",
  "reqLevel": 60,
  "intervalSec": 6,
  "xp": 293,
  "baseSuccess": 0.7,
  "failGold": 86,
  "loot": [
   {
    "type": "gold",
    "min": 34,
    "max": 103,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "fishing_ext_19",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "brewing_ext_19",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "pepperSaltLobster",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_120",
  "name": "海鲜市场",
  "reqLevel": 60,
  "intervalSec": 6,
  "xp": 293,
  "baseSuccess": 0.7,
  "failGold": 86,
  "loot": [
   {
    "type": "gold",
    "min": 34,
    "max": 103,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "fishing_ext2_18",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "brewing_ext2_19",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_121",
  "name": "提拉米苏铺",
  "reqLevel": 61,
  "intervalSec": 6.1,
  "xp": 298,
  "baseSuccess": 0.7,
  "failGold": 88,
  "loot": [
   {
    "type": "gold",
    "min": 35,
    "max": 106,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "spiceMixing_ext2_19",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "bakeDown_22",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "brewing_ext2_20",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_122",
  "name": "烧鹅铺",
  "reqLevel": 61,
  "intervalSec": 6.1,
  "xp": 298,
  "baseSuccess": 0.7,
  "failGold": 88,
  "loot": [
   {
    "type": "gold",
    "min": 35,
    "max": 106,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "foraging_ext_18",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "baking_ext2_20",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_123",
  "name": "菌菇斋",
  "reqLevel": 62,
  "intervalSec": 6.1,
  "xp": 303,
  "baseSuccess": 0.69,
  "failGold": 89,
  "loot": [
   {
    "type": "gold",
    "min": 36,
    "max": 107,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "spiceMixing_ext2_19",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "scallopGarlic",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "cooking_ext_14",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_124",
  "name": "寿司店",
  "reqLevel": 62,
  "intervalSec": 6.1,
  "xp": 303,
  "baseSuccess": 0.69,
  "failGold": 89,
  "loot": [
   {
    "type": "gold",
    "min": 36,
    "max": 107,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "fishing_ext_19",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "durianPastry",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_125",
  "name": "烧麦铺",
  "reqLevel": 63,
  "intervalSec": 6.2,
  "xp": 307,
  "baseSuccess": 0.69,
  "failGold": 90,
  "loot": [
   {
    "type": "gold",
    "min": 36,
    "max": 108,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "walnutRoast",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "wildDish_17",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "musselSoup",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_126",
  "name": "马卡龙铺",
  "reqLevel": 63,
  "intervalSec": 6.2,
  "xp": 307,
  "baseSuccess": 0.69,
  "failGold": 90,
  "loot": [
   {
    "type": "gold",
    "min": 36,
    "max": 108,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "spiceMixing_ext_19",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "bakeDown_25",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_127",
  "name": "酱料坊",
  "reqLevel": 64,
  "intervalSec": 6.2,
  "xp": 312,
  "baseSuccess": 0.69,
  "failGold": 92,
  "loot": [
   {
    "type": "gold",
    "min": 37,
    "max": 110,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "preserving_ext2_20",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cooking_ext2_18",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "wildDish_19",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_128",
  "name": "香草园",
  "reqLevel": 64,
  "intervalSec": 6.2,
  "xp": 312,
  "baseSuccess": 0.69,
  "failGold": 92,
  "loot": [
   {
    "type": "gold",
    "min": 37,
    "max": 110,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "parsley",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "wildDish_19",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_129",
  "name": "奶茶铺",
  "reqLevel": 65,
  "intervalSec": 6.3,
  "xp": 317,
  "baseSuccess": 0.69,
  "failGold": 93,
  "loot": [
   {
    "type": "gold",
    "min": 37,
    "max": 112,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "dill",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "buddhaJump",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "abaloneStew",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_130",
  "name": "花茶轩",
  "reqLevel": 65,
  "intervalSec": 6.3,
  "xp": 317,
  "baseSuccess": 0.69,
  "failGold": 93,
  "loot": [
   {
    "type": "gold",
    "min": 37,
    "max": 112,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "foraging_ext_20",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "bakeDown_17",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_131",
  "name": "葡萄酒庄",
  "reqLevel": 66,
  "intervalSec": 6.3,
  "xp": 322,
  "baseSuccess": 0.68,
  "failGold": 95,
  "loot": [
   {
    "type": "gold",
    "min": 38,
    "max": 114,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "excavation_ext_20",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "mandarinWine",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "brewing_ext_20",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_132",
  "name": "御味轩",
  "reqLevel": 66,
  "intervalSec": 6.3,
  "xp": 322,
  "baseSuccess": 0.68,
  "failGold": 95,
  "loot": [
   {
    "type": "gold",
    "min": 38,
    "max": 114,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "shihuPowder",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "bakeDown_23",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_133",
  "name": "太古食庙",
  "reqLevel": 67,
  "intervalSec": 6.4,
  "xp": 327,
  "baseSuccess": 0.68,
  "failGold": 96,
  "loot": [
   {
    "type": "gold",
    "min": 38,
    "max": 115,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "excavation_ext2_20",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cookDown_26",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "kelpSoup",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_134",
  "name": "御用香草轩",
  "reqLevel": 67,
  "intervalSec": 6.4,
  "xp": 327,
  "baseSuccess": 0.68,
  "failGold": 96,
  "loot": [
   {
    "type": "gold",
    "min": 38,
    "max": 115,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "parsley",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "braisedBearPaw",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_135",
  "name": "传说餐厅",
  "reqLevel": 68,
  "intervalSec": 6.4,
  "xp": 331,
  "baseSuccess": 0.68,
  "failGold": 97,
  "loot": [
   {
    "type": "gold",
    "min": 39,
    "max": 116,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "fishing_ext2_21",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cookDown_25",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "cookDown_4",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_136",
  "name": "天香阁",
  "reqLevel": 68,
  "intervalSec": 6.4,
  "xp": 331,
  "baseSuccess": 0.68,
  "failGold": 97,
  "loot": [
   {
    "type": "gold",
    "min": 39,
    "max": 116,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "fossilSpice",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cooking_ext_22",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_137",
  "name": "琼浆阁",
  "reqLevel": 69,
  "intervalSec": 6.5,
  "xp": 336,
  "baseSuccess": 0.68,
  "failGold": 99,
  "loot": [
   {
    "type": "gold",
    "min": 40,
    "max": 119,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "excavation_ext_22",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "brewing_ext2_93",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "baking_ext_22",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_138",
  "name": "深海御膳",
  "reqLevel": 69,
  "intervalSec": 6.5,
  "xp": 336,
  "baseSuccess": 0.68,
  "failGold": 99,
  "loot": [
   {
    "type": "gold",
    "min": 40,
    "max": 119,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "fishing_ext_22",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "brewing_ext2_92",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_139",
  "name": "仙膳坊",
  "reqLevel": 70,
  "intervalSec": 6.5,
  "xp": 341,
  "baseSuccess": 0.67,
  "failGold": 100,
  "loot": [
   {
    "type": "gold",
    "min": 40,
    "max": 120,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "preserving_ext_04",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "buddhaJump",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "baking_ext2_20",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_140",
  "name": "玲珑食府",
  "reqLevel": 70,
  "intervalSec": 6.5,
  "xp": 341,
  "baseSuccess": 0.67,
  "failGold": 100,
  "loot": [
   {
    "type": "gold",
    "min": 40,
    "max": 120,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "foraging_ext2_22",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "laverSoup",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_141",
  "name": "洪荒食宴",
  "reqLevel": 71,
  "intervalSec": 6.6,
  "xp": 346,
  "baseSuccess": 0.67,
  "failGold": 101,
  "loot": [
   {
    "type": "gold",
    "min": 40,
    "max": 121,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "preserving_ext2_22",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "buddhaJump",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "wildDish_20",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_142",
  "name": "御膳面点",
  "reqLevel": 71,
  "intervalSec": 6.6,
  "xp": 346,
  "baseSuccess": 0.67,
  "failGold": 101,
  "loot": [
   {
    "type": "gold",
    "min": 40,
    "max": 121,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "excavation_ext_22",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cooking_ext2_23",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_143",
  "name": "御膳香料坊",
  "reqLevel": 72,
  "intervalSec": 6.6,
  "xp": 351,
  "baseSuccess": 0.67,
  "failGold": 103,
  "loot": [
   {
    "type": "gold",
    "min": 41,
    "max": 124,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "baizhiPowder",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cooking_ext2_20",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "akagaiStir",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_144",
  "name": "天味斋",
  "reqLevel": 72,
  "intervalSec": 6.6,
  "xp": 351,
  "baseSuccess": 0.67,
  "failGold": 103,
  "loot": [
   {
    "type": "gold",
    "min": 41,
    "max": 124,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "huangjingPowder",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "prawnBoiled",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_145",
  "name": "烤鸭店",
  "reqLevel": 73,
  "intervalSec": 6.7,
  "xp": 355,
  "baseSuccess": 0.67,
  "failGold": 104,
  "loot": [
   {
    "type": "gold",
    "min": 42,
    "max": 125,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "hunting_ext2_22",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cooking_ext2_14",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "baking_ext_20",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_146",
  "name": "天厨行宫",
  "reqLevel": 73,
  "intervalSec": 6.7,
  "xp": 355,
  "baseSuccess": 0.67,
  "failGold": 104,
  "loot": [
   {
    "type": "gold",
    "min": 42,
    "max": 125,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "spiceMixing_ext_21",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "birdClamBoiled",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_147",
  "name": "天府食轩",
  "reqLevel": 74,
  "intervalSec": 6.7,
  "xp": 360,
  "baseSuccess": 0.66,
  "failGold": 106,
  "loot": [
   {
    "type": "gold",
    "min": 42,
    "max": 127,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "hunting_ext_22",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cookDown_4",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "cooking_ext2_22",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_148",
  "name": "野生菌宴",
  "reqLevel": 74,
  "intervalSec": 6.7,
  "xp": 360,
  "baseSuccess": 0.66,
  "failGold": 106,
  "loot": [
   {
    "type": "gold",
    "min": 42,
    "max": 127,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "foraging_ext_22",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "brewing_ext_21",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_149",
  "name": "史前盛宴",
  "reqLevel": 75,
  "intervalSec": 6.8,
  "xp": 365,
  "baseSuccess": 0.66,
  "failGold": 107,
  "loot": [
   {
    "type": "gold",
    "min": 43,
    "max": 128,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "fossilSpice",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "buddhaJump",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "cookDown_28",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_150",
  "name": "龙宫盛宴",
  "reqLevel": 75,
  "intervalSec": 6.8,
  "xp": 365,
  "baseSuccess": 0.66,
  "failGold": 107,
  "loot": [
   {
    "type": "gold",
    "min": 43,
    "max": 128,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "spiceMixing_ext2_23",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "dragonHotpot",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_151",
  "name": "厨界传奇",
  "reqLevel": 76,
  "intervalSec": 6.8,
  "xp": 370,
  "baseSuccess": 0.66,
  "failGold": 108,
  "loot": [
   {
    "type": "gold",
    "min": 43,
    "max": 130,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "ginseng",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "arkShellGinger",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "silverFungusSoup",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_152",
  "name": "限定料理店",
  "reqLevel": 76,
  "intervalSec": 6.8,
  "xp": 370,
  "baseSuccess": 0.66,
  "failGold": 108,
  "loot": [
   {
    "type": "gold",
    "min": 43,
    "max": 130,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "foraging_ext2_22",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "dragonHotpot",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_153",
  "name": "名厨私藏馆",
  "reqLevel": 77,
  "intervalSec": 6.9,
  "xp": 374,
  "baseSuccess": 0.66,
  "failGold": 110,
  "loot": [
   {
    "type": "gold",
    "min": 44,
    "max": 132,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "spiceMixing_ext2_23",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cooking_ext2_22",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "braisedBamboo",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_154",
  "name": "神话餐厅",
  "reqLevel": 77,
  "intervalSec": 6.9,
  "xp": 374,
  "baseSuccess": 0.66,
  "failGold": 110,
  "loot": [
   {
    "type": "gold",
    "min": 44,
    "max": 132,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "ginseng",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "bakeDown_26",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_155",
  "name": "御面堂",
  "reqLevel": 78,
  "intervalSec": 6.9,
  "xp": 379,
  "baseSuccess": 0.65,
  "failGold": 111,
  "loot": [
   {
    "type": "gold",
    "min": 44,
    "max": 133,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "preserving_ext_24",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "trufflePasta",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "birdClamBoiled",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_156",
  "name": "天宫御膳",
  "reqLevel": 78,
  "intervalSec": 6.9,
  "xp": 379,
  "baseSuccess": 0.65,
  "failGold": 111,
  "loot": [
   {
    "type": "gold",
    "min": 44,
    "max": 133,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "foraging_ext2_24",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "baking_ext2_24",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_157",
  "name": "百蔬居",
  "reqLevel": 79,
  "intervalSec": 7,
  "xp": 384,
  "baseSuccess": 0.65,
  "failGold": 112,
  "loot": [
   {
    "type": "gold",
    "min": 45,
    "max": 134,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "foraging_ext_24",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "baking_ext_22",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "brewing_ext_23",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_158",
  "name": "千年食府",
  "reqLevel": 79,
  "intervalSec": 7,
  "xp": 384,
  "baseSuccess": 0.65,
  "failGold": 112,
  "loot": [
   {
    "type": "gold",
    "min": 45,
    "max": 134,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "spiceMixing_ext2_23",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "wildDish_23",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_159",
  "name": "牛排馆",
  "reqLevel": 80,
  "intervalSec": 7,
  "xp": 389,
  "baseSuccess": 0.65,
  "failGold": 114,
  "loot": [
   {
    "type": "gold",
    "min": 46,
    "max": 137,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "hunting_ext2_25",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cookDown_37",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "bergamotWine",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_160",
  "name": "时令料理馆",
  "reqLevel": 80,
  "intervalSec": 7,
  "xp": 389,
  "baseSuccess": 0.65,
  "failGold": 114,
  "loot": [
   {
    "type": "gold",
    "min": 46,
    "max": 137,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "excavation_ext_24",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "musselGarlic",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_161",
  "name": "食神居所",
  "reqLevel": 81,
  "intervalSec": 7.1,
  "xp": 394,
  "baseSuccess": 0.65,
  "failGold": 115,
  "loot": [
   {
    "type": "gold",
    "min": 46,
    "max": 138,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "hunting_ext2_24",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cookDown_36",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "wildDish_22",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_162",
  "name": "扒房",
  "reqLevel": 81,
  "intervalSec": 7.1,
  "xp": 394,
  "baseSuccess": 0.65,
  "failGold": 115,
  "loot": [
   {
    "type": "gold",
    "min": 46,
    "max": 138,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "hunting_ext_24",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "baking_ext2_25",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_163",
  "name": "海龙王宴",
  "reqLevel": 82,
  "intervalSec": 7.1,
  "xp": 398,
  "baseSuccess": 0.64,
  "failGold": 117,
  "loot": [
   {
    "type": "gold",
    "min": 47,
    "max": 140,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "fishing_ext_24",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "brewing_ext2_25",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "goldenFeast",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_164",
  "name": "海鲜大酒楼",
  "reqLevel": 82,
  "intervalSec": 7.1,
  "xp": 398,
  "baseSuccess": 0.64,
  "failGold": 117,
  "loot": [
   {
    "type": "gold",
    "min": 47,
    "max": 140,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "fishing_ext_25",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "brewing_ext_24",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_165",
  "name": "黄酒坊",
  "reqLevel": 83,
  "intervalSec": 7.2,
  "xp": 403,
  "baseSuccess": 0.64,
  "failGold": 118,
  "loot": [
   {
    "type": "gold",
    "min": 47,
    "max": 142,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "excavation_ext2_26",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "brewing_ext2_25",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "brewing_ext2_96",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_166",
  "name": "御膳烤坊",
  "reqLevel": 83,
  "intervalSec": 7.2,
  "xp": 403,
  "baseSuccess": 0.64,
  "failGold": 118,
  "loot": [
   {
    "type": "gold",
    "min": 47,
    "max": 142,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "mammothMeat",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "brewing_ext2_94",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_167",
  "name": "琼浆玉液阁",
  "reqLevel": 84,
  "intervalSec": 7.2,
  "xp": 408,
  "baseSuccess": 0.64,
  "failGold": 119,
  "loot": [
   {
    "type": "gold",
    "min": 48,
    "max": 143,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "excavation_ext_26",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "geoduckSteam",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "goldenFeast",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_168",
  "name": "御宴烤坊",
  "reqLevel": 84,
  "intervalSec": 7.2,
  "xp": 408,
  "baseSuccess": 0.64,
  "failGold": 119,
  "loot": [
   {
    "type": "gold",
    "min": 48,
    "max": 143,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "mammothMeat",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "yieldTonic5",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_169",
  "name": "松露料理馆",
  "reqLevel": 85,
  "intervalSec": 7.3,
  "xp": 413,
  "baseSuccess": 0.64,
  "failGold": 121,
  "loot": [
   {
    "type": "gold",
    "min": 48,
    "max": 145,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "fishing_ext_26",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "goldenFeast",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "preservTier5",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_170",
  "name": "刀削肉铺",
  "reqLevel": 85,
  "intervalSec": 7.3,
  "xp": 413,
  "baseSuccess": 0.64,
  "failGold": 121,
  "loot": [
   {
    "type": "gold",
    "min": 48,
    "max": 145,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "hunting_ext_25",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "wildDish_25",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_171",
  "name": "甜品实验室",
  "reqLevel": 86,
  "intervalSec": 7.3,
  "xp": 418,
  "baseSuccess": 0.63,
  "failGold": 122,
  "loot": [
   {
    "type": "gold",
    "min": 49,
    "max": 146,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "hunting_ext_26",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "spinachSoup",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "geoduckSteam",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_172",
  "name": "松露坊",
  "reqLevel": 86,
  "intervalSec": 7.3,
  "xp": 418,
  "baseSuccess": 0.63,
  "failGold": 122,
  "loot": [
   {
    "type": "gold",
    "min": 49,
    "max": 146,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "preserving_ext2_27",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "mantisShrimpSalt",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_173",
  "name": "法式甜点屋",
  "reqLevel": 87,
  "intervalSec": 7.4,
  "xp": 422,
  "baseSuccess": 0.63,
  "failGold": 123,
  "loot": [
   {
    "type": "gold",
    "min": 49,
    "max": 148,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "spiceMixing_ext_26",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cookDown_39",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "scallopBroad",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_174",
  "name": "熏肉摊",
  "reqLevel": 87,
  "intervalSec": 7.4,
  "xp": 422,
  "baseSuccess": 0.63,
  "failGold": 123,
  "loot": [
   {
    "type": "gold",
    "min": 49,
    "max": 148,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "hunting_ext_25",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "brewing_ext2_96",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_175",
  "name": "田园菜馆",
  "reqLevel": 88,
  "intervalSec": 7.4,
  "xp": 427,
  "baseSuccess": 0.63,
  "failGold": 125,
  "loot": [
   {
    "type": "gold",
    "min": 50,
    "max": 150,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "foraging_ext_26",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "baking_ext_25",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "cooking_ext2_26",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_176",
  "name": "拉面道场",
  "reqLevel": 88,
  "intervalSec": 7.4,
  "xp": 427,
  "baseSuccess": 0.63,
  "failGold": 125,
  "loot": [
   {
    "type": "gold",
    "min": 50,
    "max": 150,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "fishing_ext_26",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "baking_ext_25",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_177",
  "name": "云糕阁",
  "reqLevel": 89,
  "intervalSec": 7.5,
  "xp": 432,
  "baseSuccess": 0.63,
  "failGold": 126,
  "loot": [
   {
    "type": "gold",
    "min": 50,
    "max": 151,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "excavation_ext2_26",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "scallopBroad",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "brewing_ext2_26",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_178",
  "name": "玉液轩",
  "reqLevel": 89,
  "intervalSec": 7.5,
  "xp": 432,
  "baseSuccess": 0.63,
  "failGold": 126,
  "loot": [
   {
    "type": "gold",
    "min": 50,
    "max": 151,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "preserving_ext2_27",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "brewing_ext_25",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_179",
  "name": "精酿坊",
  "reqLevel": 90,
  "intervalSec": 7.5,
  "xp": 437,
  "baseSuccess": 0.62,
  "failGold": 128,
  "loot": [
   {
    "type": "gold",
    "min": 51,
    "max": 154,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "fishing_ext2_27",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "yieldTonic5",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "baking_ext2_26",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_180",
  "name": "乳香阁",
  "reqLevel": 90,
  "intervalSec": 7.5,
  "xp": 437,
  "baseSuccess": 0.62,
  "failGold": 128,
  "loot": [
   {
    "type": "gold",
    "min": 51,
    "max": 154,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "fishing_ext2_27",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "brewing_ext2_27",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_181",
  "name": "御香斋",
  "reqLevel": 91,
  "intervalSec": 7.6,
  "xp": 442,
  "baseSuccess": 0.62,
  "failGold": 129,
  "loot": [
   {
    "type": "gold",
    "min": 52,
    "max": 155,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "fishing_ext2_28",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cooking_ext2_28",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "wildDish_55",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_182",
  "name": "白切鸡铺",
  "reqLevel": 91,
  "intervalSec": 7.6,
  "xp": 442,
  "baseSuccess": 0.62,
  "failGold": 129,
  "loot": [
   {
    "type": "gold",
    "min": 52,
    "max": 155,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "hunting_ext_28",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "baking_ext_29",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_183",
  "name": "御点斋",
  "reqLevel": 92,
  "intervalSec": 7.6,
  "xp": 446,
  "baseSuccess": 0.62,
  "failGold": 130,
  "loot": [
   {
    "type": "gold",
    "min": 52,
    "max": 156,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "preserving_ext2_27",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cookDown_41",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "preservTier5",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_184",
  "name": "清吧",
  "reqLevel": 92,
  "intervalSec": 7.6,
  "xp": 446,
  "baseSuccess": 0.62,
  "failGold": 130,
  "loot": [
   {
    "type": "gold",
    "min": 52,
    "max": 156,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "spiceMixing_ext2_28",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "brewing_ext2_27",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_185",
  "name": "奶香御膳",
  "reqLevel": 93,
  "intervalSec": 7.7,
  "xp": 451,
  "baseSuccess": 0.62,
  "failGold": 132,
  "loot": [
   {
    "type": "gold",
    "min": 53,
    "max": 158,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "excavation_ext2_28",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "wildDish_25",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "porcupineBraised",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_186",
  "name": "路边摊",
  "reqLevel": 93,
  "intervalSec": 7.7,
  "xp": 451,
  "baseSuccess": 0.62,
  "failGold": 132,
  "loot": [
   {
    "type": "gold",
    "min": 53,
    "max": 158,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "fishing_ext_27",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "brewing_ext_27",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_187",
  "name": "菜园坊",
  "reqLevel": 94,
  "intervalSec": 7.7,
  "xp": 456,
  "baseSuccess": 0.61,
  "failGold": 133,
  "loot": [
   {
    "type": "gold",
    "min": 53,
    "max": 160,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "foraging_ext_28",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cookDown_41",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "dragonBreathWine",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_188",
  "name": "转角茶摊",
  "reqLevel": 94,
  "intervalSec": 7.7,
  "xp": 456,
  "baseSuccess": 0.61,
  "failGold": 133,
  "loot": [
   {
    "type": "gold",
    "min": 53,
    "max": 160,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "spiceMixing_ext_29",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "broccoliGarlic",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_189",
  "name": "巷口面馆",
  "reqLevel": 95,
  "intervalSec": 7.8,
  "xp": 461,
  "baseSuccess": 0.61,
  "failGold": 134,
  "loot": [
   {
    "type": "gold",
    "min": 54,
    "max": 161,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "preserving_ext_29",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "brewing_ext_27",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "baking_ext_30",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_190",
  "name": "烤串摊",
  "reqLevel": 95,
  "intervalSec": 7.8,
  "xp": 461,
  "baseSuccess": 0.61,
  "failGold": 134,
  "loot": [
   {
    "type": "gold",
    "min": 54,
    "max": 161,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "hunting_ext2_29",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cooking_ext_27",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_191",
  "name": "街头小贩",
  "reqLevel": 96,
  "intervalSec": 7.8,
  "xp": 466,
  "baseSuccess": 0.61,
  "failGold": 136,
  "loot": [
   {
    "type": "gold",
    "min": 54,
    "max": 163,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "foraging_ext_29",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "blackFishSoup",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "cooking_ext_27",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_192",
  "name": "街角食堂",
  "reqLevel": 96,
  "intervalSec": 7.8,
  "xp": 466,
  "baseSuccess": 0.61,
  "failGold": 136,
  "loot": [
   {
    "type": "gold",
    "min": 54,
    "max": 163,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "foraging_ext_29",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "wildDish_55",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_193",
  "name": "糖水摊",
  "reqLevel": 97,
  "intervalSec": 7.9,
  "xp": 470,
  "baseSuccess": 0.61,
  "failGold": 137,
  "loot": [
   {
    "type": "gold",
    "min": 55,
    "max": 164,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "foraging_ext2_29",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cooking_ext_28",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "baking_ext_28",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_194",
  "name": "面点铺",
  "reqLevel": 97,
  "intervalSec": 7.9,
  "xp": 470,
  "baseSuccess": 0.61,
  "failGold": 137,
  "loot": [
   {
    "type": "gold",
    "min": 55,
    "max": 164,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "spiceMixing_ext_29",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "lettuceOyster",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_195",
  "name": "烤肉店",
  "reqLevel": 98,
  "intervalSec": 7.9,
  "xp": 475,
  "baseSuccess": 0.6,
  "failGold": 139,
  "loot": [
   {
    "type": "gold",
    "min": 56,
    "max": 167,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "hunting_ext2_29",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cooking_ext_30",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "capybaraStew",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_196",
  "name": "干货铺",
  "reqLevel": 98,
  "intervalSec": 7.9,
  "xp": 475,
  "baseSuccess": 0.6,
  "failGold": 139,
  "loot": [
   {
    "type": "gold",
    "min": 56,
    "max": 167,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "hunting_ext_30",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "wildDish_27",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_197",
  "name": "奶摊",
  "reqLevel": 99,
  "intervalSec": 8,
  "xp": 480,
  "baseSuccess": 0.6,
  "failGold": 140,
  "loot": [
   {
    "type": "gold",
    "min": 56,
    "max": 168,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "excavation_ext2_30",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "swimCrabStir",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "cooking_ext2_29",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_198",
  "name": "面食坊",
  "reqLevel": 99,
  "intervalSec": 8,
  "xp": 480,
  "baseSuccess": 0.6,
  "failGold": 140,
  "loot": [
   {
    "type": "gold",
    "min": 56,
    "max": 168,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "hunting_ext2_30",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "cookDown_35",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_199",
  "name": "糕饼摊",
  "reqLevel": 99,
  "intervalSec": 8,
  "xp": 480,
  "baseSuccess": 0.6,
  "failGold": 140,
  "loot": [
   {
    "type": "gold",
    "min": 56,
    "max": 168,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "fishing_ext_30",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "brewing_ext2_29",
    "min": 1,
    "max": 1,
    "chance": 0.28
   },
   {
    "type": "item",
    "itemId": "cooking_ext2_28",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 },
 {
  "id": "explore_200",
  "name": "奶铺",
  "reqLevel": 99,
  "intervalSec": 8,
  "xp": 480,
  "baseSuccess": 0.6,
  "failGold": 140,
  "loot": [
   {
    "type": "gold",
    "min": 56,
    "max": 168,
    "chance": 0.7
   },
   {
    "type": "item",
    "itemId": "preserving_ext_30",
    "min": 1,
    "max": 2,
    "chance": 0.35
   },
   {
    "type": "item",
    "itemId": "oliveWine",
    "min": 1,
    "max": 1,
    "chance": 0.28
   }
  ]
 }
]
