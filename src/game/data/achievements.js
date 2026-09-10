// 成就系统 — 需求文档 §6
// 5 大类：技能(§6.1)/对决/收集/探索/特殊；完成获得金币、道具、称号。
// check(player) 返回布尔；reward: { gold?, items?: {itemId: qty}, title? }
// 技能等级成就（10/50/99 级 × 20 技能）由 buildSkillAchievements 程序化生成。

import { SKILL_DEFS } from './skills.js'
import { ITEMS } from './items.js'
import { equipSetBonuses } from './equipSets.js'
import { masteryLevelFromCount } from '../core/mastery.js'
import { REGULARS, regularLevelFromServes } from './regulars.js'
import { FLAVOR_PAIRS } from './flavorPairs.js'
import { SCHOOLS } from './schools.js'
import { MILESTONES, milestoneSummary } from './milestones.js'
import { CODEX_REWARDS } from './codexShop.js'
import { STAFF } from './staff.js'
import { REGIONS } from './regions.js'

// 制作类技能 id（厨房笔记/配方精通成就用；精通存于 player.skills[id].mastery[recipeId]）
const PROD_SKILL_IDS = ['cooking', 'baking', 'preserving', 'brewing', 'spiceMixing', 'craftsmithing', 'preservation', 'spiritSummoning']

/** 全部配方的精通等级列表（0~100） */
function recipeMasteryLevels(p) {
  const out = []
  for (const id of PROD_SKILL_IDS) {
    const m = p?.skills?.[id]?.mastery ?? {}
    for (const v of Object.values(m)) out.push(masteryLevelFromCount(v ?? 0))
  }
  return out
}

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
  { id: 'hardBossAll', name: '食神之巅', category: '对决', desc: '困难模式首杀全部 28 个 首领', title: '食神之巅', reward: { gold: 20000, items: { godCrown: 1, energyBiscuit: 2 } }, check: (p) => (p.stats.hardBosses?.length ?? 0) >= 28 },
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
  // ── 2026-09-09 新增玩法（秘境 / 远行采集队 / 美食评论家 / 宝石镶嵌 / 套装 / 菜系图谱 / 每周挑战 / 挂机计划）──
  { id: 'realm5', name: '秘境初探', category: '特殊', desc: '食神秘境到达第 5 层', reward: { gold: 1000 }, check: (p) => (p.realm?.best ?? 0) >= 5 },
  { id: 'realm15', name: '秘境行者', category: '特殊', desc: '食神秘境到达第 15 层', title: '秘境行者', reward: { gold: 5000, items: { mysterySpice: 1 } }, check: (p) => (p.realm?.best ?? 0) >= 15 },
  { id: 'realm30', name: '秘境之主', category: '特殊', desc: '食神秘境到达第 30 层', title: '秘境之主', reward: { gold: 15000, items: { mysterySpice: 2, energyBiscuit: 1 } }, check: (p) => (p.realm?.best ?? 0) >= 30 },
  { id: 'expedition10', name: '远行初捷', category: '特殊', desc: '远行采集队累计完成 10 轮', reward: { gold: 800 }, check: (p) => Object.values(p.expeditions ?? {}).reduce((a, e) => a + (e?.completions ?? 0), 0) >= 10 },
  { id: 'expedition100', name: '远行老手', category: '特殊', desc: '远行采集队累计完成 100 轮', title: '远行领队', reward: { gold: 6000, items: { energyBiscuit: 1 } }, check: (p) => Object.values(p.expeditions ?? {}).reduce((a, e) => a + (e?.completions ?? 0), 0) >= 100 },
  { id: 'critic10', name: '好评如潮', category: '特殊', desc: '满足美食评论家 10 次', title: '名厨', reward: { gold: 4000, items: { mysterySpice: 1 } }, check: (p) => (p.stats?.criticServed ?? 0) >= 10 },
  { id: 'gems10', name: '镶嵌入门', category: '特殊', desc: '累计镶嵌 10 颗宝石', reward: { gold: 2000 }, check: (p) => (p.stats?.gemsSocketed ?? 0) >= 10 },
  { id: 'set2', name: '套装初成', category: '特殊', desc: '同时激活 2 个套装效果', reward: { gold: 2500 }, check: (p) => equipSetBonuses(p.equipment).active.length >= 2 },
  { id: 'insight6', name: '图谱学者', category: '特殊', desc: '解锁 6 个菜系图谱节点', title: '图谱学者', reward: { gold: 5000, items: { mysterySpice: 1 } }, check: (p) => (p.insights?.length ?? 0) >= 6 },
  { id: 'insight12', name: '图谱宗师', category: '特殊', desc: '解锁全部 12 个菜系图谱节点', title: '菜系宗师', reward: { gold: 20000, items: { mysterySpice: 2 } }, check: (p) => (p.insights?.length ?? 0) >= 12 },
  { id: 'challenge4', name: '挑战达人', category: '特殊', desc: '完成 4 次每周挑战', reward: { gold: 4000, items: { energyBiscuit: 1 } }, check: (p) => (p.stats?.challengesDone ?? 0) >= 4 },
  { id: 'plan3', name: '计划执行者', category: '特殊', desc: '完成 3 次挂机计划', reward: { gold: 3000 }, check: (p) => (p.stats?.plansDone ?? 0) >= 3 },
  // ── 2026-09-10 新增页面（厨房笔记 / 名人堂 / 地窖 / 常客 / 食灵物语 / 自动化 / 牧场 / 分店 / 交易所 / 试炼）──
  { id: 'note20', name: '笔记入门', category: '特殊', desc: '20 张配方精通达到 50 级', reward: { gold: 3000, items: { energyBiscuit: 1 } }, check: (p) => recipeMasteryLevels(p).filter((l) => l >= 50).length >= 20 },
  { id: 'note100', name: '笔记宗师', category: '特殊', desc: '100 张配方精通达到 50 级', title: '笔记宗师', reward: { gold: 12000, items: { mysterySpice: 2 } }, check: (p) => recipeMasteryLevels(p).filter((l) => l >= 50).length >= 100 },
  { id: 'noteMax', name: '专精一菜', category: '特殊', desc: '任一配方精通达到 100 级', reward: { gold: 5000, items: { mysterySpice: 1 } }, check: (p) => recipeMasteryLevels(p).some((l) => l >= 100) },
  { id: 'cellar1', name: '初入酒窖', category: '特殊', desc: '完成 1 次地窖陈酿出窖', reward: { gold: 800 }, check: (p) => (p.stats?.cellarRounds ?? 0) >= 1 },
  { id: 'cellar50', name: '酒窖大师', category: '特殊', desc: '累计地窖出窖 50 次', title: '酒窖大师', reward: { gold: 6000, items: { mysterySpice: 1 } }, check: (p) => (p.stats?.cellarRounds ?? 0) >= 50 },
  { id: 'regular20', name: '熟客满堂', category: '特殊', desc: '累计招待常客 20 次', reward: { gold: 1500, items: { mysterySpice: 1 } }, check: (p) => (p.stats?.regularServes ?? 0) >= 20 },
  { id: 'regular1', name: '常客盈门', category: '特殊', desc: '1 位常客好感达到满级', reward: { gold: 3000, items: { mysterySpice: 1 } }, check: (p) => REGULARS.some((r) => regularLevelFromServes(p.regulars?.[r.id]?.serves ?? 0) >= 5) },
  { id: 'regularAll', name: '宾至如归', category: '特殊', desc: '全部 8 位常客好感满级', title: '宾至如归', reward: { gold: 15000, items: { mysterySpice: 2 } }, check: (p) => REGULARS.every((r) => regularLevelFromServes(p.regulars?.[r.id]?.serves ?? 0) >= 5) },
  { id: 'story1', name: '物语初章', category: '特殊', desc: '解锁并领取 1 段食灵物语', reward: { gold: 600 }, check: (p) => (p.stats?.spiritStoryClaims ?? 0) >= 1 },
  { id: 'story40', name: '食灵知音', category: '特殊', desc: '累计领取 40 段食灵物语', title: '食灵知音', reward: { gold: 8000, items: { mysterySpice: 2 } }, check: (p) => (p.stats?.spiritStoryClaims ?? 0) >= 40 },
  { id: 'auto3', name: '自动化大师', category: '特殊', desc: '解锁全部 3 项自动化', title: '自动化大师', reward: { gold: 6000, items: { energyBiscuit: 1 } }, check: (p) => ['sell', 'queue', 'claim'].every((k) => p.automation?.unlocked?.[k]) },
  { id: 'ranch1', name: '牧场开张', category: '特殊', desc: '首次买下动物', reward: { gold: 1200 }, check: (p) => (p.ranch?.pens ?? []).some((x) => x?.animalId) },
  { id: 'ranch50', name: '牧场主', category: '特殊', desc: '牧场累计产出 50 个周期', title: '牧场主', reward: { gold: 7000, items: { mysterySpice: 1 } }, check: (p) => (p.stats?.ranchCycles ?? 0) >= 50 },
  { id: 'branch1', name: '首开分店', category: '特殊', desc: '开设第一家分店', reward: { gold: 3000 }, check: (p) => Object.keys(p.branches ?? {}).length >= 1 },
  { id: 'branchAll', name: '连锁帝国', category: '特殊', desc: '四家分店全部开业并雇满店长', title: '连锁帝国', reward: { gold: 30000, items: { mysterySpice: 2 } }, check: (p) => ['east', 'west', 'south', 'north'].every((id) => p.branches?.[id]?.manager) },
  { id: 'michelin1', name: '初登榜单', category: '特殊', desc: '餐厅获得米其林一星', reward: { gold: 4000, items: { mysterySpice: 1 } }, check: (p) => (p.michelin?.best ?? 0) >= 1 },
  { id: 'michelin3', name: '三星食府', category: '特殊', desc: '餐厅获得米其林三星', title: '三星食府', reward: { gold: 30000, items: { mysterySpice: 2, energyBiscuit: 1 } }, check: (p) => (p.michelin?.best ?? 0) >= 3 },
  { id: 'flavor5', name: '初尝搭配', category: '收集', desc: '点亮 5 条风味搭配', reward: { gold: 1500, items: { energyBiscuit: 1 } }, check: (p) => Object.keys(p.flavors ?? {}).length >= 5 },
  { id: 'flavorAll', name: '风味百科', category: '收集', desc: '点亮全部风味搭配', title: '风味百科', reward: { gold: 18000, items: { mysterySpice: 3 } }, check: (p) => Object.keys(p.flavors ?? {}).length >= FLAVOR_PAIRS.length },
  { id: 'gearContest3', name: '初登赛场', category: '特殊', desc: '厨具大赛累计参赛 3 届', reward: { gold: 2500, items: { energyBiscuit: 1 } }, check: (p) => (p.stats?.gearContestRuns ?? 0) >= 3 },
  { id: 'gearContestS', name: '至尊厨具', category: '特殊', desc: '厨具大赛取得 S 档', title: '至尊厨具', reward: { gold: 20000, items: { mysterySpice: 2 } }, check: (p) => p.gearContest?.rank === 'S' },
  { id: 'school1', name: '初入学派', category: '特殊', desc: '完成 1 级菜系研究', reward: { gold: 2000, items: { energyBiscuit: 1 } }, check: (p) => (p.stats?.schoolLevels ?? 0) >= 1 },
  { id: 'school15', name: '六艺通才', category: '特殊', desc: '累计研究 15 级（六派共 30 级）', title: '六艺通才', reward: { gold: 15000, items: { mysterySpice: 2 } }, check: (p) => (p.stats?.schoolLevels ?? 0) >= 15 },
  { id: 'schoolAll', name: '一代宗匠', category: '特殊', desc: '六大流派全部研究满级', title: '一代宗匠', reward: { gold: 40000, items: { mysterySpice: 3, energyBiscuit: 2 } }, check: (p) => SCHOOLS.every((s) => (p.schools?.[s.id]?.level ?? 0) >= 5) },
  { id: 'staff1', name: '初雇人手', category: '特殊', desc: '雇下第一位雇工', reward: { gold: 2000, items: { energyBiscuit: 1 } }, check: (p) => STAFF.some((s) => (p.staff?.[s.id]?.level ?? 0) > 0) },
  { id: 'staffAll', name: '名店班底', category: '特殊', desc: '三种岗位全部满级在岗', title: '名店班底', reward: { gold: 25000, items: { mysterySpice: 2 } }, check: (p) => STAFF.every((s) => (p.staff?.[s.id]?.level ?? 0) >= 5) },
  { id: 'region1', name: '初次远行', category: '探索', desc: '考察 1 个产地', reward: { gold: 2500, items: { energyBiscuit: 1 } }, check: (p) => Object.keys(p.regions ?? {}).length >= 1 },
  { id: 'regionAll', name: '踏遍四方', category: '探索', desc: '考察全部 5 个产地', title: '踏遍四方', reward: { gold: 20000, items: { mysterySpice: 2 } }, check: (p) => REGIONS.every((r) => p.regions?.[r.id]) },
  { id: 'carry1', name: '留一手', category: '特殊', desc: '首次转生保留传承等级', reward: { gold: 3000, items: { mysterySpice: 1 } }, check: (p) => Object.values(p.legacy?.carry ?? {}).some((lv) => (lv ?? 0) > 0) },
  { id: 'apprentice30', name: '桃李成蹊', category: '特殊', desc: '徒弟成长到 Lv30', reward: { gold: 12000, items: { mysterySpice: 1 } }, check: (p) => (p.legacy?.apprentice?.level ?? 0) >= 30 },
  { id: 'apprentice50', name: '衣钵传人', category: '特殊', desc: '徒弟成长到满级 Lv50', title: '衣钵传人', reward: { gold: 30000, items: { mysterySpice: 2 } }, check: (p) => (p.legacy?.apprentice?.level ?? 0) >= 50 },
  { id: 'patron1', name: '初选定信仰', category: '特殊', desc: '首次选定一位守护神', reward: { gold: 2500, items: { mysterySpice: 1 } }, check: (p) => !!p.patron?.active },
  { id: 'patronMax', name: '神眷之人', category: '特殊', desc: '任一守护神供奉满级 Lv3', title: '神眷之人', reward: { gold: 20000, items: { mysterySpice: 2 } }, check: (p) => Object.values(p.patron?.levels ?? {}).some((lv) => (lv ?? 0) >= 3) },
  { id: 'ms10', group: '特殊', name: '路上之人', category: '特殊', desc: '达成 10 项里程碑', reward: { gold: 3000, items: { energyBiscuit: 1 } }, check: (p) => milestoneSummary(p).done >= 10 },
  { id: 'msAll', name: '圆满之路', category: '特殊', desc: '达成全部里程碑', title: '圆满之路', reward: { gold: 50000, items: { mysterySpice: 3, energyBiscuit: 3 } }, check: (p) => milestoneSummary(p).done >= MILESTONES.length },
  { id: 'chron20', group: '特殊', name: '有故事的人', category: '特殊', desc: '年鉴记录 20 条', reward: { gold: 4000, items: { energyBiscuit: 1 } }, check: (p) => (p.chronicle ?? []).length >= 20 },
  { id: 'chron60', name: '编年史家', category: '特殊', desc: '年鉴记录 60 条', title: '编年史家', reward: { gold: 18000, items: { mysterySpice: 2 } }, check: (p) => (p.chronicle ?? []).length >= 60 },
  { id: 'mascot1', group: '特殊', name: '招财进宝', category: '特殊', desc: '买下第一位吉祥物', reward: { gold: 2500, items: { energyBiscuit: 1 } }, check: (p) => Object.keys(p.mascots?.owned ?? {}).length >= 1 },
  { id: 'mascot30', name: '镇店之宝', category: '特殊', desc: '累计蹭吉祥物 30 次', title: '镇店之宝', reward: { gold: 12000, items: { mysterySpice: 1 } }, check: (p) => (p.stats?.mascotPets ?? 0) >= 30 },
  { id: 'banquet1', group: '特殊', name: '开席', category: '特殊', desc: '首次交付一场宴席', reward: { gold: 5000, items: { mysterySpice: 1 } }, check: (p) => (p.stats?.banquets ?? 0) >= 1 },
  { id: 'banquet20', name: '宴遍四方', category: '特殊', desc: '累计交付 20 场宴席', title: '宴遍四方', reward: { gold: 25000, items: { mysterySpice: 2 } }, check: (p) => (p.stats?.banquets ?? 0) >= 20 },
  { id: 'takeout100', name: '外卖先锋', category: '特殊', desc: '外卖累计接单 100 单', reward: { gold: 8000, items: { energyBiscuit: 1 } }, check: (p) => (p.stats?.takeoutSold ?? 0) >= 100 },
  { id: 'takeout1000', name: '配送之王', category: '特殊', desc: '外卖累计接单 1000 单', title: '配送之王', reward: { gold: 30000, items: { mysterySpice: 2 } }, check: (p) => (p.stats?.takeoutSold ?? 0) >= 1000 },
  { id: 'ex10', name: '第一桶金', category: '特殊', desc: '交易所累计成交 10 件', reward: { gold: 1500 }, check: (p) => (p.stats?.exchangeTrades ?? 0) >= 10 },
  { id: 'ex500', name: '行情老手', category: '特殊', desc: '交易所累计成交 500 件', title: '行情老手', reward: { gold: 9000, items: { mysterySpice: 1 } }, check: (p) => (p.stats?.exchangeTrades ?? 0) >= 500 },
  { id: 'trial1', name: '初次试炼', category: '特殊', desc: '通关任意一条厨神试炼', reward: { gold: 3000, items: { energyBiscuit: 1 } }, check: (p) => (p.stats?.trialClears ?? 0) >= 1 },
  { id: 'trialAll', name: '厨神之证', category: '特殊', desc: '四条试炼各通关至少 1 次', title: '厨神之证', reward: { gold: 25000, items: { mysterySpice: 2 } }, check: (p) => ['t_speed', 't_flawless', 't_overlevel', 't_streak'].every((id) => (p.trials?.[id]?.clears ?? 0) >= 1) },
  { id: 'theme1', name: '特色经营', category: '特殊', desc: '给任意一家分店定下主题', reward: { gold: 4000, items: { energyBiscuit: 1 } }, check: (p) => Object.keys(p.branchThemes ?? {}).length >= 1 },
  { id: 'themeAll', name: '连锁品牌', category: '特殊', desc: '三家以上分店各有主题', title: '连锁品牌', reward: { gold: 20000, items: { mysterySpice: 2 } }, check: (p) => Object.keys(p.branchThemes ?? {}).length >= 3 },
  { id: 'sup1', name: '长期合作', category: '特殊', desc: '签下第一份供应商合约', reward: { gold: 3000 }, check: (p) => Object.keys(p.contracts ?? {}).length >= 1 },
  { id: 'sup50', name: '供应链主', category: '特殊', desc: '供应商累计到货 50 次', title: '供应链主', reward: { gold: 16000, items: { mysterySpice: 2 } }, check: (p) => (p.stats?.contractDeliveries ?? 0) >= 50 },
  { id: 'chef1', name: '挑战名厨', category: '特殊', desc: '首次战胜一位名厨', reward: { gold: 6000, items: { energyBiscuit: 2 } }, check: (p) => (p.stats?.chefWins ?? 0) >= 1 },
  { id: 'chef8', name: '名厨征服者', category: '特殊', desc: '累计战胜名厨 8 次', title: '名厨征服者', reward: { gold: 36000, items: { mysterySpice: 3 } }, check: (p) => (p.stats?.chefWins ?? 0) >= 8 },
  { id: 'seasonFull', name: '赛季全勤', category: '特殊', desc: '任一赛季任务全部达成', reward: { gold: 12000, items: { mysterySpice: 1 } }, check: (p) => (p.chronicle ?? []).some((e) => (e.key ?? '').startsWith('season-all:')) },
  // 第四批（2026-09-10）：荣誉殿堂 / 图鉴兑换所 / 套餐与定食 / 同业竞争榜
  { id: 'honor3', group: '特殊', name: '小有名声', category: '特殊', desc: '荣誉等级达到 3 级（拥有 24 个称号）', reward: { gold: 9000, items: { energyBiscuit: 1 } }, check: (p) => p.ownedTitles().length >= 24 },
  { id: 'honorMax', name: '荣誉等身', category: '特殊', desc: '荣誉等级满级（拥有 72 个称号）', title: '荣誉等身', reward: { gold: 60000, items: { mysterySpice: 3 } }, check: (p) => p.ownedTitles().length >= 72 },
  { id: 'codex1', name: '以藏换物', category: '特殊', desc: '首次在图鉴兑换所兑换', reward: { gold: 3000, items: { energyBiscuit: 1 } }, check: (p) => (p.codexOwned ?? []).length >= 1 },
  { id: 'codexAll', name: '图鉴藏家', category: '特殊', desc: '兑完图鉴兑换所全部商品', title: '图鉴藏家', reward: { gold: 40000, items: { mysterySpice: 3 } }, check: (p) => (p.codexOwned ?? []).length >= CODEX_REWARDS.length },
  { id: 'meal1', name: '配餐入门', category: '特殊', desc: '菜单凑齐任意一套套餐', reward: { gold: 2500, items: { energyBiscuit: 1 } }, check: (p) => p.setMealBonus() > 0 },
  { id: 'mealGrand', name: '一桌全席', category: '特殊', desc: '菜单凑齐「豪华全席」套餐', title: '全席掌勺', reward: { gold: 20000, items: { mysterySpice: 2 } }, check: (p) => p.setMealState().meal?.id === 'sm_grand' },
  { id: 'biscuitUse', name: '应急加餐', category: '特殊', desc: '对决中首次使用能量饼干进行补给', reward: { gold: 2500, items: { energyBiscuit: 1 } }, check: (p) => (p.stats?.biscuitsUsed ?? 0) >= 1 },
  { id: 'biscuitRecycle', name: '循环利用', category: '特殊', desc: '累计回收能量饼干 50 块', reward: { gold: 8000, items: { mysterySpice: 1 } }, check: (p) => (p.stats?.biscuitsRecycled ?? 0) >= 50 },
  { id: 'rival1', name: '榜上有名', category: '特殊', desc: '首次领取同业竞争榜名次奖励', reward: { gold: 5000, items: { energyBiscuit: 1 } }, check: (p) => (p.stats?.rivalClaims ?? 0) >= 1 },
  { id: 'rivalTop', name: '同业之首', category: '特殊', desc: '在任何一月登上同业竞争榜第 1 名', title: '同业之首', reward: { gold: 45000, items: { mysterySpice: 3 } }, check: (p) => (p.stats?.rivalBestRank ?? 99) === 1 },
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
