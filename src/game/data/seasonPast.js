// 往季赛季件的**第二条获取路径**（2026-09-29 立）——把「560 天日历门」变成努力门。
//
// 🔴 **为什么需要它**：40 季 × 10 件 = **400 件赛季限定**，而**每季最多领 10 档** ⇒ 无论计数口径怎么改，
//    集齐 400 件都要 **40 季 = 560 天真实时间**，努力无法缩短（`docs/毕业口径说明.md` §2 的「时间门」）。
//    对照两个参照作：Rocky Idle 的产物里**没有任何日历机制**、Melvor 的完成度是纯努力门
//    ⇒ **这是本作唯一一处「比参照作更劝退」的设计**。
//    故事那边 2026-09-19 已靠「累计次数」去了门（需求 8 < 单季容量 10）；这里需求 400 > 容量 10×40，
//    所以**只能靠第二条获取路径**：花金币补领往季的**限定装备档位**。
//
// 口径（三条刻意的约束）：
//   · **只对往季**：当季仍走赛季点数（积分兑换语义，不改）。
//   · **只对「含限定装备」的档位**：其余档位给的是金币/消耗品，花钱买它们在语义上是「金币换金币」，没意义。
//   · **买到手就记进 `claimed`**：所以补领同样推进「累计领奖次数」的成就/任务口径（与正常领奖同源），
//     而且**不能重复买**（`claimed` 里有就不让买）。
//
// 💰 价格：**5 万金/档** ⇒ 全收集 360 档 ≈ **1800 万金币**，对标满配后期收入（约 138 万/小时）≈ **13 小时**。
//    参照现有金币出口的量级：洗练 400~30,000 金/次、觅珍 80 金/抽。想更贵就改这一个常数。
import { SEASONS_GEAR } from './expansion_gear.js'

/** 补领一件（= 一个含限定装备的档位）的价格（金币，唯一出口） */
export const PAST_SEASON_GEAR_PRICE = 50000

/** 某季的**限定装备 id 集合**（limitedItem 1 件 + 赛季套 8 件） */
export function seasonGearIds(season) {
  const out = new Set()
  if (season?.limitedItem) out.add(season.limitedItem)
  const set = SEASONS_GEAR.find((g) => g.seasonId === season?.id)
  for (const id of set?.slots ?? []) out.add(id)
  return out
}

/**
 * 某季**可补领的档位**：`[{ index, itemIds, name }]` —— 只含「奖励里有该季限定装备」的那些档。
 * ⚠️ **一档可能含 2 件装备**（实测 40 季都是 5 个装备档覆盖 9 件：档 2/4/6/8/9），价格是**每档**的
 *    ⇒ 列表要把**该档全部装备 id** 交出去（只给首件会让玩家按第二件的名字搜不到），但**一行仍是一档**。
 * `name` 取档位自己的 `name`（当前 40 季都没写 ⇒ 界面回落成「第 N 档」）。
 */
export function seasonGearTiers(season) {
  const gear = seasonGearIds(season)
  const out = []
  for (const [index, tier] of (season?.tiers ?? []).entries()) {
    const itemIds = Object.keys(tier?.reward?.items ?? {}).filter((id) => gear.has(id))
    if (!itemIds.length) continue
    out.push({ index, itemIds, name: tier.name ?? null })
  }
  return out
}

/**
 * 全站**还没拿到**的往季限定装备档位（供界面列清单）：
 * `[{ seasonId, seasonName, index, itemIds, name }]`
 * 跳过：当季 · **该季里已领过的档**（自然领奖或已补领都算 —— 买到就记进 `claimed`，所以**买完立刻从清单消失**，
 * 不必等玩家去信箱取件）· 装备**全部已拥有**的档（部分拥有仍可买：那一档给的是整包）。
 * `seasonStates` 传 `player.seasons`；缺省 `{}` 时退化成「只看已拥有」（结算侧另有 `claimed` 检查兜底，不会重复卖）。
 */
export function pastSeasonGearToClaim(seasons, currentSeasonId, owned = {}, seasonStates = {}) {
  const out = []
  for (const season of seasons ?? []) {
    if (!season || season.id === currentSeasonId) continue
    const claimed = seasonStates?.[season.id]?.claimed ?? []
    for (const t of seasonGearTiers(season)) {
      if (claimed.includes(t.index)) continue
      if (t.itemIds.every((id) => owned[id])) continue
      out.push({ seasonId: season.id, seasonName: season.name, ...t })
    }
  }
  return out
}