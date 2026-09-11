// 信箱（2026-09-11 新增；同日放宽，见设计文档 §11.17）— 平台级投递通道：
// 把「会静默丢失的东西」兜住、把一次性结算明细留档，并承接**系统奖励的到账**。
//
// 四类投递来源：
//   ① overflow：背包已满（新物品种类放不下）或达堆叠上限时，**没发出去的那部分**转存邮箱，随时可领回。
//      改前这些物品会被静默丢弃（gainItem 返回 false，调用方大多不看返回值）。
//   ② offline ：离线结算回执。奖励仍由 settleOffline 照原样发放，邮件只是**明细留存**。
//   ③ welcome ：新档欢迎信，纯说明、**不带附件**，不改动任何数值曲线。
//   ④ reward  ：**系统奖励到账**（2026-09-11 放宽后新增）。目前用于赛季档位：领档即记账（`claimed` 立刻标记，
//      赛季进度与成就语义不变），奖励改为**以邮件到账**，玩家到信箱一起领。这是「信箱从『只兜底』
//      扩成『兜底 + 统一到账』」的那一步；金币类不占背包格、必然能领，物品类背包满时也先安全存着。
//
// 容量语义（放宽后）：软上限 MAIL_CAP 只淘汰「已领/无附件」的旧邮件；**全是未领附件时不再拒收**，
// 继续累积到硬上限 MAIL_HARD_CAP 为止。配合「溢出邮件按物品合并」，封数≈有溢出的物品种类数。
// 之所以敢不设拒收：信箱里的东西**不能使用**，不构成额外存储空间，只是「暂时取不走」的缓冲，
// 不会消解背包扩容的意义；而拒收的代价是**物品真的蒸发**——那正是信箱本要解决的毛病。

/**
 * 信箱容量（2026-09-11 放宽，见设计文档 §11.17）
 * - `MAIL_CAP`：软上限。达到它时**只淘汰最旧的「已领或无附件」邮件**；若一封可淘汰的都没有（全是未领附件），
 *   **继续收下、不再拒收**——这是本次放宽的核心：改前「60 封全是未领附件就拒收」，实测会让物品真的蒸发。
 * - `MAIL_HARD_CAP`：硬保护上限，防止病态增长把存档撑爆。配合「溢出邮件按物品合并」，
 *   实际封数≈「有溢出且未领的不同物品种类数」，正常玩法远够不到。
 */
export const MAIL_CAP = 200
export const MAIL_HARD_CAP = 500

/** 邮件来源标识（from 显示名 + icon） */
export const MAIL_FROM = {
  kitchen: { name: '厨房管家', icon: '🍳' },
  god: { name: '食神大人', icon: '✨' },
  system: { name: '山海司', icon: '🏔' },
}

/** 邮件类别（用于筛选与配色） */
export const MAIL_KINDS = {
  overflow: { label: '溢出转存', icon: '📦' },
  reward: { label: '奖励到账', icon: '🎁' },
  offline: { label: '离线回执', icon: '🌙' },
  welcome: { label: '欢迎信', icon: '🎉' },
  system: { label: '系统', icon: '🏔' },
}

/** 类别显示名（未知类别回退到「系统」） */
export function mailKindLabel(kind) {
  return MAIL_KINDS[kind] ?? MAIL_KINDS.system
}

/** 新档欢迎信内容（纯文案，无附件） */
export const WELCOME_MAIL = {
  kind: 'welcome',
  from: 'god',
  subject: '欢迎来到食灵山海',
  body: [
    '远道而来的小厨，欢迎。',
    '',
    '这封信没有附件——只是想让你知道，往后凡是「本该属于你、却因为背包塞满而没放进去」的东西，',
    '都会转存到这里等你来取；每次离线挂机的结算明细，也会以回执的形式留在这里。',
    '',
    '左侧「今日」分组里的天气与吉祥物会每日刷新；任务中心能一页看全主线、每日、周常与每周挑战。',
    '祝你煮出好东西。',
  ].join('\n'),
}

/** 溢出转存邮件文案 */
export function overflowMailBody(itemLabel, qty) {
  return [
    `背包已满（或该物品已达堆叠上限），本次有 ${itemLabel} ×${qty} 没能放进去，已先替你收在这里。`,
    '',
    '腾出空间后点「领取」即可取回——不会过期。',
  ].join('\n')
}

/** 离线回执正文：由 bootstrap 传入已排版好的明细行 */
export function offlineMailBody(elapsedText, lines, restGold) {
  const body = [`本次离开 ${elapsedText}。`]
  if (lines.length) {
    body.push('', ...lines)
  }
  if (restGold > 0) {
    body.push('', `餐厅离线收入：${restGold.toLocaleString()} 金币（80% 效率）`)
  }
  body.push('', '以上产出已在结算时直接发放，本邮件仅作明细留存。')
  return body.join('\n')
}
