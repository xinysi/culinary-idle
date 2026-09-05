// 美食知识（Gastronomy）— 需求文档 §3.4.1
// 消耗「品鉴点数」激活美食奥义；可同时激活多个，点数消耗叠加；
// 点数耗尽自动全部关闭（drainAoji 在 player.tick 中每帧结算）。
// 奥义效果在 player.gastronomyEffects 聚合，作用于对决/采集/经验。

import { Skill } from './Skill.js'

export class GastronomySkill extends Skill {
  constructor(player) {
    super('gastronomy', player)
  }

  get type() {
    return 'gastronomy'
  }
}
