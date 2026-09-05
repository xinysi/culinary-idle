// 技能实例注册表 — 每个技能一个实例，由 bootstrap 创建并持有。
// 实例保存在模块级 Map（不放进 Pinia state，避免代理破坏类实例），
// 各组件/存储通过 getSkillInstance(id) 读取。
// 独立成 registry.js 是为了让 stores/player.js 能安全引用而不形成循环依赖。

import { Skill } from './Skill.js'
import { ForagingSkill } from './ForagingSkill.js'
import { SpiritSummoningSkill } from './SpiritSummoningSkill.js'
import { GastronomySkill } from './GastronomySkill.js'
import { PreservationSkill } from './PreservationSkill.js'
import { ExplorationSkill } from './ExplorationSkill.js'
import { FishingSkill } from './FishingSkill.js'
import { HuntingSkill } from './HuntingSkill.js'
import { ExcavationSkill } from './ExcavationSkill.js'
import { FarmingSkill } from './FarmingSkill.js'
import { CookingSkill } from './CookingSkill.js'
import { BakingSkill } from './BakingSkill.js'
import { PreservingSkill } from './PreservingSkill.js'
import { BrewingSkill } from './BrewingSkill.js'
import { SpiceMixingSkill } from './SpiceMixingSkill.js'
import { CraftsmithingSkill } from './CraftsmithingSkill.js'

const factories = {
  // §3.1 采集类（5/5 已实现）
  foraging: (player) => new ForagingSkill(player),
  fishing: (player) => new FishingSkill(player),
  hunting: (player) => new HuntingSkill(player),
  excavation: (player) => new ExcavationSkill(player),
  farming: (player) => new FarmingSkill(player),
  // §3.2 制作类（6/6 已实现）
  cooking: (player) => new CookingSkill(player),
  baking: (player) => new BakingSkill(player),
  preserving: (player) => new PreservingSkill(player),
  brewing: (player) => new BrewingSkill(player),
  spiceMixing: (player) => new SpiceMixingSkill(player),
  craftsmithing: (player) => new CraftsmithingSkill(player),
  // §3.3.6 食灵召唤 / §3.4 辅助类
  spiritSummoning: (player) => new SpiritSummoningSkill(player),
  gastronomy: (player) => new GastronomySkill(player),
  preservation: (player) => new PreservationSkill(player),
  exploration: (player) => new ExplorationSkill(player),
}

// §3.3 对决类（除食灵外）先用基类实例承载等级/经验（战斗联动已在 Combat 中实现）
for (const id of ['knife', 'heatControl', 'flavorArtistry', 'plating', 'tasteAcumen']) {
  factories[id] = (player) => new Skill(id, player)
}

const instances = new Map()

/** 创建全部已注册技能的实例并返回 Map */
export function createSkillInstances(player) {
  for (const [id, factory] of Object.entries(factories)) {
    instances.set(id, factory(player))
  }
  return instances
}

export function getSkillInstance(id) {
  return instances.get(id) ?? null
}

export function hasSkillInstance(id) {
  return instances.has(id)
}

/** 全部技能实例（多技能并行挂机/离线结算用） */
export function getAllSkillInstances() {
  return [...instances.values()]
}

/** 供 store 使用的小包装（避免直接 import 造成时序问题） */
export function useSkillRegistry() {
  return { getSkillInstance, hasSkillInstance, getAllSkillInstances }
}
