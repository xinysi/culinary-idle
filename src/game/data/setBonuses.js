// 锻造套装收集奖励 — 集齐一套（8-9 槽）→ 一次性金币+神秘调料（2026-09-06）
// 组识别：装备 id 前缀 smith_{材质}_ / inip{宝石}_（与生成器命名一致，纯读取 ITEMS，不修改数据）。
import { ITEMS } from './items.js'

const SLOT_SUFFIXES = ['厨师帽', '调味瓶', '砧板', '围裙', '护符', '戒指', '腿甲', '靴子', '头盔', '项链', '坠子', '耳环', '手镯', '宝箱', '杖', '盾', '刀', '锅', '环', '链', '衣', '帽', '裤', '甲', '履', '锏', '釜', '匣', '铠']

/** 套装名：取套内装备名并剥掉槽位后缀（动态，无硬编码映射） */
function keyToName(key, ids) {
  const name = ITEMS[ids[0]]?.name ?? key
  for (const s of SLOT_SUFFIXES) {
    if (name.endsWith(s)) return name.slice(0, -s.length) + '套装'
  }
  return name + '套装'
}

/** 可收集的锻造套装列表（含各套装装备 id；模块加载时静态计算一次） */
export const COLLECTABLE_SETS = (() => {
  const groups = new Map()
  for (const [id, it] of Object.entries(ITEMS)) {
    if (it.type !== 'equipment' || !it.slot) continue
    const m = id.match(/^(smith_[^_]+|inip[A-Za-z]+)_/)
    if (!m) continue
    const key = m[1]
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(id)
  }
  return [...groups.entries()].map(([key, ids]) => {
    const sorted = ids.sort((a, b) => a.localeCompare(b))
    return { key, name: keyToName(key, sorted), ids: sorted }
  })
})()

/** 每套集齐的奖励：金币 = 件数 × 200 + 神秘调料 ×1 */
export function setBonusReward(set) {
  return { gold: set.ids.length * 200, items: { mysterySpice: 1 } }
}
