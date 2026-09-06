// 物品用途：该物品作为材料出现在哪些配方中（图鉴/背包详情「可用于制作」）
// 使用技能实例的 recipes（含基础 + 扩展配方），与游戏内制作一致
import { getAllSkillInstances } from '../skills/registry.js'
import { ALCHEMY_RECIPES } from './alchemy.js'
import { getItem } from './items.js'

/** 返回该物品可制作成的产物列表：[{ outputId, name, qty }]（按配方合并去重） */
export function itemUses(itemId) {
  const map = new Map()
  const add = (outId, name, qty) => {
    if (!outId) return
    const cur = map.get(outId)
    if (cur) cur.qty = Math.max(cur.qty, qty)
    else map.set(outId, { outputId: outId, name: getItem(outId)?.name ?? name, qty })
  }
  for (const inst of getAllSkillInstances()) {
    for (const r of inst.recipes ?? []) {
      const qty = r.ingredients?.[itemId]
      if (!qty) continue
      add(r.output?.itemId ?? r.itemId, r.name, qty)
    }
  }
  for (const a of ALCHEMY_RECIPES) {
    const qty = a.in?.[itemId]
    if (!qty) continue
    if (!getItem(a.out)) continue // 幽灵产物（炼金表引用不存在物品）：不在图鉴展示
    add(a.out, a.name, qty)
  }
  return [...map.values()]
}
