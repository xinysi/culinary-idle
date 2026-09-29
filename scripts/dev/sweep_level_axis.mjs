// 12 条山海线的「等级轴」批量复测驱动（本地开发脚本，2026-09-29）。
// 为什么需要它：`growth_curve.mjs` 一次只能跑一条线一个档位，而文档 §3 要的是 12 线 × 2 档的完整表。
// 每条线的两档：`max --from=6 --mastery`（满配 + 精通已满 + 起点 Lv6 = 转生后那一轮）与 `base`（无 buff，从 Lv1）。
// 用法：node scripts/dev/sweep_level_axis.mjs > <日志>
import { spawnSync } from 'node:child_process'

const SKILLS = ['foraging', 'woodcutting', 'mining', 'fishing', 'hunting', 'excavation', 'farming', 'cooking', 'baking', 'brewing', 'spiceMixing', 'craftsmithing']
const NAMES = {
  foraging: '采撷', woodcutting: '伐薪', mining: '矿脉', fishing: '渔获', hunting: '山猎', excavation: '掘藏',
  farming: '稼穑', cooking: '烹煮', baking: '烘焙', brewing: '酿造', spiceMixing: '调味', craftsmithing: '锻造',
}
for (const s of SKILLS) {
  for (const [scen, args, cap] of [['满配(转生后一轮)', ['max', '--from=6', '--mastery'], 600], ['无buff', ['base'], 900]]) {
    const t0 = Date.now()
    const r = spawnSync(process.execPath, ['scripts/sim/growth_curve.mjs', s, ...args], { encoding: 'utf8', timeout: cap * 1000, maxBuffer: 1 << 28 })
    // 🔴 只认「达到 N 级 · 累计 …」那一行：表格**表头**里也有「累计时长」四个字，
    //    首版用 `includes('累计')` 抓到的全是表头（量出来一行数都没有）。`达到` 是那句独有的。
    const line = (r.stdout ?? '').split('\n').find((l) => l.includes('达到') && l.includes('累计')) ?? '(无结果)'
    console.log(`${NAMES[s]}(${s})`.padEnd(18) + scen.padEnd(18) + line.replace('✅ ', '') + ` · 墙钟 ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  }
}
console.log('DONE')
