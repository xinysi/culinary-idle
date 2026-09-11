// 信箱（2026-09-11 新增）— 平台级投递通道：把「会静默丢失的东西」兜住，并把一次性的结算明细留档。
//
// 三条投递来源（都不改动任何固定数据与既有奖励发放路径）：
//   ① overflow：背包已满（新物品种类放不下）或达堆叠上限时，**没发出去的那部分**转存邮箱，随时可领回。
//      这是纯粹的兜底——改前这些物品会被静默丢弃（gainItem 返回 false，调用方大多不看返回值）。
//   ② offline ：离线结算回执。奖励仍由 settleOffline 照原样发放，邮件只是**明细留存**
//      （离线弹窗一关，之前的产出就再也查不到了）。
//   ③ welcome ：新档欢迎信，纯说明、**不带附件**，不改动任何数值曲线。
//
// 信箱有容量上限：满了以后新增邮件会先淘汰「最旧的、无附件或附件已领」的一封；若全是未领附件则**拒收**
// （保留「背包容量不够就得扩容」的既有压力，不让信箱变成无限仓库）。

/** 信箱容量上限（封） */
export const MAIL_CAP = 60

/** 邮件来源标识（from 显示名 + icon） */
export const MAIL_FROM = {
  kitchen: { name: '厨房管家', icon: '🍳' },
  god: { name: '食神大人', icon: '✨' },
  system: { name: '山海司', icon: '🏔' },
}

/** 邮件类别（用于筛选与配色） */
export const MAIL_KINDS = {
  overflow: { label: '溢出转存', icon: '📦' },
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
