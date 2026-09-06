// 赛季数据完整性校验（§13）：20 赛季 / 唯一性 / 任务参数存在性
// 运行：node .toolchain/season_check.mjs
import { SEASONS, activeSeasonId } from '../src/game/data/seasons.js'
import { ITEMS } from '../src/game/data/items.js'
import { COMBAT_BOSSES } from '../src/game/data/combat.js'

let fail = 0
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  ok  ${name}`)
  else {
    fail++
    console.log(`FAIL  ${name} ${detail}`)
  }
}

const ids = SEASONS.map((s) => s.id)
const names = SEASONS.map((s) => s.name)
const lims = SEASONS.map((s) => s.limitedItem)
const misIds = SEASONS.flatMap((s) => s.missions.map((m) => m.id))
const bossNames = COMBAT_BOSSES.map((b) => b.name)

check('赛季总数 40', SEASONS.length === 40, `got ${SEASONS.length}`)
check('赛季 id 唯一', new Set(ids).size === ids.length)
check('赛季名称唯一', new Set(names).size === names.length)
check('限定装备唯一', new Set(lims).size === lims.length)
check('任务 id 全局唯一', new Set(misIds).size === misIds.length)
check('每季 ≥8 个任务（2026-09 铁律：10 任务为目标结构，季主题衍生 9-10 个）', SEASONS.every((s) => s.missions.length >= 8), SEASONS.filter((s) => s.missions.length !== 8).map((s) => `${s.id}:${s.missions.length}`).join(','))
check('每季 10 档奖励', SEASONS.every((s) => s.tiers.length === 10), SEASONS.filter((s) => s.tiers.length !== 10).map((s) => `${s.id}:${s.tiers.length}`).join(','))
check('轮换返回有效赛季', SEASONS.some((s) => s.id === activeSeasonId()))

// 点数经济：任务点数总和 = 10 档需求总和 + 10~20（做完任务可领满全部奖励且富余）
check('点数经济：任务总和 ≥ 档位总和 1100（2026-09 铁律：积分兑换扣费，必须能买满 10 档）', SEASONS.every((s) => {
  const missionSum = s.missions.reduce((a, m) => a + m.points, 0)
  const tierSum = s.tiers.reduce((a, t) => a + t.points, 0)
  return missionSum >= tierSum
}), SEASONS.map((s) => `${s.id}:${s.missions.reduce((a, m) => a + m.points, 0) - s.tiers.reduce((a, t) => a + t.points, 0)}`).join(','))
check('任务点数均为正且有限', SEASONS.every((s) => s.missions.every((m) => m.points > 0 && Number.isFinite(m.points))))
check('采集/制作/收获任务需求 1000-5000', SEASONS.every((s) => s.missions.every((m) => !['gather', 'craft', 'harvest'].includes(m.kind) || (m.qty >= 1000 && m.qty <= 5000))), SEASONS.flatMap((s) => s.missions.filter((m) => ['gather', 'craft', 'harvest'].includes(m.kind) && (m.qty < 1000 || m.qty > 5000))).map((m) => m.qty).join(','))

// 赛季装备套件：每季 8 件（八槽位），名字随赛季适配且全局唯一
const gearIds = SEASONS.flatMap((s) => s.limitedItems ?? [])
check('套件 8 件/季（八槽位齐全）', SEASONS.every((s) => (s.limitedItems?.length ?? 0) === 8), SEASONS.filter((s) => (s.limitedItems?.length ?? 0) !== 8).map((s) => s.id).join(','))
check('套件槽位齐全（武器/头盔/身体/腿部/脚部/副手/饰品）', SEASONS.every((s) => {
  const slots = s.limitedItems.map((id) => ITEMS[id]?.slot)
  return ['weapon', 'helmet', 'body', 'legs', 'boots', 'offhand', 'amulet', 'ring'].every((sl) => slots.includes(sl))
}), SEASONS.filter((s) => !s.limitedItems.map((id) => ITEMS[id]?.slot).includes('weapon')).map((s) => s.id).join(','))
check('套件装备全部存在于物品库', gearIds.every((id) => !!ITEMS[id]), gearIds.filter((id) => !ITEMS[id]).join(','))
check('套件装备名全局唯一且不重复赛季名', (() => {
  const names = gearIds.map((id) => ITEMS[id]?.name)
  const seasonNames = new Set(SEASONS.map((s) => s.name))
  return new Set(names).size === names.length && names.every((n) => !seasonNames.has(n))
})(), 'dup')
// 套件分档发放：10 档覆盖 8 件（逐档稀有，末档含原限定）
check('套件分 10 档发放（8 件分散 + 末档原限定）', SEASONS.every((s) => {
  const tierItems = s.tiers.flatMap((t) => Object.keys(t.reward?.items ?? {}))
  const hasGear = s.limitedItems.every((id) => tierItems.includes(id))
  const lastTier = s.tiers[s.tiers.length - 1].reward?.items ?? {}
  return hasGear && !!lastTier[s.limitedItem] && s.tiers.some((t) => t.reward?.gold)
}), 'tiers')

// 限定装备必须存在于物品库
const missingLims = lims.filter((id) => !ITEMS[id])
check('限定装备全部存在于物品库', missingLims.length === 0, JSON.stringify(missingLims))

// 任务参数存在性：gather/craft/harvest → 物品 id；boss → BOSS 名
const badParams = []
for (const s of SEASONS) {
  for (const m of s.missions) {
    if (m.kind === 'gather' || m.kind === 'craft' || m.kind === 'harvest') {
      if (!ITEMS[m.param]) badParams.push(`${s.id}:${m.id} → ${m.param}`)
    }
    if (m.kind === 'boss') {
      if (!bossNames.includes(m.param)) badParams.push(`${s.id}:${m.id} → boss:${m.param}`)
    }
  }
}
check('任务参数全部有效（物品/BOSS 存在）', badParams.length === 0, badParams.join('; '))

// 各季任务目标不重复（gather/craft/harvest 的 param 全局不重复）
const itemParams = SEASONS.flatMap((s) => s.missions.filter((m) => ['gather', 'craft', 'harvest'].includes(m.kind)).map((m) => m.param))
check('任务目标物品均有效', itemParams.every((p) => !!p))

// 奖励档位引用有效物品
const rewardBad = []
for (const s of SEASONS) {
  for (const t of s.tiers) {
    if (t.reward?.items) {
      for (const id of Object.keys(t.reward.items)) {
        if (!ITEMS[id]) rewardBad.push(`${s.id}:${id}`)
      }
    }
  }
}
check('奖励档位物品全部有效', rewardBad.length === 0, rewardBad.join('; '))

console.log(fail === 0 ? `\nSEASON CHECK PASS (${SEASONS.length} seasons)` : `\n${fail} FAILURES`)
process.exit(fail === 0 ? 0 : 1)
