// 日历口径总出入口（2026-09-26 立）—— **全站所有「今天 / 本周 / 周期相位」都必须走这里**。
//
// 🔴 为什么要收口：审计时发现同一天里并存 **四种** 周算法、两种锚点：
//   · 每日（`player._todayStr` / `cardBattle.todayKey`）= 本地日期 ✓ 但**两份实现**
//   · 周常任务 `player._weekNum` = `floor(Date.now()/7天)`  ⇒ 锚在 **周四 00:00 UTC**（国内玩家：周四早八点换周）
//   · 厨具大赛 `gearContest.contestWeek` = 与上面**同一算法、另一份实现**
//   · 名厨 `chefChallenge.week` = 又是同一算法的第三份
//   · 美食讲堂问答 `TriviaView.weekKey` = `(now − Date.UTC(今年,0,1))/7天` ⇒ 第四种（还与元旦那周不对齐）
//   · 赛季 `activeSeasonId` / `seasonRemainingMs`、宿敌 `monthIndexOf` = **Unix 纪元**锚点（同样落在 UTC 午夜）
//   后果：日重置在本地午夜、周重置在周四早八点、赛季在早八点 —— 玩家看到的「一天/一周/一季」边界互相错开。
//
// 🔴 本模块的口径（2026-09-26 用户「一起做」批准统一）：**一切边界落在本地时间的午夜**。
//   · `todayKey` = 本地 `YYYY-MM-DD`（与旧的 `toLocaleDateString('en-CA')` 逐字等价 ⇒ **存档里的每日键不变**）
//   · `weekNum(now)` = 「`now` 所在那周的**本地周一**」距纪元的天数（整数，只在本地周一 00:00 变）
//   · `localAligned(now)` = 把时间轴平移到本地 ⇒ 给「按整周期取模」的赛季/宿敌用，让周期边界也落在本地午夜
//   ⚠️ 周键从「周四 UTC」换到「周一本地」⇒ 存档里的 `weekly.week` / `challenge.week` / `gearContest.week` /
//      `chefChallenge.week` 会与新算法**不相等** ⇒ 那几项**当周进度一次性归零**（本来每周也要归零，可接受；
//      所有按 `week` 判定的地方都是「不等就重置」，不会报错）。
//   ⚠️ 赛季只动**锚点**（相位平移），不动任何赛季数据（时长/档位/任务/主题仍是铁律层）；宿敌同理。

/** 本地时区相对 UTC 的偏移毫秒（含夏令时；东八区 = +8h） */
export function localOffsetMs(now = Date.now()) {
  return -new Date(now).getTimezoneOffset() * 60_000
}

/** 把 `now` 平移到「本地时间轴」：周期边界据此落在本地午夜（供赛季 / 宿敌这类整周期取模的用） */
export function localAligned(now = Date.now()) {
  return now + localOffsetMs(now)
}

/** 本地日期键 `YYYY-MM-DD`（= 旧的 `toLocaleDateString('en-CA')` 口径，存档里的每日键不变） */
export function todayKey(now = Date.now()) {
  const d = new Date(now)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** `now` 所在周的**本地周一 00:00**（Date 对象） */
export function weekStart(now = Date.now()) {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // getDay: 周日=0 ⇒ 周一=0 … 周日=6
  return d
}

/** 周序号（整数）：= 本地周一那天距纪元的天数。**只在本地周一 00:00 变**（存档里存的是这个数） */
export function weekNum(now = Date.now()) {
  return Math.floor(weekStart(now).getTime() / 86_400_000)
}

/** 周键（字符串，给展示/日志用）：本地周一的 `YYYY-MM-DD` */
export function weekKey(now = Date.now()) {
  return todayKey(weekStart(now).getTime())
}

/**
 * 下一个**本地周一 00:00** 的绝对时间戳（给「距换周还有 X」的倒计时用）。
 * ⚠️ 别自己写 `7*86400000 - Date.now() % (7*86400000)`：那套算法锚在 UTC 纪元、算出来的换周时刻是对的
 * 才怪（本项目统一前有两处就是这么写的）。要算就用这个 —— 与 `weekNum` 同源。
 */
export function nextWeekStartMs(now = Date.now()) {
  return weekStart(now).getTime() + 7 * 86_400_000
}
