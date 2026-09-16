// 物品用途：该物品作为材料出现在哪些配方中（图鉴/背包详情「可用于制作」）
// 使用技能实例的 recipes（含基础 + 扩展配方），与游戏内制作一致
import { getAllSkillInstances } from '../skills/registry.js'
import { ALCHEMY_RECIPES } from './alchemy.js'
import { CRAFTED_DECOR } from './woodworking.js'
import { sidelineWorkOf, SIDELINE_AXES } from './sidelineWorks.js'
import { getItem } from './items.js'

/** 返回该物品可制作成的产物列表：[{ outputId, name, qty, kind? }]（按配方合并去重）
 *  `kind: 'decor'` 表示产物是**装潢**而非物品（木器 → 手工装潢）；
 *  `kind: 'work'` 表示产物是**副业作品**（陶器/织物/绣品/蜡烛 → 各自的一条经营侧加成）。
 *  两者都不是配方材料，若不登记这里，图鉴的「可用于制作」就会对它们留空（玩家看不到产物有什么用）。
 *  注意：这两类 outputId 都不是物品 id，调用方（ItemDetailModal / 审计）不能拿它当物品 id 去查。 */
export function itemUses(itemId) {
  const map = new Map()
  const add = (outId, name, qty, kind) => {
    if (!outId) return
    const cur = map.get(outId)
    if (cur) cur.qty = Math.max(cur.qty, qty)
    else map.set(outId, { outputId: outId, name: getItem(outId)?.name ?? name, qty, kind })
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
  for (const d of CRAFTED_DECOR) {
    if (d.craftedFrom?.itemId !== itemId) continue
    add(d.id, d.name, d.craftedFrom.qty, 'decor')
  }
  // 副业四支的作品（v2.10.0）：陶器/织物/绣品/蜡烛也不是配方材料，去处是「做成作品」换一条经营侧加成。
  // 同样不能当物品跳转（没有物品详情页），故也带 kind。
  const work = sidelineWorkOf(itemId)
  if (work) {
    const ax = SIDELINE_AXES[work.axis]
    add(`work:${itemId}`, `${work.skillName}作品（${ax.label} ${ax.amountLabel(work.amount)}）`, 1, 'work')
  }
  return [...map.values()]
}
