// 公会系统 — 需求文档 §13（可选扩展）
// 20 家公会：初始 3 家无加入要求；其余 17 家按类型要求（战斗=对决等级、采集=采集总等级、
// 制作=制作总等级、辅助=辅助总等级）+ 金币，需求与 增益 逐级递增。
// 加入公会获得被动加成 + 公会任务（每日重置、可重复）+ 公会商店（公会点数）

// 任务工厂：每家 3 个每日任务（kind 与主线一致：gather/craft/harvest/combatWin/boss/explore/skill/craftEquip）
function mkTasks(prefix, defs) {
  return defs.map(([name, kind, param, qty, points], i) => ({
    id: `${prefix}_${i + 1}`, name, kind, param, qty, reward: { points, gold: 200 + i * 100 },
  }))
}
const TASKS = {
  combat: (id) => mkTasks(id, [
    ['收集木材 ×50', 'gather', 'wood', 50, 10],
    ['锻造装备 ×5（任意）', 'craftEquip', 'any', 5, 15],
    ['对决胜利 ×10', 'combatWin', 'any', 10, 20],
    ['击败首领 ×3', 'boss', 'any', 3, 25],
    ['探索成功 ×15', 'explore', 'any', 15, 30],
  ]),
  gather: (id) => mkTasks(id, [
    ['采集任意食材 ×200', 'gather', 'any', 200, 10],
    ['垂钓成功 ×40', 'skill', 'fishing', 40, 15],
    ['收获作物 ×30', 'harvest', 'any', 30, 20],
    ['对决胜利 ×5', 'combatWin', 'any', 5, 25],
    ['制作料理 ×20（任意）', 'craft', 'any', 20, 30],
  ]),
  craft: (id) => mkTasks(id, [
    ['制作料理 ×30（任意）', 'craft', 'any', 30, 10],
    ['烘焙 ×15', 'skill', 'baking', 15, 15],
    ['锻造 ×10', 'skill', 'craftsmithing', 10, 20],
    ['对决胜利 ×5', 'combatWin', 'any', 5, 25],
    ['击败首领 ×2', 'boss', 'any', 2, 30],
  ]),
  support: (id) => mkTasks(id, [
    ['探索成功 ×20', 'explore', 'any', 20, 10],
    ['对决胜利 ×15', 'combatWin', 'any', 15, 15],
    ['食材保鲜 ×10', 'skill', 'preservation', 10, 20],
    ['采集任意食材 ×100', 'gather', 'any', 100, 25],
    ['制作料理 ×20（任意）', 'craft', 'any', 20, 30],
  ]),
}

export const GUILDS = [
  // ── 初始 3 家：无加入要求（500 金币加入）──
  { id: 'flame', name: '炽焰厨师团', type: '战斗', desc: '战斗型公会：对决伤害 +5%', passive: { dmgPct: 5 }, tasks: TASKS.combat('flame') },
  { id: 'umami', name: '鲜味联盟', type: '采集', desc: '采集型公会：采集产量 +5%', passive: { yieldPct: 5 }, tasks: TASKS.gather('umami') },
  { id: 'dessert', name: '甜点师公会', type: '制作', desc: '制作型公会：制作成功率 +5%', passive: { craftPct: 5 }, tasks: TASKS.craft('dessert') },

  // ── 战斗型 ×5：对决等级 + 金币，伤害 增益 递增 ──
  { id: 'battleAxe', name: '战斧食营', type: '战斗', desc: '战斗型公会：对决伤害 +6%', passive: { dmgPct: 6 }, requirements: { combatLevel: 15, gold: 800 }, tasks: TASKS.combat('battleAxe') },
  { id: 'ironPot', name: '铁锅军团', type: '战斗', desc: '战斗型公会：对决伤害 +7%', passive: { dmgPct: 7 }, requirements: { combatLevel: 25, gold: 1500 }, tasks: TASKS.combat('ironPot') },
  { id: 'flameKnight', name: '烈焰骑士团', type: '战斗', desc: '战斗型公会：对决伤害 +8%', passive: { dmgPct: 8 }, requirements: { combatLevel: 35, gold: 3000 }, tasks: TASKS.combat('flameKnight') },
  { id: 'chefGuard', name: '厨神护卫队', type: '战斗', desc: '战斗型公会：对决伤害 +9%', passive: { dmgPct: 9 }, requirements: { combatLevel: 45, gold: 6000 }, tasks: TASKS.combat('chefGuard') },
  { id: 'duelArena', name: '料理斗士盟', type: '战斗', desc: '战斗型公会：对决伤害 +10%', passive: { dmgPct: 10 }, requirements: { combatLevel: 55, gold: 12000 }, tasks: TASKS.combat('duelArena') },

  // ── 采集型 ×4：采集总等级 + 金币，产量 增益 递增 ──
  { id: 'harvestField', name: '丰收麦田', type: '采集', desc: '采集型公会：采集产量 +6%', passive: { yieldPct: 6 }, requirements: { gatherLevel: 50, gold: 800 }, tasks: TASKS.gather('harvestField') },
  { id: 'blueSea', name: '碧海渔村', type: '采集', desc: '采集型公会：采集产量 +7%', passive: { yieldPct: 7 }, requirements: { gatherLevel: 90, gold: 1500 }, tasks: TASKS.gather('blueSea') },
  { id: 'forestTeam', name: '森语采集队', type: '采集', desc: '采集型公会：采集产量 +8%', passive: { yieldPct: 8 }, requirements: { gatherLevel: 140, gold: 3000 }, tasks: TASKS.gather('forestTeam') },
  { id: 'veinCorps', name: '矿脉开拓团', type: '采集', desc: '采集型公会：采集产量 +9%', passive: { yieldPct: 9 }, requirements: { gatherLevel: 200, gold: 6000 }, tasks: TASKS.gather('veinCorps') },

  // ── 制作型 ×4：制作总等级 + 金币，成功率 增益 递增 ──
  { id: 'millerGuild', name: '百味磨坊', type: '制作', desc: '制作型公会：制作成功率 +6%', passive: { craftPct: 6 }, requirements: { craftLevel: 50, gold: 800 }, tasks: TASKS.craft('millerGuild') },
  { id: 'brewSociety', name: '酿造师学会', type: '制作', desc: '制作型公会：制作成功率 +7%', passive: { craftPct: 7 }, requirements: { craftLevel: 90, gold: 1500 }, tasks: TASKS.craft('brewSociety') },
  { id: 'forgeUnion', name: '锻造工联', type: '制作', desc: '制作型公会：制作成功率 +8%', passive: { craftPct: 8 }, requirements: { craftLevel: 140, gold: 3000 }, tasks: TASKS.craft('forgeUnion') },
  { id: 'royalChef', name: '御厨司', type: '制作', desc: '制作型公会：制作成功率 +9%', passive: { craftPct: 9 }, requirements: { craftLevel: 200, gold: 6000 }, tasks: TASKS.craft('royalChef') },

  // ── 辅助型 ×4：辅助总等级 + 金币，经验 增益 递增 ──
  { id: 'herbalist', name: '本草居', type: '辅助', desc: '辅助型公会：全技能经验 +6%', passive: { xpPct: 6 }, requirements: { supportLevel: 30, gold: 800 }, tasks: TASKS.support('herbalist') },
  { id: 'explorerClub', name: '冒险食客会', type: '辅助', desc: '辅助型公会：全技能经验 +7%', passive: { xpPct: 7 }, requirements: { supportLevel: 60, gold: 1500 }, tasks: TASKS.support('explorerClub') },
  { id: 'spiritCoven', name: '食灵结社', type: '辅助', desc: '辅助型公会：全技能经验 +8%', passive: { xpPct: 8 }, requirements: { supportLevel: 100, gold: 3000 }, tasks: TASKS.support('spiritCoven') },
  { id: 'sageKitchen', name: '贤者膳房', type: '辅助', desc: '辅助型公会：全技能经验 +9%', passive: { xpPct: 9 }, requirements: { supportLevel: 150, gold: 6000 }, tasks: TASKS.support('sageKitchen') },
]

// 公会商店：商品（公会点数兑换）—— 按物品 value 曲线定价（点数≈round(value/6)，保底12，随价值单调递增，共 24 件）
// 注：仅收录 getItem 存在的物品；xpTonic/yieldTonic/preservative 等无物品定义，已从商店移除（避免买空）
export const GUILD_SHOP = [
  { itemId: 'mysterySpice', price: 12 },
  { itemId: 'pumpkinPie', price: 12 },
  { itemId: 'chiliPowder', price: 12 },
  { itemId: 'starAnise', price: 15 },
  { itemId: 'durian', price: 15 },
  { itemId: 'lingzhi', price: 15 },
  { itemId: 'abalone', price: 18 },
  { itemId: 'energyBiscuit', price: 20 },
  { itemId: 'vanilla', price: 24 },
  { itemId: 'ginseng', price: 25 },
  { itemId: 'mammothMeat', price: 33 },
  { itemId: 'truffle', price: 37 },
  { itemId: 'saffron', price: 53 },
  { itemId: 'spiritFruit', price: 58 },
  { itemId: 'dragonSalt', price: 70 },
  { itemId: 'flowerCrabSteam', price: 71 },
  { itemId: 'dragonHotpot', price: 73 },
  { itemId: 'dragonPepper', price: 75 },
  { itemId: 'roastTurkey', price: 78 },
  { itemId: 'dragonBreathWine', price: 80 },
  { itemId: 'ostrichSteak', price: 83 },
  { itemId: 'smith_ext2_06', price: 98 },
  { itemId: 'goldenDragonFish', price: 100 },
  { itemId: 'godFeast', price: 133 },
]

/** 公会加入需求文案（UI 显示） */
export function guildRequirementText(g) {
  const r = g.requirements
  if (!r) return '无等级要求（加入费 500 金币）'
  const parts = []
  if (r.combatLevel) parts.push(`对决 ${r.combatLevel} 级`)
  if (r.gatherLevel) parts.push(`采集总等级 ${r.gatherLevel}`)
  if (r.craftLevel) parts.push(`制作总等级 ${r.craftLevel}`)
  if (r.supportLevel) parts.push(`辅助总等级 ${r.supportLevel}`)
  parts.push(`${r.gold ?? 500} 金币`)
  return parts.join(' + ')
}

/** 公会被动文案（UI 显示） */
export function guildPassiveText(g) {
  const p = g.passive
  const parts = []
  if (p.dmgPct) parts.push(`对决伤害 +${p.dmgPct}%`)
  if (p.yieldPct) parts.push(`采集产量 +${p.yieldPct}%`)
  if (p.craftPct) parts.push(`制作成功率 +${p.craftPct}%`)
  if (p.xpPct) {
    if (typeof p.xpPct === 'object') parts.push(`技能经验 +${Object.values(p.xpPct)[0]}%`)
    else parts.push(`全技能经验 +${p.xpPct}%`)
  }
  return parts.join('、')
}

export function getGuild(id) {
  return GUILDS.find((g) => g.id === id) ?? null
}
