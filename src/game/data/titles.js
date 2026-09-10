// 称号注册表（2026-09-09）：图鉴「称号」页统一展示与佩戴
// 来源一：成就解锁的称号（ALL_ACHIEVEMENTS 中带 title 的项）
// 来源二：游戏商店购买的外观称号（与 GameShopView 的 title/title2..title7 一一对应）
// 来源三：图鉴兑换所兑换的限定称号（2026-09-10，key 对应 player.codexOwned）
import { ALL_ACHIEVEMENTS } from './achievements.js'
import { CODEX_TITLES } from './codexShop.js'

/** 成就称号：{ id, name, desc, achName } */
export const ACHIEVEMENT_TITLES = ALL_ACHIEVEMENTS.filter((a) => a.title).map((a) => ({
  id: a.id,
  name: a.title,
  desc: a.desc,
  achName: a.name,
}))

/** 商店称号：{ key, name, price, icon }（key 对应 player.shopOwned[key]） */
export const SHOP_TITLES = [
  { key: 'title', name: '大胃王', price: 10000, icon: '👑' },
  { key: 'title4', name: '火候大师', price: 11000, icon: '🔥' },
  { key: 'title2', name: '御膳食神', price: 12000, icon: '👑' },
  { key: 'title5', name: '刀工宗师', price: 13000, icon: '🔪' },
  { key: 'title3', name: '千杯不醉', price: 15000, icon: '🏅' },
  { key: 'title6', name: '食灵之主', price: 16000, icon: '👻' },
  { key: 'title7', name: '满汉全席', price: 18000, icon: '🍲' },
]

/** 图鉴兑换所称号：{ key, name, desc }（key 对应 player.codexOwned 的记录 id） */
export const CODEX_SHOP_TITLES = CODEX_TITLES.map((t) => ({ key: t.id, name: t.name, desc: t.desc }))

/** 全部称号名（供校验/展示） */
export function allTitleNames() {
  return [
    ...ACHIEVEMENT_TITLES.map((t) => t.name),
    ...SHOP_TITLES.map((t) => t.name),
    ...CODEX_SHOP_TITLES.map((t) => t.name),
  ]
}
