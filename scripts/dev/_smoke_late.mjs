import { setActivePinia, createPinia } from 'pinia'
import { usePlayerStore } from '../../src/stores/player.js'
import { createSkillInstances, getSkillInstance } from '../../src/game/skills/registry.js'
setActivePinia(createPinia())
const p = usePlayerStore(); p.newGame(); createSkillInstances(p)
// ① 满级玩家做一道新菜（材料成本 ×2 生效）
p.setSkillState('cooking', { level: 120, exp: 0 })
for (const [id, q] of [['late_fish_01', 10], ['late_for_01', 10], ['water', 10]]) p.gainItem(id, q)
const cook = getSkillInstance('cooking')
const r = cook.recipes.find((x) => x.id === 'cook_late_01')
const can = cook.canCraft(r)
p.gainItem('late_fish_01', 200); p.gainItem('late_for_01', 200); p.gainItem('water', 200)
let ok = false
for (let i = 0; i < 40 && !ok; i++) { const res = cook.craft(r); ok = res === true || res === 'ok' }
console.log('① 龙涎煨汤: canCraft', can, '· 成功做出', (p.inventory.late_coo_01 ?? 0) > 0 ? 'OK' : 'FAIL', '（成功率 56%，失败也耗料是既有设计）')
// ② 采集目标存在性（动作链路由 C54 的 15 个调用点守卫覆盖，这里只验数据接上了）
p.setSkillState('foraging', { level: 112, exp: 0 })
const f = getSkillInstance('foraging')
const t = f.targets.find((x) => x.itemId === 'late_for_03')
console.log('② 九畹灵芝在采摘目标表:', !!t, `· Lv${t?.reqLevel} xp=${t?.xpPerAction}`)
// ③ 种新作物（种子 → 播种；农耕等级也要够）
p.setSkillState('farming', { level: 112, exp: 0 })
p.gainItem('late_far_01Seed', 3)
const farm = getSkillInstance('farming')
const planted = farm.plant(0, 'late_far_01Seed')
console.log('③ 播种霜蜜瓜:', planted ? 'OK' : 'FAIL')
// ④ 副业新作品（陶艺 102）
p.setSkillState('pottery', { level: 112, exp: 0 })
for (const [id, q] of [['late_wood_01', 400], ['late_min_01', 400]]) p.gainItem(id, q)
const pot = getSkillInstance('pottery')
const pr = pot.recipes.find((x) => x.id === 'po_102')
let made = false
for (let i = 0; i < 60 && !made; i++) { const res = pot.craft(pr); made = res === true || res === 'ok' } // craft 失败返回 'fail'（truthy！）
const work = made ? p.craftWork('pottery_102') : 'skipped'
console.log('④ 星陨陶鼎: craft', made, '· 做成作品', work, '· 地窖上限', p.cellarSlotValueMax())
// ⑤ 种子商店有货
const { SHOP_ITEMS } = await import('../../src/game/data/shop.js')
console.log('⑤ 商店有 late_far_01Seed:', SHOP_ITEMS.some((s) => s.itemId === 'late_far_01Seed'))
