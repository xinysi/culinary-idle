// 成就系统 — 需求文档 §6
// 5 大类：技能(§6.1)/对决/收集/探索/特殊；完成获得金币、道具、称号。
// check(player) 返回布尔；reward: { gold?, items?: {itemId: qty}, title? }
// 技能等级成就（10/50/99 级 × 20 技能）由 buildSkillAchievements 程序化生成。

import { SKILL_DEFS } from './skills.js'
import { ITEMS } from './items.js'

const LEVEL_TIERS = [
  { level: 10, suffix: '学徒', gold: 100 },
  { level: 50, suffix: '行家', gold: 500 },
  { level: 99, suffix: '大师', gold: 2000 },
]

export function buildSkillAchievements() {
  const list = []
  for (const [id, def] of Object.entries(SKILL_DEFS)) {
    for (const t of LEVEL_TIERS) {
      list.push({
        id: `skill_${id}_${t.level}`,
        name: `${def.name}${t.suffix}`,
        category: '技能',
        desc: `${def.name}达到 ${t.level} 级`,
        title: t.level === 99 ? `${def.name}大师` : null,
        reward: { gold: t.gold },
        check: (player) => (player.skills[id]?.level ?? 1) >= t.level,
      })
    }
  }
  return list
}

export const ACHIEVEMENTS = [
  // ── 对决 ──
  { id: 'firstWin', name: '初战告捷', category: '对决', desc: '首次赢得料理对决', reward: { gold: 150 }, check: (p) => p.stats.combatWins >= 1 },
  { id: 'win10', name: '小有名气', category: '对决', desc: '赢得 10 场对决', reward: { gold: 300 }, check: (p) => p.stats.combatWins >= 10 },
  { id: 'win100', name: '美食猎人', category: '对决', desc: '赢得 100 场对决', title: '美食猎人', reward: { gold: 1000 }, check: (p) => p.stats.combatWins >= 100 },
  { id: 'win500', name: '百战名厨', category: '对决', desc: '赢得 500 场对决', reward: { gold: 3000 }, check: (p) => p.stats.combatWins >= 500 },
  { id: 'win1000', name: '无双食神', category: '对决', desc: '赢得 1000 场对决', title: '无双食神', reward: { gold: 8000 }, check: (p) => p.stats.combatWins >= 1000 },
  { id: 'bossAll', name: '诸神黄昏', category: '对决', desc: '击败全部 28 个 首领', title: '黑暗料理王', reward: { gold: 10000, items: { godCrown: 1 } }, check: (p) => p.stats.bosses.length >= 28 },
  // ── 收集 ──
  { id: 'log25', name: '初入图鉴', category: '收集', desc: '图鉴完成度达到 25%', reward: { gold: 500 }, check: (p) => p.collectionPct >= 25 },
  { id: 'log50', name: '收集家', category: '收集', desc: '图鉴完成度达到 50%', reward: { gold: 1500 }, check: (p) => p.collectionPct >= 50 },
  { id: 'log75', name: '收藏大师', category: '收集', desc: '图鉴完成度达到 75%', reward: { gold: 4000 }, check: (p) => p.collectionPct >= 75 },
  { id: 'log100', name: '食之集大成者', category: '收集', desc: '图鉴完成度达到 100%', title: '食神', reward: { gold: 20000 }, check: (p) => p.collectionPct >= 100 },
  { id: 'allFish', name: '渔夫之戒', category: '收集', desc: '收集所有鱼类（含金龙鱼）', reward: { items: { fishermanRing: 1 } }, check: (p) => FISH_IDS.every((id) => p.collected[id]) },
  { id: 'allDishes', name: '料理图鉴', category: '收集', desc: '收集所有料理', reward: { items: { chefBadge: 1 } }, check: (p) => DISH_IDS.every((id) => p.collected[id]) },
  { id: 'allGear', name: '装备收藏家', category: '收集', desc: '收集所有厨具装备', reward: { items: { smithRing: 1 } }, check: (p) => GEAR_IDS.every((id) => p.collected[id]) },
  // ── 探索 ──
  { id: 'explore1', name: '初探秘境', category: '探索', desc: '成功探索 1 次', reward: { gold: 100 }, check: (p) => p.stats.explorations >= 1 },
  { id: 'explore50', name: '秘境常客', category: '探索', desc: '成功探索 50 次', reward: { gold: 800 }, check: (p) => p.stats.explorations >= 50 },
  { id: 'region3', name: '游历四方', category: '探索', desc: '解锁 3 个对决区域', reward: { gold: 300 }, check: (p) => p.regionsUnlocked >= 3 },
  { id: 'region6', name: '美食冒险家', category: '探索', desc: '解锁 6 个对决区域', reward: { gold: 1500 }, check: (p) => p.regionsUnlocked >= 6 },
  { id: 'region10', name: '食之大陆探索者', category: '探索', desc: '解锁全部 10 个对决区域', reward: { gold: 5000 }, check: (p) => p.regionsUnlocked >= 10 },
  // ── 特殊 ──
  { id: 'gold10k', name: '小富翁', category: '特殊', desc: '累计获得 10000 金币', reward: { gold: 1000 }, check: (p) => p.stats.totalGoldEarned >= 10000 },
  { id: 'gold100k', name: '美食大亨', category: '特殊', desc: '累计获得 100000 金币', title: '美食大亨', reward: { gold: 10000 }, check: (p) => p.stats.totalGoldEarned >= 100000 },
  { id: 'items50', name: '杂货铺常客', category: '特殊', desc: '拥有 50 种不同物品', reward: { gold: 500 }, check: (p) => Object.keys(p.collected).length >= 50 },
  { id: 'prestige1', name: '初入轮回', category: '特殊', desc: '完成第一次技能转生', title: '转生者', reward: { gold: 2000 }, check: (p) => p.stats.prestiges >= 1 },
  { id: 'prestige3', name: '轮回之门', category: '特殊', desc: '累计转生 3 次', reward: { gold: 4000, items: { mysterySpice: 1 } }, check: (p) => p.stats.prestiges >= 3 },
  { id: 'prestige5', name: '轮回行者', category: '特殊', desc: '累计转生 5 次', title: '轮回行者', reward: { gold: 8000, items: { energyBiscuit: 1 } }, check: (p) => p.stats.prestiges >= 5 },
  { id: 'prestige8', name: '轮回大师', category: '特殊', desc: '累计转生 8 次', title: '轮回大师', reward: { gold: 15000, items: { mysterySpice: 2 } }, check: (p) => p.stats.prestiges >= 8 },
  { id: 'prestige12', name: '永恒轮回', category: '特殊', desc: '累计转生 12 次', title: '永恒轮回', reward: { gold: 30000, items: { energyBiscuit: 3 } }, check: (p) => p.stats.prestiges >= 12 },
  { id: 'level120', name: '突破极限', category: '特殊', desc: '任意技能达到 120 级', reward: { gold: 10000 }, check: (p) => Object.values(p.skills).some((s) => (s.level ?? 1) >= 120) },
  { id: 'totalLevel500', name: '全能美食家', category: '特殊', desc: '总等级达到 500', reward: { gold: 3000 }, check: (p) => p.totalLevels >= 500 },
  { id: 'totalLevel1000', name: '食之大成', category: '特殊', desc: '总等级达到 1000', reward: { gold: 10000 }, check: (p) => p.totalLevels >= 1000 },
  { id: 'hardcore10', name: '硬核勇士', category: '特殊', desc: '硬核模式下赢得 10 场对决', title: '硬核勇士', reward: { gold: 5000 }, check: (p) => p.hardcore && p.stats.combatWins >= 10 },
  { id: 'season5', name: '四季轮回', category: '特殊', desc: '在 5 个不同赛季领取过奖励', reward: { gold: 5000 }, check: (p) => Object.values(p.seasons ?? {}).filter((s) => (s.claimed?.length ?? 0) > 0).length >= 5 },
  { id: 'season10', name: '岁月饕客', category: '特殊', desc: '在 10 个不同赛季领取过奖励', reward: { gold: 12000 }, check: (p) => Object.values(p.seasons ?? {}).filter((s) => (s.claimed?.length ?? 0) > 0).length >= 10 },
  { id: 'seasonAll', name: '时空穿梭者', category: '特殊', desc: '在全部 40 个赛季领取过奖励', title: '时空穿梭者', reward: { gold: 50000 }, check: (p) => Object.values(p.seasons ?? {}).filter((s) => (s.claimed?.length ?? 0) > 0).length >= 40 },
  // 图鉴完成度里程碑（2026-09-06 长线收集线）
  { id: 'collection25', name: '图鉴入门', category: '收集', desc: '收集图鉴达到 25%', reward: { gold: 1000 }, check: (p) => p.collectionPct >= 25 },
  { id: 'collection50', name: '图鉴行家', category: '收集', desc: '收集图鉴达到 50%', title: '图鉴行家', reward: { gold: 3000, items: { mysterySpice: 1 } }, check: (p) => p.collectionPct >= 50 },
  { id: 'collection75', name: '图鉴宗师', category: '收集', desc: '收集图鉴达到 75%', title: '图鉴宗师', reward: { gold: 8000, items: { energyBiscuit: 1 } }, check: (p) => p.collectionPct >= 75 },
  { id: 'collection100', name: '美食全知者', category: '收集', desc: '收集图鉴达到 100%', title: '美食全知者', reward: { gold: 30000, items: { mysterySpice: 3, energyBiscuit: 2 } }, check: (p) => p.collectionPct >= 100 },
  // 硬核生存挑战（2026-09-06）：历史最佳生存天数
  { id: 'hardcoreDay1', name: '硬核开局', category: '特殊', desc: '硬核模式生存满 1 天', reward: { gold: 500 }, check: (p) => p.hardcoreDayCount() >= 1 },
  { id: 'hardcoreDay7', name: '硬核一周', category: '特殊', desc: '硬核模式生存满 7 天', reward: { gold: 2000, items: { mysterySpice: 1 } }, check: (p) => p.hardcoreDayCount() >= 7 },
  { id: 'hardcoreDay30', name: '硬核一月', category: '特殊', desc: '硬核模式生存满 30 天', title: '硬核幸存者', reward: { gold: 8000, items: { energyBiscuit: 1 } }, check: (p) => p.hardcoreDayCount() >= 30 },
  { id: 'hardcoreDay100', name: '硬核传说', category: '特殊', desc: '硬核模式生存满 100 天', title: '硬核传说', reward: { gold: 30000, items: { mysterySpice: 2 } }, check: (p) => p.hardcoreDayCount() >= 100 },
]

export const ALL_ACHIEVEMENTS = [...buildSkillAchievements(), ...ACHIEVEMENTS]

const FISH_IDS = ['crucian', 'carp', 'perch', 'salmon', 'tuna', 'eel', 'lobster', 'crab', 'abalone', 'seaCucumber', 'bluefin', 'grouper', 'goldenDragonFish']
const DISH_IDS = Object.keys(ITEMS).filter((id) => ITEMS[id].type === 'food')
const GEAR_IDS = Object.keys(ITEMS).filter((id) => ITEMS[id].type === 'equipment')

export function getAchievement(id) {
  return ALL_ACHIEVEMENTS.find((a) => a.id === id) ?? null
}

/** 图鉴总条目数（§6.2 完成度分母） */
export function collectionTotal() {
  return Object.keys(ITEMS).length
}
