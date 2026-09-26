// 临时（跑完删）：体检同步后的三组对照——合法转生档必须全绿（旧版会假红）、脏档必须被抓
import { createPinia, setActivePinia } from 'pinia'
globalThis.document = { addEventListener() {}, visibilityState: 'visible' }
globalThis.window = undefined
const store = new Map()
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }

setActivePinia(createPinia())
const { usePlayerStore } = await import('../../src/stores/player.js').then((m) => m)
const { inspectSave, summarizeInspection } = await import('../../src/game/dev/saveInspector.js')
const { ITEMS } = await import('../../src/game/data/items.js')
const { STACK_MAX } = await import('../../src/game/data/stackRules.js')

const player = usePlayerStore()
let pass = 0, fail = 0
const check = (name, cond, detail = '') => { if (cond) { pass++; console.log('  ok ' + name + (detail ? ' — ' + detail : '')) } else { fail++; console.log('FAIL ' + name + ' ' + detail) } }
const labelOk = (rows, frag) => rows.find((r) => r.label.includes(frag))?.ok

// ── 组1：普通新档 → 全绿 ──
player.gold = 500
let r = summarizeInspection(inspectSave(player))
check('组1 新档全绿', r.bad === 0, `${r.bad}/${r.total} 项异常：${r.badRows.map((x) => x.label).join('; ')}`)

// ── 组2：合法转生满档（旧版会假红的三处） → 全绿 ──
for (const id of Object.keys(player.skills)) { player.skills[id].level = 120; player.skills[id].prestiges = 3; player.skills[id].exp = 0 }
player.inventoryCap = 3232
player.coldStorageCap = 170
player.bankCap = 0
r = summarizeInspection(inspectSave(player))
check('组2 转生满档全绿（lv120 + 厨藏 3232 不再假红）', r.bad === 0, `${r.bad}/${r.total}：${r.badRows.map((x) => x.label + ' ' + x.detail).join('; ')}`)
const rows2 = inspectSave(player)
check('组2 等级行文案含「转生档 1~120」', rows2.some((x) => x.label.includes('转生档 1~120')))
check('组2 厨藏行文案含 120~3232', rows2.some((x) => x.label.includes('120~3232')))

// ── 组3：脏档必须被抓 ──
player.skills.foraging.level = 121 // 转生档上限 120
r = summarizeInspection(inspectSave(player))
check('组3a 等级 121(转生) 被抓', r.badRows.some((x) => x.label.includes('技能等级')))
player.skills.foraging.level = 101
player.skills.foraging.prestiges = 0 // 未转生却 101 级
r = summarizeInspection(inspectSave(player))
check('组3b 未转生 101 级被抓（cap=100）', r.badRows.some((x) => x.label.includes('技能等级')))
player.skills.foraging.prestiges = 3
player.skills.foraging.level = 120
// 堆叠：超 100 亿
const stackId = Object.keys(ITEMS).find((k) => ITEMS[k].type !== 'spirit' && ITEMS[k].type !== 'equipment')
player.inventory[stackId] = STACK_MAX + 1
r = summarizeInspection(inspectSave(player))
check('组3c 数量超 100 亿被抓', r.badRows.some((x) => x.label.includes('堆叠上限')), r.badRows.find((x) => x.label.includes('堆叠'))?.detail)
delete player.inventory[stackId]
// 堆叠：有词条装备数量 > 1
const equipId = Object.keys(ITEMS).find((k) => ITEMS[k].type === 'equipment')
if (equipId) {
  player.gearMods[equipId] = { mods: [{ kind: 'atk', value: 1 }] }
  player.inventory[equipId] = 5
  r = summarizeInspection(inspectSave(player))
  check('组3d 有词条装备 ×5 被抓（上限 1）', r.badRows.some((x) => x.label.includes('堆叠上限')), r.badRows.find((x) => x.label.includes('堆叠'))?.detail)
  delete player.inventory[equipId]
  delete player.gearMods[equipId]
} else { console.log('  (skip 3d: no equipment item)') }
// 容量脏值
player.inventoryCap = 99999
r = summarizeInspection(inspectSave(player))
check('组3e 厨藏容量 99999 被抓', r.badRows.some((x) => x.label.includes('厨藏容量')))
player.inventoryCap = 3232

console.log(`\n${fail ? 'FAIL' : 'ALL PASS'} (${pass})`)
process.exit(fail ? 1 : 0)
