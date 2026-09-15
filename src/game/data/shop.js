// 杂货铺商品 — 提供狩猎弹药（陷阱）与农耕种子，作为初期金币消耗口（§11.3）

import { ITEMS } from './items.js'
import { SHOP_SEED_ENTRIES } from './farmSeeds.js'
import { PAID_CAP_MAX } from './caps.js'

export const SHOP_ITEMS = [
  // 狩猎弹药 / 摆盘弹药
  { itemId: 'trap', price: 5, desc: '狩猎消耗品，每次狩猎消耗 1 个' },
  { itemId: 'garnish', price: 5, desc: '摆盘流弹药（对决），每次攻击消耗 1 个' },
  // 调酒原料
  { itemId: 'water', price: 2, desc: '调酒原料' },
  { itemId: 'yeast', price: 20, desc: '酿酒原料（酒类饮品）' },
  // 农耕肥料
  { itemId: 'compost', price: 15, desc: '施肥后枯萎概率 3%→1%' },
  { itemId: 'richCompost', price: 60, desc: '施肥后枯萎概率降为 0，且收获 +1' },
  // 农耕种子（价格 ≈ 单轮产值 0.85-0.95 倍，直接出售微赚/保本，制作链增值）
  { itemId: 'wheatSeed', price: 5 },
  { itemId: 'riceSeed', price: 10 },
  { itemId: 'cornSeed', price: 15 },
  { itemId: 'cabbageSeed', price: 20 },
  { itemId: 'chiliSeed', price: 25 },
  { itemId: 'eggplantSeed', price: 35 },
  { itemId: 'pumpkinSeed', price: 50 },
  { itemId: 'peppercornSeed', price: 60 },
  { itemId: 'starAniseSeed', price: 80 },
  { itemId: 'cassiaSeed', price: 100 },
  { itemId: 'vanillaSeed', price: 130 },
  { itemId: 'basilSeed', price: 155 },
  { itemId: 'rosemarySeed', price: 195 },
  { itemId: 'saffronSeed', price: 285 },
  { itemId: 'dragonPepperSeed', price: 400 },
]

// ⚠️ 「容量/扩建」类条目（背包/仓库/冷库 + 各产线设施 + 农具 + 自动化）**不在商品列表里**，
// 统一登记在 `src/game/data/expansions.js`，由商店的「容量扩展」页签渲染成总览面板
// （2026-09-15 v2.4.2：用户要求把农耕升级与各功能扩建统一到商店的容量扩展分类）。
// 商品列表只保留**真物品**（弹药原料/肥料/种子），避免同一件事两处入口、两套价格。

// 农耕种子扩充（生成器 gen_farm_seeds.mjs 产出，勿手改）：所有可采集/可挖掘非矿物食材的种子
SHOP_ITEMS.push(...SHOP_SEED_ENTRIES)

export function shopItemName(itemId) {
  return ITEMS[itemId]?.name ?? itemId
}
