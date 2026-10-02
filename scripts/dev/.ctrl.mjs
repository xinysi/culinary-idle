// 对照实验：把 growth_sim.mjs 的 driveIdle **原样抄**过来，看是否能产出数字。
// 能 ⇒ 我的 full_run 循环写错了；不能 ⇒ 差异在环境（导入/初始化顺序）。
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../../src/stores/player.js'
import { createSkillInstances, getSkillInstance } from '../../src/game/skills/registry.js'

let SIM_NOW = Date.now()
const REAL_NOW = Date.now
Date.now = () => SIM_NOW

setActivePinia(createPinia())
const p = usePlayerStore()
p.newGame()
p.settings.xpMultiplier = 1
createSkillInstances(p)
SIM_NOW = REAL_NOW()

const MAXLV = 99
// ↓↓↓ 逐行抄自 growth_sim.mjs 的 driveIdle ↓↓↓
function driveIdle(skillId, maxDays = 200) {
  const inst = getSkillInstance(skillId)
  let ms = 0, cachedLv = -1
  const cap = maxDays * 86400000
  while ((p.skills[skillId].level ?? 1) < MAXLV && ms < cap) {
    const lv = p.skills[skillId].level ?? 1
    if (lv !== cachedLv) {
      cachedLv = lv
      const t = [...inst.targets].filter((x) => x.reqLevel <= lv).sort((a, b) => b.reqLevel - a.reqLevel)[0]
      if (!t) break
      p.setSkillTarget(skillId, t.itemId ?? t.id)
    }
    inst.tick(10000)
    ms += 10000
    SIM_NOW += 10000
  }
  return ms / 3600000
}
// ↑↑↑ 逐行抄完 ↑↑↑

const h = driveIdle('foraging')
console.log('对照实验 · driveIdle(foraging)：', h.toFixed(1), '小时 → level', p.skills.foraging.level, '· exp', p.skills.foraging.exp)
console.log('（growth_sim 的基准列是 44.2h ⇒ 若这里也是几十小时，说明抄法正确、我的 full_run 循环有问题）')
