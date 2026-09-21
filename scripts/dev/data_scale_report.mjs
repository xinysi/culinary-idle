// 数据规模复算（照《设计文档》§13 自述的校准口径）：用于核 README / 设计文档 里的数字。
// 用法：node scripts/dev/data_scale_report.mjs
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../../src/stores/player.js'
import { createSkillInstances, getAllSkillInstances } from '../../src/game/skills/registry.js'
import { ITEMS } from '../../src/game/data/items.js'
import { SKILL_DEFS, SKILL_CATEGORIES, skillCategoriesOfTab } from '../../src/game/data/skills.js'
import { COMBAT_REGIONS, COMBAT_BOSSES } from '../../src/game/data/combat.js'
import { SEASONS } from '../../src/game/data/seasons.js'
import { AOJIS } from '../../src/game/data/aojis.js'
import { SPIRITS } from '../../src/game/data/spiritTiers.js'
import { EXPLORATION_TARGETS_ALL } from '../../src/game/data/explorationTargets.js'
import { GUILDS } from '../../src/game/data/guilds.js'
import { GUILD_SHOP } from '../../src/game/data/guilds.js'
import { ENCOUNTERS } from '../../src/game/data/encounters.js'
import { RESTAURANT_DECOR } from '../../src/game/data/restaurantDecor.js'
import { CRAFTED_DECOR } from '../../src/game/data/woodworking.js'
import { ALCHEMY_RECIPES } from '../../src/game/data/alchemy.js'
import { ALL_ACHIEVEMENTS } from '../../src/game/data/achievements.js'
import { allTitleNames } from '../../src/game/data/titles.js'
import { QUESTS } from '../../src/game/data/quests.js'
import { SKINS } from '../../src/game/data/skins.js'
import { EFFECT_ROWS } from '../../src/game/data/activeEffects.js'
import { VIEW_KEYS } from '../../src/stores/ui.js'

setActivePinia(createPinia())
const p = usePlayerStore()
p.newGame()
createSkillInstances(p)
const insts = getAllSkillInstances()

const byType = {}
for (const it of Object.values(ITEMS)) byType[it.type] = (byType[it.type] ?? 0) + 1
const byCat = {}
for (const d of Object.values(SKILL_DEFS)) byCat[d.category] = (byCat[d.category] ?? 0) + 1
const prod = insts.filter((i) => i.type === 'production')
const gather = insts.filter((i) => i.type === 'gathering')
const recipes = prod.reduce((a, i) => a + (i.recipes?.length ?? 0), 0)
const targets = gather.reduce((a, i) => a + (i.targets?.length ?? 0), 0)
const opps = COMBAT_REGIONS.reduce((a, r) => a + (r.opponents?.length ?? 0), 0)

console.log('技能        ', Object.keys(SKILL_DEFS).length, JSON.stringify(byCat))
console.log('  左栏页签分类', JSON.stringify(SKILL_CATEGORIES.map((c) => c.tab + ':' + c.id).reduce((a, x) => ((a[x.split(':')[0]] = (a[x.split(':')[0]] ?? 0) + 1), a), {})))
console.log('物品总数    ', Object.values(ITEMS).length, JSON.stringify(byType))
console.log('  装备       ', byType.equipment)
console.log('采集目标    ', targets)
console.log('  分线       ', gather.map((i) => `${i.id} ${i.targets?.length ?? 0}`).join(' / '))
console.log('食谱（制作类合计）', recipes)
console.log('  分技能     ', prod.map((i) => `${i.id} ${i.recipes?.length ?? 0}`).join(' / '))
console.log('对手 / 首领 ', opps, '/', COMBAT_BOSSES.length)
console.log('奥义/食灵/探索', AOJIS.length, '/', SPIRITS.length, '/', EXPLORATION_TARGETS_ALL.length)
console.log('公会 / 商店 ', GUILDS.length, '/', GUILD_SHOP.length)
console.log('赛季        ', SEASONS.length)
console.log('成就 / 称号 ', ALL_ACHIEVEMENTS.length, '/', allTitleNames().length)
console.log('任务        ', QUESTS.length)
console.log('奇遇        ', ENCOUNTERS.length)
console.log('装潢        ', RESTAURANT_DECOR.length, '+ 手工', CRAFTED_DECOR.length, '=', RESTAURANT_DECOR.length + CRAFTED_DECOR.length)
console.log('炼金配方    ', ALCHEMY_RECIPES.length)
console.log('皮肤        ', SKINS.length)
console.log('效果登记表  ', EFFECT_ROWS.length)
console.log('功能页(VIEW_KEYS)', VIEW_KEYS.length, '｜左栏分类', SKILL_CATEGORIES.length)
