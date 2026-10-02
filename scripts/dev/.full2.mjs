import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../../src/stores/player.js'
import { createSkillInstances, getAllSkillInstances } from '../../src/game/skills/registry.js'
setActivePinia(createPinia())
const p = usePlayerStore()
p.newGame()
createSkillInstances(p)
const all = getAllSkillInstances()
console.log('实例数：', Object.keys(all ?? {}).length, '｜前几个 id：', Object.keys(all ?? {}).slice(0, 6).join(','))
const inst = all?.foraging ?? Object.values(all ?? {})[0]
console.log('样本实例：', inst?.id, '| 有 targets:', !!inst?.targets, '| 条数', inst?.targets?.length)
console.log('有 tick:', typeof inst?.tick, '| 有 setTarget:', typeof inst?.setTarget, '| 有 paused 字段:', inst?.paused)
console.log('技能状态 paused?', JSON.stringify(p.skillPaused ?? null), '| skills.foraging:', JSON.stringify(p.skills?.foraging))
const e0 = p.skills?.foraging?.exp ?? 0
// 试三种驱动方式
try { inst?.setTarget?.(inst.targets?.[0]?.id ?? inst.targets?.[0]?.itemId) } catch (e) { console.log('setTarget 抛错:', String(e).slice(0, 60)) }
try { inst?.tick?.(10 * 60 * 1000) } catch (e) { console.log('tick 抛错:', String(e).slice(0, 60)) }
console.log('tick 后 foraging.exp:', e0, '→', p.skills?.foraging?.exp, '| level', p.skills?.foraging?.level)
console.log('实例自己的 level 字段:', inst?.level, '| exp', inst?.exp)
const s = p.serialize()
console.log('存档里 foraging:', JSON.stringify(s.skills?.foraging))
