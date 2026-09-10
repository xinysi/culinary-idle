// 厨具锻造同名矿（生成器产出，勿手改）— 2026-08-30
// 覆盖：钢→鎏金（段4-16，等级16-80）各套同名矿的物品 + 挖掘目标。改后重跑 scripts/gen/gen_smith_ores.mjs。
export const SMITH_ORES = {
 "steelOre": {
  "id": "steelOre",
  "name": "钢矿",
  "type": "ingredient",
  "category": "mineral",
  "tier": 2,
  "value": 38,
  "stackable": true,
  "maxStack": 9999
 },
 "silverOre": {
  "id": "silverOre",
  "name": "银矿",
  "type": "ingredient",
  "category": "mineral",
  "tier": 3,
  "value": 46,
  "stackable": true,
  "maxStack": 9999
 },
 "mithrilOre": {
  "id": "mithrilOre",
  "name": "秘银矿",
  "type": "ingredient",
  "category": "mineral",
  "tier": 3,
  "value": 54,
  "stackable": true,
  "maxStack": 9999
 },
 "goldOre": {
  "id": "goldOre",
  "name": "金矿",
  "type": "ingredient",
  "category": "mineral",
  "tier": 4,
  "value": 62,
  "stackable": true,
  "maxStack": 9999
 },
 "adamantOre": {
  "id": "adamantOre",
  "name": "精金矿",
  "type": "ingredient",
  "category": "mineral",
  "tier": 4,
  "value": 70,
  "stackable": true,
  "maxStack": 9999
 },
 "crystalOre": {
  "id": "crystalOre",
  "name": "水晶矿",
  "type": "ingredient",
  "category": "mineral",
  "tier": 5,
  "value": 78,
  "stackable": true,
  "maxStack": 9999
 },
 "darkIronOre": {
  "id": "darkIronOre",
  "name": "玄铁矿",
  "type": "ingredient",
  "category": "mineral",
  "tier": 5,
  "value": 86,
  "stackable": true,
  "maxStack": 9999
 },
 "coldIronOre": {
  "id": "coldIronOre",
  "name": "寒铁矿",
  "type": "ingredient",
  "category": "mineral",
  "tier": 6,
  "value": 94,
  "stackable": true,
  "maxStack": 9999
 },
 "meteoriteOre": {
  "id": "meteoriteOre",
  "name": "陨铁矿",
  "type": "ingredient",
  "category": "mineral",
  "tier": 6,
  "value": 102,
  "stackable": true,
  "maxStack": 9999
 },
 "starOre": {
  "id": "starOre",
  "name": "星辰矿",
  "type": "ingredient",
  "category": "mineral",
  "tier": 7,
  "value": 110,
  "stackable": true,
  "maxStack": 9999
 },
 "dragonScaleOre": {
  "id": "dragonScaleOre",
  "name": "龙鳞矿",
  "type": "ingredient",
  "category": "mineral",
  "tier": 7,
  "value": 118,
  "stackable": true,
  "maxStack": 9999
 },
 "glassOre": {
  "id": "glassOre",
  "name": "琉璃矿",
  "type": "ingredient",
  "category": "mineral",
  "tier": 8,
  "value": 126,
  "stackable": true,
  "maxStack": 9999
 },
 "giltOre": {
  "id": "giltOre",
  "name": "鎏金矿",
  "type": "ingredient",
  "category": "mineral",
  "tier": 8,
  "value": 134,
  "stackable": true,
  "maxStack": 9999
 }
}
export const SMITH_ORE_TARGETS = [
 {
  "itemId": "steelOre",
  "reqLevel": 16,
  "xpPerAction": 90,
  "intervalSec": 3.6
 },
 {
  "itemId": "silverOre",
  "reqLevel": 21,
  "xpPerAction": 115,
  "intervalSec": 3.8
 },
 {
  "itemId": "mithrilOre",
  "reqLevel": 26,
  "xpPerAction": 140,
  "intervalSec": 4
 },
 {
  "itemId": "goldOre",
  "reqLevel": 31,
  "xpPerAction": 165,
  "intervalSec": 4.2
 },
 {
  "itemId": "adamantOre",
  "reqLevel": 36,
  "xpPerAction": 190,
  "intervalSec": 4.4
 },
 {
  "itemId": "crystalOre",
  "reqLevel": 41,
  "xpPerAction": 215,
  "intervalSec": 4.6
 },
 {
  "itemId": "darkIronOre",
  "reqLevel": 46,
  "xpPerAction": 240,
  "intervalSec": 4.8
 },
 {
  "itemId": "coldIronOre",
  "reqLevel": 51,
  "xpPerAction": 265,
  "intervalSec": 5
 },
 {
  "itemId": "meteoriteOre",
  "reqLevel": 56,
  "xpPerAction": 290,
  "intervalSec": 5.2
 },
 {
  "itemId": "starOre",
  "reqLevel": 61,
  "xpPerAction": 315,
  "intervalSec": 5.4
 },
 {
  "itemId": "dragonScaleOre",
  "reqLevel": 66,
  "xpPerAction": 340,
  "intervalSec": 5.6
 },
 {
  "itemId": "glassOre",
  "reqLevel": 71,
  "xpPerAction": 365,
  "intervalSec": 5.8
 },
 {
  "itemId": "giltOre",
  "reqLevel": 76,
  "xpPerAction": 390,
  "intervalSec": 6
 }
]
