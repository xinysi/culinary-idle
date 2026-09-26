// 新手目标链（2026-09-18，留存改进 ①）——把开局第一个 30 分钟塞满「看得见的小高潮」。
//
// 背景（同学反馈「没什么吸引人持续玩的点」）：项目有 54 个功能页、38 个技能，而新玩家的正反馈密度太低
// （第一次离线报告要等几小时、第一根胡萝卜看不见）。放置类留人的第一条就是「**看得到的下一根胡萝卜**」，
// 这份链条就是那根胡萝卜：20 个小目标、每个都有**即时奖励**，按典型开局顺序排列。
//
// 设计约束（改这个文件前先读）：
//  - **纯只读判定**：`check(p)` 只读既有 player 状态，不新增玩法、不改任何固定数据；
//  - **奖励只发一次**：由 `player.syncNewbieChain()` 按 `guide.claimed` 账本发放（幂等，见 C40）；
//  - **不许有死路 / 不许中途卡住**：判定是「从当前步往后逐条检查、逐条推进」，所以
//    **容易达成的必须排在前面**，长线目标（紫装 / 1 万金币）放最后 —— 否则第 5 步卡住，后面全都不动；
//  - 奖励只用**既有物品 id**，金额刻意压小（它是即时反馈，不是经济来源）。
//
// 奖励合计约 6.4k 金币 + 少量 1~3 档食材 + 一件白装 + 一张饼干；相对开局经济是「明显但不破坏平衡」。
import { getItem } from './items.js'

/** 每步：{ id, label, where, view, find, reward: { gold?, items? }, check(p) }
 *
 *  `find` = 「玩家会去找的那几个字」+ 预期位置，**是给界面实测脚本用的**（`scripts/measure/ui_cost.mjs`）：
 *  它在新档状态下真的去界面里找这几个字，量出「要点几下／要不要展开分组／在不在首屏／候选有多少个」，
 *  再按 Hick 定律折算成模拟器的「寻找成本」秒数（不再是手填）。改 `find` 后请重跑那个脚本。*/
export const NEWBIE_STEPS = [
  {
    // ⚠️ 目标必须挑**能做菜**的原料：③「做一道菜」最便宜的配方是「烤土豆」（土豆×2），
    // 而土豆来自**挖掘**（Lv1）。原先这里写「技能页 · 采摘」——照它挂采摘的玩家永远做不出菜、
    // 链子卡在③（2026-09-18 模拟器跑出来的真 bug，真人测试前就修掉了）。
    id: 'n01', label: '① 选一个挂机目标开始采集（推荐「挖掘 · 土豆」，下一步要拿它做菜）', where: '技能页 · 挖掘', view: 'skill',
    find: { key: '挖掘', expect: 'sidebar' },
    reward: { gold: 100, items: { apple: 3 } },
    check: (p) => Object.keys(p.skillTargets ?? {}).length > 0,
  },
  {
    id: 'n02', label: '② 收到第一批产出', where: '技能页 · 产出面板', view: 'skill',
    find: { key: null, expect: 'none' }, // 被动：不需要找入口（判定是「收到产出」）
    reward: { gold: 100, items: { wheat: 3 } },
    check: (p) => Object.keys(p.collected ?? {}).length >= 2,
  },
  {
    id: 'n03', label: '③ 做一道菜（烹饪 / 烘焙）', where: '技能页 · 烹饪', view: 'skill',
    find: { key: '烹饪', expect: 'sidebar' },
    // 🔴 **武器必须在这一步给**（2026-09-26 实测后从 n04 前移）：本链第 ④ 步是「赢下第一场对决」，
    //    而**空手打第一场是打不过的** —— 真新档（100 金 / 0 物品 / 无装备）打「灶台学徒」实测
    //    胜率 **0%**（400 场 0 胜）、单场 13 回合 ≈32 秒；只带 ③ 原本那 2 份烤土豆也只有 **49%**
    //    （抛硬币，且单场 55 秒）。把铜刀提前到这一步后：同一场 **100%**、10 回合 ≈25 秒
    //    ⇒ ④ 才真的是「教你打赢」，而不是抽奖。
    //    ⚠️ 别改回去。要动这里的顺序/奖励，先跑 `scripts/sim/first_fight.mjs`（常驻实测工具）：
    //    「先对决、再装备」在**数值上**不成立，链头原本担心的「靠运气或锻造凑装备」由**任务直接发这把刀**解决
    //    —— 既不靠运气也不靠肝。
    reward: { gold: 150, items: { roastPotato: 2, copperKnife: 1 } },
    check: (p) => Object.keys(p.storyProgress ?? {}).some((k) => k.startsWith('craft:')),
  },
  // ⚠️ 顺序仍是**先对决、再装备**（④ 打赢 → ⑤ 穿上）。第一件装备的**后续**来源是区域 1 对手的掉落
  //    （铜刀/铜锅/铜砧板，各 3%）；但**第一把刀**由 ③ 直接发（理由见上面 n03 的注释）。
  {
    id: 'n04', label: '④ 赢得第一场料理对决', where: '技能页 · 对决', view: 'skill',
    find: { key: '对决', expect: 'sidebar' },
    reward: { gold: 200, items: { roastPotato: 2 } }, // = 下一场的干粮（武器已在 ③ 发过，重复发没有意义）
    check: (p) => (p.stats?.combatWins ?? 0) > 0,
  },
  {
    id: 'n05', label: '⑤ 穿上第一件装备（铜刀，或对决掉落）', where: '顶栏 · ⚔️装备', view: 'skill',
    find: { key: '装备', expect: 'topnav' },
    reward: { gold: 200, items: { apple: 5 } },
    check: (p) => Object.values(p.equipment ?? {}).filter(Boolean).length >= 1,
  },
  {
    id: 'n06', label: '⑥ 同时开第二条挂机线（多技能并行）', where: '技能页 · 再选一个目标', view: 'skill',
    find: { key: '挖掘', expect: 'sidebar' },
    reward: { gold: 200, items: { carrot: 3 } },
    check: (p) => Object.keys(p.skillTargets ?? {}).length >= 2,
  },
  {
    id: 'n07', label: '⑦ 摆上餐厅菜单，让餐厅开始赚钱', where: '顶栏 · 🏮 餐厅', view: 'restaurant',
    find: { key: '餐厅', expect: 'topnav' },
    reward: { gold: 250, items: { rice: 3 } },
    check: (p) => (p.restaurant?.menu ?? []).length >= 1,
  },
  {
    id: 'n08', label: '⑧ 打卡竞技场（和其他玩家镜像过一招）', where: '顶栏 · 竞技场', view: 'arena',
    find: { key: '竞技场', expect: 'topnav' },
    reward: { gold: 250, items: { trap: 3 } },
    check: (p) => (p.stats?.arena?.wins ?? 0) + (p.stats?.arena?.currentStreak ?? 0) > 0,
  },
  {
    id: 'n09', label: '⑨ 加入一个公会', where: '顶栏 · 公会', view: 'guild',
    find: { key: '公会', expect: 'topnav' },
    reward: { gold: 250, items: { tomato: 3 } },
    check: (p) => !!p.guild?.id,
  },
  {
    // ⚠️ 阈值别定在「被动挂机的刀刃上」：模拟器实测 30 分钟 / 5 条挂机线只到 14 种，
    // 原来写 15 就正好卡死所有人（2026-09-18）。8 是稳稳能过的线。
    id: 'n10', label: '⑩ 图鉴收集到 8 种', where: '顶栏 · 📖 图鉴', view: 'log',
    find: { key: '图鉴', expect: 'topnav' },
    reward: { gold: 300, items: { corn: 3 } },
    check: (p) => Object.keys(p.collected ?? {}).length >= 8,
  },
  {
    id: 'n11', label: '⑪ 看一眼赛季，把能领的奖励领掉', where: '顶栏 · 🎪 赛季', view: 'season',
    find: { key: '赛季', expect: 'topnav' },
    reward: { gold: 300, items: { wheat: 5 } },
    check: (p) => Object.values(p.seasons ?? {}).some((s) => (s?.claimed?.length ?? 0) > 0),
  },
  {
    id: 'n12', label: '⑫ 招待一位常客', where: '左侧栏 · 常客', view: 'regulars',
    find: { key: '常客', expect: 'sidebar' },
    reward: { gold: 350, items: { milk: 3 } },
    check: (p) => Object.values(p.regulars ?? {}).some((r) => (r?.serves ?? 0) > 0),
  },
  {
    id: 'n13', label: '⑬ 派一支远行采集队（挂机也能拿稀有物）', where: '左侧栏 · 采集队（需该采集技能 12 级）', view: 'expedition',
    find: { key: '采集队', expect: 'sidebar' },
    // 门槛 2026-09-18 由 25 降到 12（见 expeditions.js）：第一场就能见到，所以不再算长线
    reward: { gold: 400, items: { saltOre: 2 } },
    check: (p) => Object.values(p.expeditions ?? {}).some((e) => (e?.completions ?? 0) > 0 || (e?.slots ?? []).some(Boolean)),
  },
  {
    id: 'n14', label: '⑭ 累计赚到 1,500 金币', where: '左栏「功能」→ 采买与转化 · 商店 / 顶栏 · 餐厅', view: 'shop',
    find: { key: '商店', expect: 'sidebar' },
    reward: { gold: 350, items: { cabbage: 3 } },
    check: (p) => (p.stats?.totalGoldEarned ?? 0) >= 1500,
  },
  {
    id: 'n15', label: '⑮ 洗练一次装备词条', where: '顶栏 · ⚔️装备 · 洗练', view: 'skill',
    find: { key: '洗练', expect: 'modal' },
    reward: { gold: 400, items: { onion: 3 } },
    check: (p) => Object.keys(p.gearMods ?? {}).length > 0,
  },
  {
    id: 'n16', label: '⑯ 强化一次装备', where: '顶栏 · ⚔️装备 · 强化', view: 'skill',
    find: { key: '强化', expect: 'modal' },
    reward: { gold: 450, items: { ironKnife: 1 } },
    check: (p) => Object.values(p.upgrades ?? {}).some((v) => (v ?? 0) > 0),
  },
  {
    id: 'n17', label: '⑰ 图鉴收集到 20 种', where: '顶栏 · 📖 图鉴', view: 'log',
    find: { key: '图鉴', expect: 'topnav' },
    reward: { gold: 500, items: { mushroom: 3 } },
    check: (p) => Object.keys(p.collected ?? {}).length >= 20,
  },
  {
    id: 'n18', label: '⑱ 在「美食探索」技能里派出一次', where: '技能页 · 美食探索', view: 'skill',
    find: { key: '美食探索', expect: 'sidebar' },
    reward: { gold: 550, items: { mysterySpice: 1 } },
    check: (p) => (p.stats?.explorations ?? 0) > 0,
  },
  {
    id: 'n19', label: '⑲ 累计赚到 10,000 金币', where: '左栏「功能」→ 采买与转化 · 商店 / 顶栏 · 餐厅', view: 'shop',
    find: { key: '商店', expect: 'sidebar' },
    reward: { gold: 700, items: { potato: 3 } },
    check: (p) => (p.stats?.totalGoldEarned ?? 0) >= 10000,
  },
  // ⚠️ 最后一步是**长线**（`long: true`）：稀有及以上品质的装备要靠首领掉落 / 锻造 / 觅珍，
  // 不是几十分钟能到的。放在链尾当「看得见但还够不着的胡萝卜」。
  // C40 断言 `long` 步只能在链尾两步 —— 否则链子在中间被卡死，后面十几步**永远不显示**。
  {
    id: 'n20', label: '⑳（长线）拿到第一件稀有及以上品质的装备', where: '技能页 · 锻造 / 首领掉落 / 觅珍', view: 'skill',
    find: { key: '锻造', expect: 'sidebar' },
    long: true,
    reward: { gold: 1000, items: { energyBiscuit: 1 } },
    check: (p) => Object.values(p.equipment ?? {}).some((id) => id && ['稀有', '史诗', '传说', '神话'].includes(getItem(id)?.quality ?? '')),
  },
]

/** 步骤总数 */
export const NEWBIE_TOTAL = NEWBIE_STEPS.length

/** 按 id 取步骤 */
export function newbieStep(id) {
  return NEWBIE_STEPS.find((s) => s.id === id) ?? null
}

/** 奖励文案（横幅与日志共用）：{ gold: 200, items: { apple: 3 } } → "200 金币 + 苹果×3" */
export function rewardText(reward) {
  if (!reward) return ''
  const parts = []
  if (reward.gold) parts.push(`${reward.gold} 金`) // 横幅一行放得下：金币 → 金
  for (const [id, qty] of Object.entries(reward.items ?? {})) parts.push(`${getItem(id)?.name ?? id}×${qty}`)
  return parts.join(' + ')
}
