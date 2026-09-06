// 物品导航入口（2026-09-06）— 配方树「去做」用：找某物品的最优获取方式（采集/农耕/商店/制作）
import { FORAGING_TARGETS } from '../skills/ForagingSkill.js'
import { FISHING_TARGETS } from '../skills/FishingSkill.js'
import { HUNTING_TARGETS } from '../skills/HuntingSkill.js'
import { EXCAVATION_TARGETS } from '../skills/ExcavationSkill.js'
import { CROPS } from '../skills/FarmingSkill.js'
import { SHOP_ITEMS } from './shop.js'

const GATHER_TABLES = [
  ['foraging', FORAGING_TARGETS, '采集'],
  ['fishing', FISHING_TARGETS, '垂钓'],
  ['hunting', HUNTING_TARGETS, '狩猎'],
  ['excavation', EXCAVATION_TARGETS, '挖掘'],
]

/** 某物品可跳转的获取入口列表（采集 > 农耕 > 商店 > 制作在各节点单独处理） */
export function itemNavs(itemId) {
  const navs = []
  for (const [skillId, table, label] of GATHER_TABLES) {
    const t = table.find((x) => x.itemId === itemId)
    if (t) navs.push({ type: 'gather', skillId, targetId: itemId, label })
  }
  const crop = CROPS.find((c) => c.itemId === itemId)
  if (crop) navs.push({ type: 'farming', targetId: itemId, label: `农耕种植（Lv${crop.reqLevel}）` })
  if (SHOP_ITEMS.some((i) => i.itemId === itemId)) navs.push({ type: 'shop', targetId: itemId, label: '商店购买' })
  return navs
}

/** 按钮文案 */
export function navText(nav) {
  switch (nav.type) {
    case 'gather':
      return { foraging: '去采集', fishing: '去垂钓', hunting: '去狩猎', excavation: '去挖掘' }[nav.skillId] ?? '去采集'
    case 'farming': return '去种植'
    case 'shop': return '去商店'
    case 'craft': return '去做'
    default: return ''
  }
}
