// 风味搭配反查（2026-09-10 补）— 某条「食材组合」能在哪些配方里一次做出来。
// 只读既有配方表（技能实例 + 炼金），不新增/修改任何配方；结果按 reqLevel 升序，供玩家挑最容易的一条去点亮。
import { getAllSkillInstances } from '../skills/registry.js'
import { ALCHEMY_RECIPES } from './alchemy.js'
import { SKILL_DEFS } from './skills.js'
import { getItem } from './items.js'

const cache = new Map()

/** 该配方是否同时用到全部 itemIds（材料表里每个都出现至少 1 次） */
function usesAll(ingredients, itemIds) {
  for (const id of itemIds) if (!ingredients?.[id]) return false
  return true
}

/**
 * 能一次做齐该组合的配方列表：[{ skillId, skillName, name, reqLevel, outputId, outputName, qty }]
 * qty = 该组合主料（第一个 item）在该配方里的用量
 */
export function recipesForPair(itemIds) {
  if (!Array.isArray(itemIds) || !itemIds.length) return []
  const key = itemIds.join('|')
  if (cache.has(key)) return cache.get(key)
  const out = []
  for (const inst of getAllSkillInstances()) {
    for (const r of inst.recipes ?? []) {
      if (!usesAll(r.ingredients, itemIds)) continue
      const outputId = r.output?.itemId ?? r.itemId
      out.push({
        skillId: inst.id,
        skillName: SKILL_DEFS[inst.id]?.name ?? inst.id,
        name: r.name,
        reqLevel: r.reqLevel ?? 1,
        outputId,
        outputName: getItem(outputId)?.name ?? r.name,
        qty: r.ingredients?.[itemIds[0]] ?? 1,
      })
    }
  }
  for (const a of ALCHEMY_RECIPES) {
    if (!getItem(a.out)) continue // 幽灵产物不在图鉴展示
    if (!usesAll(a.in, itemIds)) continue
    out.push({
      skillId: 'alchemy',
      skillName: '炼金',
      name: a.name ?? getItem(a.out)?.name ?? a.out,
      reqLevel: a.reqLevel ?? 1,
      outputId: a.out,
      outputName: getItem(a.out)?.name ?? a.out,
      qty: a.in?.[itemIds[0]] ?? 1,
    })
  }
  out.sort((a, b) => (a.reqLevel ?? 0) - (b.reqLevel ?? 0) || String(a.name).localeCompare(String(b.name), 'zh'))
  cache.set(key, out)
  return out
}

/** 最容易做的一条（等级最低），无则 null */
export function easiestRecipeForPair(itemIds) {
  return recipesForPair(itemIds)[0] ?? null
}
