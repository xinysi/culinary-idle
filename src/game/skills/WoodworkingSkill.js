// 木工（Woodworking）— 副业大类第一支（v2.9.0，2026-09-16）
// 定位见 `data/woodworking.js`：吃伐木产出的档位木材 → 做木器 → 木器再做成手工装潢（餐厅收入乘区）。
//
// 配方平衡用 `raiseRecipeLevels`（不删材料，只在必要时抬 reqLevel）：
// 本模块 10 条配方的材料就是**该档木材**（等级 = 配方等级），最高材料锚 == reqLevel，
// 于是 `h - 5 < reqLevel`，抬级分支恒不触发 —— 即「启动时重算也不会改动这些配方」。
// （若改用 `balanceRecipeLevels` 则存在「全部材料超纲就抬级」的兜底分支，多一条隐式改动路径。）

import { ProductionSkill } from './ProductionSkill.js'
import { raiseRecipeLevels } from './recipeBalance.js'
import { WOODWORKING_RECIPES } from '../data/woodworking.js'

export class WoodworkingSkill extends ProductionSkill {
  constructor(player) {
    super('woodworking', player, raiseRecipeLevels(WOODWORKING_RECIPES))
  }
}
