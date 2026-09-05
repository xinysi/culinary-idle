// 美食奥义数据 — 需求文档 §3.4.1
// 消耗「品鉴点数」（对决胜利获得）激活，可同时激活多个，点数消耗叠加；
// 品鉴点数耗尽时全部自动关闭。effect 字段含义：
//   dmgPct 全伤害 / styleDmgPct 流派伤害 / defensePct 减伤 / speedPct 攻速
//   maxHpBonus 最大HP / yieldPct 采集产量 / xpPct 全经验 / healPct 料理回血

export const AOJIS = [
  { id: 'sharpBlade', name: '锋利之刃', category: '攻击', desc: '刀工伤害 +10%', costPerSec: 0.5, effect: { styleDmgPct: { knife: 10 } } },
  { id: 'ironWall', name: '铜墙铁壁', category: '防御', desc: '受到伤害 -15%', costPerSec: 0.6, effect: { defensePct: 15 } },
  { id: 'harvestBlessing', name: '丰收祝福', category: '采集', desc: '采集产量 +20%', costPerSec: 0.3, effect: { yieldPct: 20 } },
  { id: 'swiftStep', name: '疾风步伐', category: '攻击', desc: '对决攻速 +10%', costPerSec: 0.4, effect: { speedPct: 10 } },
  { id: 'ironStomach', name: '铁胃', category: '防御', desc: '最大品鉴值 +20', costPerSec: 0.5, effect: { maxHpBonus: 20 } },
  { id: 'feastMaster', name: '盛宴之主', category: '防御', desc: '对决中料理回血 +50%', costPerSec: 0.8, effect: { healPct: 50 } },
  { id: 'oceanKnowledge', name: '海量知识', category: '采集', desc: '全部技能经验 +10%', costPerSec: 1.0, effect: { xpPct: 10 } },
  { id: 'godPower', name: '食神之威', category: '攻击', desc: '全部对决伤害 +30%（终极奥义）', costPerSec: 2.0, effect: { dmgPct: 30 } },
  // —— 拓展（§3.4.1 平衡 + 新增）——
  { id: 'harvestMaster', name: '丰收大师', category: '采集', desc: '采集产量 +30%', costPerSec: 0.6, effect: { yieldPct: 30 } },
  { id: 'combatScholar', name: '战斗学者', category: '攻击', desc: '全部对决伤害 +15%', costPerSec: 0.9, effect: { dmgPct: 15 } },
  { id: 'tasteGuard', name: '品鉴护盾', category: '防御', desc: '受到伤害 -25%', costPerSec: 0.8, effect: { defensePct: 25 } },
  { id: 'swiftProwess', name: '迅捷高手', category: '攻击', desc: '对决攻速 +20%', costPerSec: 0.7, effect: { speedPct: 20 } },
]

// 内容扩充：美食知识 +10（生成器 expansion1.js）
import { AOJI_EXT } from './expansion1.js'
AOJIS.push(...AOJI_EXT)
import { AOJI_EXT2 } from './expansion2.js'
AOJIS.push(...AOJI_EXT2)

export function getAoji(id) {
  return AOJIS.find((a) => a.id === id) ?? null
}

// 奥义数值平衡（启动时调用）：把高阶奥义的 costPerSec 下调到可长期维持的区间，
// 与品鉴点供给（对决胜利）匹配；不改生成器产物文件（AOJI_EXT/EXT2），统一在此归一。
const AOJI_COST_TUNE = {
  sharpBlade: 0.5, swiftStep: 0.4, ironWall: 0.6, feastMaster: 0.8, oceanKnowledge: 1.0,
  godPower: 1.3, // 终极奥义：30% 全伤压低到可长期维持
  // 扩展/进阶奥义（原 1~2.2/s 过高，下调）
  aoji_perfect_heat: 0.5, aoji_iron_gut2: 0.6, aoji2_swift_thunder: 0.5,
  aoji_soul_of_food: 0.9, aoji_knowledge_spring: 0.9, aoji2_bedrock: 0.9,
  aoji2_berserk2: 1.0, aoji2_life_praise: 1.0, aoji2_erudite: 1.2,
}
export function applyAojiBalance() {
  for (const a of AOJIS) {
    const c = AOJI_COST_TUNE[a.id]
    if (c != null) a.costPerSec = c
  }
}
