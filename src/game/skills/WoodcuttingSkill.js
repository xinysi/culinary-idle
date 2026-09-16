// 伐木（Woodcutting）— v2.7.0（2026-09-16）新增的采集技能。
//
// 产物是 **20 档木材**（`data/timbers.js`），每 5 级一档、与厨具锻造的 20 个装备品质套严格对应
// （Lv71-75 的琉璃套 ↔ 琉璃木），供锻造配方与装备强化按档取用。
//
// 与既有 `木材`（id `wood`）的关系：`木材` 是「通用低级木料」，来源仍是采摘 50% 附产、
// 炼金/奇遇/公会任务/对决掉落也仍在使用它——**一律不动**；本技能的 20 档木材是新体系。
//
// 无附产；产出、双倍、精通、离线结算与并行挂机全部由 `GatheringSkill` 基类提供。

import { GatheringSkill } from './GatheringSkill.js'
import { WOODCUTTING_TARGETS } from '../data/timbers.js'

export { WOODCUTTING_TARGETS }

export class WoodcuttingSkill extends GatheringSkill {
  constructor(player) {
    super('woodcutting', player, WOODCUTTING_TARGETS)
  }
}
