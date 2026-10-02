import fs from 'node:fs'
const p = 'scripts/sim/full_run.mjs'
let s = fs.readFileSync(p, 'utf8')
s = s.replace("const insts = createSkillInstances(p)",
  "// ⚠️ createSkillInstances 返回的是 **{ id: 实例 } 映射**（不是数组）⇒ 统一成数组\nconst _raw = createSkillInstances(p)\nconst insts = Array.isArray(_raw) ? _raw : Object.values(_raw ?? {})")
// 类型判定：采集/制作类的 type 字段名可能不同 ⇒ 用能力判定（有 targets/crops = 采集，有 recipes = 制作）
s = s.replace("const gather = insts.filter((i) => i.type === 'gathering')",
  "const gather = insts.filter((i) => i && (i.targets || i.crops))")
s = s.replace("const prod = insts.filter((i) => i.type === 'production')",
  "const prod = insts.filter((i) => i && i.recipes && !i.targets)")
fs.writeFileSync(p, s, 'utf8')
console.log('✅ 已按真实形状修正（映射→数组 + 按能力分类）')
