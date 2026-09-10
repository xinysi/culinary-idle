// 主线任务 — 需求文档 §7.2
// 引导玩家逐步解锁新区域/新技能/新机制，线性推进。
// objective.kind: gather(采集获得) / craft(制作成功) / harvest(农耕收获)
//                 / combatWin(对决胜利) / boss(击败指定BOSS) / explore(探索成功)
// progress 以 `${kind}:${param}` 为键累计（player.quests.progress）

import { QUESTS_EXT } from './quests_extra.js'

const QUESTS_BASE = [
  {
    id: 'q1', name: '采集启蒙', desc: '从森林里采摘 10 个苹果。',
    objectives: [{ kind: 'gather', param: 'apple', qty: 10 }],
    reward: { gold: 50 },
  },
  {
    id: 'q2', name: '田园时光', desc: '在农田收获 3 次小麦（需先购买种子）。',
    objectives: [{ kind: 'harvest', param: 'wheat', qty: 3 }],
    reward: { gold: 100 },
  },
  {
    id: 'q3', name: '渔翁之乐', desc: '钓到 5 条鲫鱼。',
    objectives: [{ kind: 'gather', param: 'crucian', qty: 5 }],
    reward: { gold: 100 },
  },
  {
    id: 'q4', name: '猎人之道', desc: '捕获 5 份兔肉（记得准备陷阱）。',
    objectives: [{ kind: 'gather', param: 'rabbitMeat', qty: 5 }],
    reward: { gold: 120 },
  },
  {
    id: 'q5', name: '地底宝藏', desc: '挖掘 5 个土豆和 5 份盐矿。',
    objectives: [{ kind: 'gather', param: 'potato', qty: 5 }, { kind: 'gather', param: 'saltOre', qty: 5 }],
    reward: { gold: 150 },
  },
  {
    id: 'q6', name: '厨艺初成', desc: '制作 5 份烤土豆。',
    objectives: [{ kind: 'craft', param: 'roastPotato', qty: 5 }],
    reward: { gold: 200 },
  },
  {
    id: 'q7', name: '面包师的早晨', desc: '烘焙 3 个白面包（先碾磨面粉）。',
    objectives: [{ kind: 'craft', param: 'whiteBread', qty: 3 }],
    reward: { gold: 200 },
  },
  {
    id: 'q8', name: '酱料大师', desc: '腌制出 2 瓶酱油。',
    objectives: [{ kind: 'craft', param: 'soySauce', qty: 2 }],
    reward: { gold: 250 },
  },
  {
    id: 'q9', name: '铁匠的考验', desc: '锻造 1 把铜刀（需木材与铜矿）。',
    objectives: [{ kind: 'craft', param: 'copperKnife', qty: 1 }],
    reward: { gold: 300 },
  },
  {
    id: 'q10', name: '初战告捷', desc: '在料理对决中击败 3 个对手。',
    objectives: [{ kind: 'combatWin', param: 'any', qty: 3 }],
    reward: { gold: 300 },
  },
  {
    id: 'q11', name: '面条克星', desc: '挑战并击败 首领「面条之王」（对决 25 级解锁）。',
    objectives: [{ kind: 'boss', param: '面条之王', qty: 1 }],
    reward: { gold: 500 },
  },
  {
    id: 'q12', name: '探险家', desc: '美食探索成功 5 次。',
    objectives: [{ kind: 'explore', param: 'any', qty: 5 }],
    reward: { gold: 400 },
  },
  {
    id: 'q13', name: '全技能大师', desc: '3 个技能达到 30 级。',
    objectives: [{ kind: 'skillLevel30', param: 'any', qty: 3 }],
    reward: { gold: 800, items: { mysterySpice: 2 } },
  },
  // ── 进阶任务（§7.2：按内容/等级拓展）──
  {
    id: 'q14', name: '果实丰饶', desc: '采摘 15 颗葡萄（采摘 30 级解锁）。',
    objectives: [{ kind: 'gather', param: 'grape', qty: 15 }],
    reward: { gold: 500 },
  },
  {
    id: 'q15', name: '热带风味', desc: '采摘 10 颗菠萝（采摘 40 级解锁）。',
    objectives: [{ kind: 'gather', param: 'pineapple', qty: 10 }],
    reward: { gold: 550 },
  },
  {
    id: 'q16', name: '田野金浪', desc: '在农田收获 8 次玉米。',
    objectives: [{ kind: 'harvest', param: 'corn', qty: 8 }],
    reward: { gold: 500 },
  },
  {
    id: 'q17', name: '深海垂钓', desc: '钓到 10 条金枪鱼（垂钓 25 级解锁）。',
    objectives: [{ kind: 'gather', param: 'tuna', qty: 10 }],
    reward: { gold: 600 },
  },
  {
    id: 'q18', name: '森林猎手', desc: '猎取 8 份鹿肉（狩猎 25 级解锁）。',
    objectives: [{ kind: 'gather', param: 'venison', qty: 8 }],
    reward: { gold: 600 },
  },
  {
    id: 'q19', name: '矿洞深处', desc: '挖掘 8 株灵芝（挖掘 60 级解锁）。',
    objectives: [{ kind: 'gather', param: 'lingzhi', qty: 8 }],
    reward: { gold: 800 },
  },
  {
    id: 'q20', name: '四技并进', desc: '4 个技能达到 40 级。',
    objectives: [{ kind: 'skillLevel30', param: '40', qty: 4 }],
    reward: { gold: 1000, items: { spiritFruit: 1 } },
  },
  {
    id: 'q21', name: '探索新篇', desc: '美食探索成功 12 次。',
    objectives: [{ kind: 'explore', param: 'any', qty: 12 }],
    reward: { gold: 900 },
  },
  {
    id: 'q22', name: '对决新秀', desc: '在料理对决中击败 5 个对手。',
    objectives: [{ kind: 'combatWin', param: 'any', qty: 5 }],
    reward: { gold: 900 },
  },
  {
    id: 'q23', name: '五技大师', desc: '5 个技能达到 50 级。',
    objectives: [{ kind: 'skillLevel30', param: '50', qty: 5 }],
    reward: { gold: 1500, items: { mysterySpice: 3 } },
  },
  {
    id: 'q24', name: '珍味采集', desc: '采摘 5 颗松茸（采摘 70 级解锁）。',
    objectives: [{ kind: 'gather', param: 'matsutake', qty: 5 }],
    reward: { gold: 1200 },
  },
  {
    id: 'q25', name: '金库起步', desc: '累计赚取 5 万金币。',
    objectives: [{ kind: 'gold', param: 'total', qty: 50000 }],
    reward: { gold: 50000 },
  },
  {
    id: 'q26', name: '图鉴初成', desc: '图鉴收集达到 20%。',
    objectives: [{ kind: 'collection', param: 'total', qty: 20 }],
    reward: { gold: 500 },
  },
  {
    id: 'q27', name: '赛季收藏家', desc: '赛季领奖达到 2 季。',
    objectives: [{ kind: 'seasons', param: 'total', qty: 2 }],
    reward: { gold: 600 },
  },
  {
    id: 'q28', name: '卡牌新星', desc: '卡牌对战胜利 8 场。',
    objectives: [{ kind: 'card', param: 'total', qty: 8 }],
    reward: { gold: 700 },
  },
  {
    id: 'q29', name: '竞技场之巅', desc: '竞技场达成 8 连胜。',
    objectives: [{ kind: 'arena', param: 'total', qty: 8 }],
    reward: { gold: 700 },
  },
  {
    id: 'q30', name: '餐厅老板', desc: '餐厅达到 5 级。',
    objectives: [{ kind: 'restaurant', param: 'total', qty: 5 }],
    reward: { gold: 800 },
  },
  {
    id: 'q31', name: '装备收藏', desc: '装备图鉴收集满 60 件。',
    objectives: [{ kind: 'gear', param: 'total', qty: 60 }],
    reward: { gold: 900 },
  },
  {
    id: 'q32', name: '强化之道', desc: '强化 4 件装备。',
    objectives: [{ kind: 'upgrades', param: 'total', qty: 4 }],
    reward: { gold: 800 },
  },
  {
    id: 'q33', name: '首次转生', desc: '完成 1 次转生。',
    objectives: [{ kind: 'prestiges', param: 'total', qty: 1 }],
    reward: { gold: 1000 },
  },
  {
    id: 'q34', name: '加入公会', desc: '加入一个公会。',
    objectives: [{ kind: 'guild', param: 'total', qty: 1 }],
    reward: { gold: 600 },
  },
  {
    id: 'q35', name: '金库充盈', desc: '累计赚取 20 万金币。',
    objectives: [{ kind: 'gold', param: 'total', qty: 200000 }],
    reward: { gold: 2000 },
  },
  {
    id: 'q36', name: '图鉴进阶', desc: '图鉴收集达到 40%。',
    objectives: [{ kind: 'collection', param: 'total', qty: 40 }],
    reward: { gold: 1200 },
  },
  {
    id: 'q37', name: '赛季老手', desc: '赛季领奖达到 5 季。',
    objectives: [{ kind: 'seasons', param: 'total', qty: 5 }],
    reward: { gold: 1500 },
  },
  {
    id: 'q38', name: '卡牌大师', desc: '卡牌对战胜利 20 场。',
    objectives: [{ kind: 'card', param: 'total', qty: 20 }],
    reward: { gold: 1800 },
  },
  {
    id: 'q39', name: '竞技场传奇', desc: '竞技场达成 12 连胜。',
    objectives: [{ kind: 'arena', param: 'total', qty: 12 }],
    reward: { gold: 1800 },
  },
  {
    id: 'q40', name: '餐厅王国', desc: '餐厅达到 10 级。',
    objectives: [{ kind: 'restaurant', param: 'total', qty: 10 }],
    reward: { gold: 2000 },
  },
  {
    id: 'q41', name: '装备大师', desc: '装备图鉴收集满 120 件。',
    objectives: [{ kind: 'gear', param: 'total', qty: 120 }],
    reward: { gold: 2500 },
  },
  {
    id: 'q42', name: '强化大师', desc: '强化 8 件装备。',
    objectives: [{ kind: 'upgrades', param: 'total', qty: 8 }],
    reward: { gold: 2200 },
  },
  {
    id: 'q43', name: '轮回之魂', desc: '完成 3 次转生。',
    objectives: [{ kind: 'prestiges', param: 'total', qty: 3 }],
    reward: { gold: 3000 },
  },
  {
    id: 'q44', name: '图鉴大成', desc: '图鉴收集达到 70%。',
    objectives: [{ kind: 'collection', param: 'total', qty: 70 }],
    reward: { gold: 3500 },
  },
  {
    id: 'q45', name: '珍味之巅', desc: '采摘 8 颗松露（采摘 80 级解锁）。',
    objectives: [{ kind: 'gather', param: 'truffle', qty: 8 }],
    reward: { gold: 3000 },
  },
  {
    id: 'q46', name: '龙肝凤髓', desc: '猎取 5 份龙肉（狩猎 95 级解锁）。',
    objectives: [{ kind: 'gather', param: 'dragonMeat', qty: 5 }],
    reward: { gold: 4000 },
  },
  {
    id: 'q47', name: '深海珍馐', desc: '钓到 5 条蓝鳍金枪鱼（垂钓 85 级解锁）。',
    objectives: [{ kind: 'gather', param: 'bluefin', qty: 5 }],
    reward: { gold: 3500 },
  },
  {
    id: 'q48', name: '仙果之约', desc: '采摘 3 颗灵果（采摘 90 级解锁）。',
    objectives: [{ kind: 'gather', param: 'spiritFruit', qty: 3 }],
    reward: { gold: 4000 },
  },
]

export const QUESTS = [...QUESTS_BASE, ...QUESTS_EXT]

export function questObjectiveKey(obj) {
  return `${obj.kind}:${obj.param}`
}
