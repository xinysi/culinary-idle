// 传闻 · 轶事 —— 美食大陆的传说碎片（§13）
// 与主线章节互补：每篇按玩家进度解锁（unlock.kind 与故事进度 kind 一致，见 LogView.storyCur）。

export const TALES = [
  {
    id: 'tale_foodie',
    title: '饕餮之影',
    unlock: { kind: 'bosses', need: 3 },
    body: '太古年间，饕餮借一缕贪念堕入人间，将整座膳坊的滋味吞入腹中。众厨以二十八星为引、以五味为阵，将它封印于失落的食塔。可每当你击败一位强敌，总有人低语：那影子，又动了一下。',
  },
  {
    id: 'tale_star',
    title: '二十八星坠的传说',
    unlock: { kind: 'collection', need: 25 },
    body: '相传天上有二十八颗「食星」，各掌一味。星坠之夜，它们化作大陆上的二十八处秘境，藏起二十七件至味之宝。集齐星坠之人，能听见星空在锅气里低吟的古老菜谱。',
  },
  {
    id: 'tale_twins',
    title: '食神的双生子',
    unlock: { kind: 'prestiges', need: 1 },
    body: '初代食神有两位传人：一位执刀问鼎、一位拈勺生香。二人比试百年未分高下，遂将毕生所学一分为二——一脉留下「刀工流」，一脉留下「摆盘流」。而它们的宿敌「调味流」，则来自第三位不为人知的影子厨神。',
  },
  {
    id: 'tale_contract',
    title: '契约的低语',
    unlock: { kind: 'card', need: 5 },
    body: '你掌中的《食之契约》并非死物。每当你赢得一场卡牌对决，它的书页便会自行翻动，浮现一行字：你比前五位执笔人都更懂得尊重食材。',
  },
  {
    id: 'tale_spirit',
    title: '隐世的食灵',
    unlock: { kind: 'spirits', need: 3 },
    body: '食灵是食材之魂。它们并非神明，只是曾被某位厨师的匠心打动、甘愿随侍左右的知己。传说集齐七星食灵，能召唤传说中的「灶神」——不过那老神仙，只肯为愿意试吃失败作品的厨子现身。',
  },
  {
    id: 'tale_forbidden',
    title: '太古禁食',
    unlock: { kind: 'totalLevel', need: 500 },
    body: '大陆禁忌菜单上，排着三道从未被做成的菜：用「时间的余味」炖的汤、以「思念为引」调的酱、还有……以「某个厨师的执念」为料的主菜。据说做出之人，会永远被写进美食的传说，成为下一道「太古禁食」。',
  },
]

// ── 轶事分类统计（2026-09-10 修复）──
// 轶事（QUIRKS，3588 条）按「大类 → 子类（技能）」两级分类统计，页面与测试共用同一份实现。
// 修复的缺陷：原实现 `defs` 用 `{...c}` 建了副本，而 `defById` 映射到 QUIRK_CAT_DEFS 的**原对象**，
// 循环把计数写进原对象、模板读的却是副本 → 四个大类标签恒显示 0/0（自首个版本起就存在）。
export const QUIRK_CAT_DEFS = [
  { id: 'gather', name: '采集', icon: '🌿' },
  { id: 'craft', name: '制作', icon: '🍳' },
  { id: 'combatWins', name: '对决', icon: '⚔️' },
  { id: 'support', name: '辅助', icon: '📜' },
]

/**
 * @param {Array} list 轶事列表（QUIRKS）
 * @param {(q) => boolean} isUnlocked 单条解锁判定
 * @returns {{ defs: Array<{id,name,icon,total,unlocked}>, subMap: Map<string,{sub,total,unlocked}> }}
 *          大类顺序与 QUIRK_CAT_DEFS 一致；subMap 键为 `cat|sub`
 */
export function quirkCategoryStats(list, isUnlocked = () => false) {
  const defs = QUIRK_CAT_DEFS.map((c) => ({ ...c, total: 0, unlocked: 0 }))
  // 必须映射到 defs 里的同一批对象（再建副本会让计数写丢）
  const byId = new Map(defs.map((c) => [c.id, c]))
  const subMap = new Map()
  for (const q of list) {
    const ok = !!isUnlocked(q)
    const d = byId.get(q.cat)
    if (d) {
      d.total++
      if (ok) d.unlocked++
    }
    const key = q.cat + '|' + q.sub
    let sub = subMap.get(key)
    if (!sub) {
      sub = { sub: q.sub, total: 0, unlocked: 0 }
      subMap.set(key, sub)
    }
    sub.total++
    if (ok) sub.unlocked++
  }
  return { defs, subMap }
}
