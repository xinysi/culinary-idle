// 名厨挑战（2026-09-10 新增）— 每周一位「名厨」（按周确定性轮换），固定流派、等级随玩家上浮；
// 战胜即通过（每周一次），通过给金币 + 调料 + 专属称号。与竞技场（镜像 PVP）、试炼（限制条件）互补。
// 设计约束：对手由 opp() 动态生成（与试炼塔/秘境同模式），不触碰 COMBAT_REGIONS/BOSS 铁律数据。
import { opp } from './combat.js'

/** 名厨名单（固定流派，各有一句战前宣言） */
export const CHEFS = [
  { id: 'c_blade', name: '鬼刃厨神', icon: '🔪', style: 'knife', levelOffset: 4, say: '刀要快，火要稳——先学会敬畏食材。' },
  { id: 'c_plate', name: '摆盘宗师', icon: '🎨', style: 'plating', levelOffset: 4, say: '你会先尝到颜色，再尝到味道。' },
  { id: 'c_flavor', name: '调味圣手', icon: '🧂', style: 'flavor', levelOffset: 5, say: '盐多一粒则死，少一粒则寡。' },
  { id: 'c_soup', name: '汤王', icon: '🍲', style: 'flavor', levelOffset: 6, say: '我的汤，熬了三十年。' },
  { id: 'c_sweet', name: '甜品皇后', icon: '🍰', style: 'plating', levelOffset: 6, say: '甜，是最诚实的味道。' },
  { id: 'c_flame', name: '烈焰厨魔', icon: '🔥', style: 'knife', levelOffset: 7, say: '让火焰替我说完剩下的话。' },
  { id: 'c_bamboo', name: '素食禅厨', icon: '🎋', style: 'plating', levelOffset: 7, say: '一菜一世界，不必杀生。' },
  { id: 'c_final', name: '无名食神', icon: '👑', style: 'knife', levelOffset: 9, say: '名字不重要——吃过就记得。' },  { id: 'c_ferment', name: '腌酿隐士', icon: '🫙', style: 'flavor', levelOffset: 8, say: '时间才是最好的调味料。' },
  { id: 'c_noodle', name: '面案快手', icon: '🍜', style: 'knife', levelOffset: 5, say: '一根面，能拉出八种脾气。' },

]

const CHEF_INDEX = new Map(CHEFS.map((c) => [c.id, c]))

export function getChef(id) {
  return CHEF_INDEX.get(id) ?? null
}

/** 本周名厨（按 epoch 周确定性轮换） */
export function chefForWeek(weekNum = Math.floor(Date.now() / (7 * 24 * 3600_000))) {
  return CHEFS[((weekNum % CHEFS.length) + CHEFS.length) % CHEFS.length]
}

/** 名厨对手（opp() 动态生成，等级封顶 99） */
export function chefOpponent(def, combatLevel, rng = Math.random) {
  const lv = Math.max(1, Math.min(99, Math.max(1, combatLevel) + (def?.levelOffset ?? 4)))
  const o = opp(lv, `${def.icon} ${def.name}`, def.style, { drops: [{ itemId: 'mysterySpice', chance: 0.25 }] })
  o.isChef = true
  o.chefId = def.id
  return o
}

/** 通过奖励（每周一次） */
export function chefReward(def, combatLevel = 1) {
  const lv = Math.max(1, combatLevel)
  return { gold: 12000 + lv * 260, items: { mysterySpice: 2, energyBiscuit: 1 } }
}
