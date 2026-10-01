// 导出「所有需要背景的场景」：每个 view（含中文名）+ 每个技能（含中文名），供背景映射对账。
// 输出 JSON 到 stdout：{ views: [{key,name}], skills: [{id,name}], skillsAll: [...] }
import { createPinia, setActivePinia } from 'pinia'
setActivePinia(createPinia())
const { usePlayerStore } = await import('../../src/stores/player.js')
const { ui, VIEW_KEYS } = await import('../../src/stores/ui.js')
const { featureGroups } = await import('../../src/game/data/featureGroups.js')
const { SKILL_DEFS } = await import('../../src/game/data/skills.js')

const p = usePlayerStore()
p.newGame()

// view 的中文名：优先取左栏磁贴的名字（featureGroups），取自 `ui-inventory` 兜底为空
const viewName = {}
for (const g of featureGroups(p)) for (const it of g.items ?? g.tiles ?? []) viewName[it.view] = it.name ?? ''
const views = (VIEW_KEYS ?? []).map((k) => ({ key: k, name: viewName[k] ?? '' }))
// 顶栏功能页（不在左栏磁贴里的那批）
const skills = Object.entries(SKILL_DEFS).map(([id, d]) => ({ id, name: d.name ?? '' }))
console.log(JSON.stringify({ views, skills }))
