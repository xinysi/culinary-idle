// 随机奇遇 — 挂机途中偶发事件（2026-09-06 长线日活钩子）
// 触发：在线采集/制作动作 0.2% 概率（bootstrap 监听 skill:action），弹窗 3 选 1。
// 效果：gold 为基准（领取时按对决等级放大），item 为固定物品 id。纯新增层，不触碰铁律数据。

export const ENCOUNTERS = [
  {
    id: 'wanderer',
    title: '🗺️ 迷路的旅人',
    body: '一位风尘仆仆的旅人在你摊位前停下：「我沿着香味走了二十里……能告诉我这是什么菜吗？」',
    choices: [
      { label: '请他尝一口（开朗）', effect: { gold: 120, item: null } },
      { label: '指个路（善良）', effect: { gold: 40, items: { apple: 5 } } },
      { label: '不予理会（冷漠）', effect: { gold: 20 } },
    ],
  },
  {
    id: 'connoisseur',
    title: '🥢 神秘食客',
    body: '一个戴斗笠的人吃完了你做的菜，放下钱袋默默走出门。留下一句话：「后生可畏。」',
    choices: [
      { label: '追上去讨教', effect: { gold: 180 } },
      { label: '收起钱袋继续干活', effect: { gold: 90, items: { wheat: 10 } } },
    ],
  },
  {
    id: 'merchant',
    title: '💰 收购商人',
    body: '路过的商人看到你的存货眼睛一亮：「这批货我全要了！价格好商量。」',
    choices: [
      { label: '卖个急价', effect: { gold: 200 } },
      { label: '婉拒（货比三家）', effect: { gold: 60 } },
      { label: '请他也吃一顿', effect: { gold: 100, items: { mysterySpice: 1 } } },
    ],
  },
  {
    id: 'cat',
    title: '🐱 馋嘴的猫',
    body: '一只胖橘猫跳上你的柜台，对着刚出锅的菜喵喵直叫，尾巴摇得像风车。',
    choices: [
      { label: '喂它一块', effect: { gold: 30, items: { pheasantEgg: 3 } } },
      { label: '轰走它', effect: { gold: 30 } },
      { label: '它真可爱，多喂点', effect: { gold: 50, items: { milk: 2 } } },
    ],
  },
  {
    id: 'apprentice',
    title: '🧒🏼 偷师的小学徒',
    body: '一个系着围裙的小孩扒着门框偷看你做菜，见你发现，红着脸躲到柱子后面。',
    choices: [
      { label: '手把手教他', effect: { gold: 80, items: { rice: 10 } } },
      { label: '让他帮你打下手', effect: { gold: 110 } },
      { label: '严厉赶走', effect: { gold: 30, items: { trap: 1 } } },
    ],
  },
  {
    id: 'rat',
    title: '🐭 深夜的偷食贼',
    body: '半夜，米缸传来窸窸窣窣的声音——一只肥硕的老鼠正拖着你的干粮逃跑！',
    choices: [
      { label: '抓住它！', effect: { gold: 60, items: { baking_ext_10: 2 } } },
      { label: '用香料薰走它', effect: { gold: 40 }, costItem: { spice: 2 } },
      { label: '就当破财消灾', effect: { gold: 15 } },
    ],
  },
  {
    id: 'tournament',
    title: '🏟️ 街角挑战赛',
    body: '街口贴出新告示：本周厨艺角斗！胜者可得巨额赏金。围观人群已经围了三层。',
    choices: [
      { label: '直接下场', effect: { gold: 150 } },
      { label: '先观望再决定', effect: { gold: 70 } },
      { label: '街头厨神是幌子', effect: { gold: 40, items: { garlic: 3 } } },
    ],
  },
  {
    id: 'thief',
    title: '💰 大胆的扒手',
    body: '有人撞了你一下！口袋里金币的数量不太对劲——一个黑影正钻进巷子。',
    choices: [
      { label: '追上去', effect: { gold: 90 } },
      { label: '喊人帮忙', effect: { gold: 50, items: { wood: 5 } } },
      { label: '吃一堑长一智', effect: { gold: 10 } },
    ],
  },
]

const ENCOUNTER_INDEX = new Map(ENCOUNTERS.map((e) => [e.id, e]))

/** 按 id 取奇遇定义（图鉴/年鉴展示用） */
export function getEncounter(id) {
  return ENCOUNTER_INDEX.get(id) ?? null
}
