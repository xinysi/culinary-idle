import fs from 'node:fs'
const p = 'scripts/sim/full_run.mjs'
let s = fs.readFileSync(p, 'utf8')
// 🔴 根因：实例上没有 setTarget（是 undefined）—— 目标要经 **store** 的 setSkillTarget(skillId, itemId)。
//    首版一直在调 inst.setTarget?.() ⇒ 静默什么都没做 ⇒ 48h 零进展（是我的探针 bug，不是游戏卡死）。
s = s.replace("      if (best) inst.setTarget?.(best.id ?? best.itemId ?? best.seedId)",
  "      const tid = best && (best.id ?? best.itemId ?? best.seedId)\n      if (tid) p.setSkillTarget?.(inst.id, tid)   // ⚠️ 走 store 的出口（实例上没有 setTarget）")
// 制作同理：实例上有 enqueue 吗 ✗ —— 用 store 的 craft 队列出口更稳；先保留 enqueue 但补一个兜底
s = s.replace("      if (ok.length) { inst.enqueue?.(ok[ok.length - 1], 5); inst.tick(dt) }",
  "      if (ok.length) {\n        const r = ok[ok.length - 1]\n        if (typeof inst.enqueue === 'function') inst.enqueue(r, 5)\n        else if (p.enqueueCraft) p.enqueueCraft(inst.id, r.id ?? r.recipeId, 5)\n        inst.tick(dt)\n      }")
fs.writeFileSync(p, s, 'utf8')
console.log('✅ 目标改用 store 的 setSkillTarget（根因：实例上没有 setTarget）')
