// 杂货铺商品 — 提供狩猎弹药（陷阱）与农耕种子，作为初期金币消耗口（§11.3）

import { ITEMS } from './items.js'
import { SHOP_SEED_ENTRIES } from './farmSeeds.js'

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
  // 扩展服务（§5.4：背包 20→100，仓库 100→500）
  { action: 'inventorySlot', price: 200, desc: '背包 +10 格（上限 100）' },
  { action: 'bankSlot', price: 150, desc: '仓库 +20 格（上限 500）' },
]

// 农耕种子扩充（生成器 gen_farm_seeds.mjs 产出，勿手改）：所有可采集/可挖掘非矿物食材的种子
SHOP_ITEMS.push(...SHOP_SEED_ENTRIES)

export function shopItemName(itemId) {
  return ITEMS[itemId]?.name ?? itemId
}
