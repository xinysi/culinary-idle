// 采矿（Mining）— v2.7.0（2026-09-16）从「挖掘」独立出来的采集技能。
//
// 为什么独立：矿物原本混在挖掘的 83 个目标里（41 个矿物），与根茎/菌类共用一条线；
// 而上游的锻造（365 条配方）、保鲜（盐矿）、宝石镶嵌都只吃矿物——独立成线后
// 「挖矿」与「挖根茎」各自有清晰的等级曲线，也首次让**铜矿/铁矿可定向采集**
// （它们此前只作为挖掘附产出现）。
//
// 目标清单来自 `ExcavationSkill.js` 的 `MINING_TARGETS`（= 铜矿/铁矿 + 41 个矿物），
// 源数组仍是冻结的生成器产物，本技能只做分流读取。
// 无附产（化石/种子留在挖掘）；`GatheringSkill` 基类已提供产出、双倍、精通、离线与并行挂机。

import { GatheringSkill } from './GatheringSkill.js'
import { MINING_TARGETS } from './ExcavationSkill.js'

export { MINING_TARGETS }

export class MiningSkill extends GatheringSkill {
  constructor(player) {
    super('mining', player, MINING_TARGETS)
  }
}
