// 等级台阶（2026-09-29 立）——**大后期每 2 级一个「非物品满足点」**。
//
// 起因（成长曲线体检）：本作的内容密度**方向与 Melvor 相反** —— Melvor 越后期越密（采矿每件跨 14.5→2.6 级），
// 本作多数线早期很密、后期变疏（采摘 0.3→1.7 级/件、挖掘 1.25→5.0），**而 Lv101-120 这 20 级一个新目标都没有**。
// 补「新物品」要美术（每件图都要过目 + 图鉴三查），所以先给一条**零美术**的路：
// 在 82~120 段每 2 级放一个**看得见的目标**（一个称号 + 技能页上的「下一档」提示）。
//
// 设计口径（三条都是刻意的）：
//   · **全部派生**：`level >= perk.level` 即达成 ⇒ **不进存档、不需要「已领取」账本**
//     （本项目明确偏好「派生值不进存档」；一次性奖励就必须加账本，所以这里**不发一次性金币/券**）。
//   · **只给称号，不给数值**：称号是纯收藏（称号页可见、可佩戴，不带被动）。
//     🔴 曾考虑同时给「精通池上限 +2%/档」，**放弃了**：池上限的口径要穿过
//     `masteryPoolCap / masteryPoolPct / masteryPoolTierIndex / masteryPoolBonus / nextMasteryPoolTier`
//     五个函数与 18 处调用点，漏一处就是「显示一个上限、按另一个上限结算」——本项目最忌的显示与结算不一致；
//     而它换来的只是一点温和的产出/成功率。**要做就该整体穿参 + 逐处断言，是独立一件事。**
//   · **可见的目标**才算满足点：技能页在等级旁显示「下一档台阶：Lv84 · 刀工纯熟（还差 2 级）」，
//     达成时推一条日志 —— 这才是「荒漠段里还有东西可看」。
export const LEVEL_PERK_START = 82
export const LEVEL_PERK_STEP = 2
export const LEVEL_PERK_END = 120

/** 称号名（按档位顺序取；20 个，中式递进） */
const TITLE_POOL = [
  '小成之厨', '刀工纯熟', '火候在握', '五味调和', '食材知己',
  '灶前一刻', '宴客不慌', '百味通透', '掌勺如飞', '厨心已定',
  '山海入味', '食气盈门', '刀火双绝', '五味归元', '灶君青睐',
  '食神之影', '御前掌勺', '万家之味', '山海同席', '食神临灶',
]

/** 等级台阶表（派生：Lv82 / 84 / … / 120，共 20 档） */
export const LEVEL_PERKS = Array.from(
  { length: Math.floor((LEVEL_PERK_END - LEVEL_PERK_START) / LEVEL_PERK_STEP) + 1 },
  (_, i) => ({
    level: LEVEL_PERK_START + i * LEVEL_PERK_STEP,
    title: TITLE_POOL[i] ?? `等级 Lv${LEVEL_PERK_START + i * LEVEL_PERK_STEP}`,
  }),
)

/** 该等级恰好命中的台阶（命中时推一条日志） */
export function levelPerkAt(level) {
  const lv = Number(level)
  if (!Number.isFinite(lv)) return null
  return LEVEL_PERKS.find((p) => p.level === lv) ?? null
}

/** 该等级（含）以下已获得的台阶（派生，不查存档） */
export function levelPerksReached(level) {
  const lv = Number(level)
  if (!Number.isFinite(lv) || lv < LEVEL_PERK_START) return []
  return LEVEL_PERKS.filter((p) => p.level <= lv)
}

/** 下一档台阶（已全部达成返回 null）——技能页用它显示「还差几级」 */
export function nextLevelPerk(level) {
  const lv = Number(level)
  if (!Number.isFinite(lv)) return LEVEL_PERKS[0]
  return LEVEL_PERKS.find((p) => p.level > lv) ?? null
}

/** 全部等级称号名（称号页 / 守卫的「总量」口径从这里数） */
export function levelTitleNames() {
  return LEVEL_PERKS.map((p) => p.title)
}