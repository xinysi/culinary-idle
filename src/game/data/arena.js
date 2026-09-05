// 竞技场（多人对决·本地镜像）— 需求文档 §13（可选扩展）
// 真在线 对战 需要后端服务；此处为「其他玩家镜像」的本地竞技场：
// 每 30 分钟随机生成 10 名模拟玩家（名字/数值随机，强度随你的对决等级提升），
// 按强度排序排名；使用既有 Combat 引擎对决，记录连胜与最佳纪录。
// 排行数据仅本机（localStorage 随存档保存）。

import { opp } from './combat.js'

export const ARENA_NAMES = [
  '食神学徒', '大胃王', '味觉先锋', '深夜食堂客', '麻辣挑战者', '甜品控', '汤面达人', '刀工传人', '火锅狂人', '素食主义', '烧烤摊主', '老饕',
  '夜宵猎人', '酱油公子', '醋坛子', '米其林学徒', '路边摊之王', '便当侠', '甜品杀手', '药膳大师', '分子料理迷', '铁板烧狂人', '关东煮大叔', '寿司小哥',
]

export function generateArenaOpponents(seedLevel = 1) {
  const base = Math.max(1, seedLevel)
  const styles = ['knife', 'plating', 'flavor']
  const used = new Set()
  const opponents = []
  for (let i = 0; i < 10; i++) {
    // 名字随机且不重复
    let name = ARENA_NAMES[Math.floor(Math.random() * ARENA_NAMES.length)]
    while (used.has(name)) name = ARENA_NAMES[Math.floor(Math.random() * ARENA_NAMES.length)]
    used.add(name)
    // 等级随机分布在玩家水平附近（±30%，逐名次递增），但不超过玩家对决等级
    const lvl = Math.max(1, Math.min(base, Math.round(base * (0.7 + Math.random() * 0.6) + i * 0.9)))
    const o = opp(lvl, name, styles[Math.floor(Math.random() * 3)], {
      isPvp: true,
      drops: [{ itemId: 'mysterySpice', chance: 0.05 }],
    })
    // 数值随机微调 ±15%
    o.hp = Math.max(10, Math.round(o.hp * (0.85 + Math.random() * 0.3)))
    o.atk = Math.max(1, Math.round(o.atk * (0.85 + Math.random() * 0.3) * 10) / 10)
    o.def = Math.max(0, Math.round(o.def * (0.85 + Math.random() * 0.3)))
    opponents.push(o)
  }
  // 按强度排序排名（等级优先，其次攻击）
  opponents.sort((a, b) => b.level - a.level || b.atk - a.atk)
  opponents.forEach((o, i) => {
    o.rank = i + 1
  })
  return opponents
}
