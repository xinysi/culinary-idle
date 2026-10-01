// 查「有自己的数值口径、但效果总览没登记」的系统：逐个机制模块问「它的面向玩家数值有没有进注册表」。
// 判据：模块名 / 关键常量名，是否在 activeEffects.js 里出现过（粗筛，人工复核）。
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const reg = fs.readFileSync(join(ROOT, 'src/game/data/activeEffects.js'), 'utf8')

// 候选：带「平衡 / 档位 / 机制」色彩的模块（人工挑，含玩家可见数值的）
const MODULES = [
  ['explorationBalance.js', '美食探索：成功率构成（段位曲线 + 精通补足 + 池 + 专属装备）'],
  ['explorationGear.js', '美食探索：专属装备（+5%/+10% 与 0.01% 掉落）'],
  ['battleTower.js', '挑战塔：四档难度倍率（标准/精英/极限/饕餮）'],
  ['mysticRealm.js', '食神秘境：13 档与局内加成'],
  ['arena.js', '竞技场：镜像对手与连胜宝箱'],
  ['difficulty.js', '全局难度系数（掉落/制作/探索/附产四桶）'],
  ['combatTuning.js', '战斗深度：命中公式 / 对敌状态 / 抗性 / 越级重击'],
  ['enemyScaling.js', '敌人血量分档'],
  ['mastery.js', '精通档位与池'],
  ['growthRate.js', '成长：低目标减半 / 叠区阻尼 / 二级饱和'],
  ['caps.js', '上限与档位'],
  ['seasonalCrop.js', '当季作物'],
  ['farmingSeason.js', '农时（当季作物）'],
  ['weather.js', '天气'],
  ['houseBonus.js', '房屋加成'],
  ['cardBattle.js', '卡牌对战'],
  ['takeout.js', '外卖'],
  ['michelin.js', '米其林评级'],
  ['guilds.js', '公会'],
  ['daoTree.js', '厨神之路'],
  ['shanhaiProgress.js', '山海食经'],
  ['sidelineWorks.js', '副业 16 支'],
  ['seasons.js', '赛季'],
  ['insights.js', '菜系图谱'],
]
console.log('模块'.padEnd(26) + '注册表里提到过？')
for (const [f, why] of MODULES) {
  const base = f.replace('.js', '')
  const hit = reg.includes(f) || reg.includes(base)
  console.log(`${hit ? '✅' : '❌'} ${f.padEnd(24)} ${why}`)
}
