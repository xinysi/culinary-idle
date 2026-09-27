// 量：觅珍「模拟预览」按钮的底色档 × 字色组合，哪种在 13px 粗体下达标（≥4.5:1）。
// 结论（2026-09-27 用户报「混进了红色」时实测）：只有「深档 + 白字」在五池全部达标 ⇒ 实现取它。
// 改按钮配色后跑一遍，别凭感觉挑档。
import fs from 'node:fs'
const src = fs.readFileSync('src/views/MijianView.vue', 'utf8')
const hex = (h) => { const s = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)) }
const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }
const pools = {}
for (const m of src.matchAll(/\.pool-(\w+)\s*\{([\s\S]*?)\}/g)) {
  const body = m[2]
  const get = (k) => (body.match(new RegExp(`--${k}:\s*([^;]+)`)) ?? [])[1]?.trim()
  const t = { hi1: get('thi1'), hi2: get('thi2'), md1: get('tmd1'), md2: get('tmd2'), lo1: get('tlo1'), lo2: get('tlo2'), th: get('tth'), tm: get('ttm'), tl: get('ttl') }
  if (t.hi1 && t.th) pools[m[1]] = t
}
const worst = (a, b, text) => Math.min(ratio(hex(a), hex(text)), ratio(hex(b), hex(text)))
const rows = []
for (const [name, t] of Object.entries(pools)) {
  rows.push({
    池: name,
    '亮档+深彩字': worst(t.hi1, t.hi2, t.th).toFixed(2),
    '中档+亮彩字': worst(t.md1, t.md2, t.tm).toFixed(2),
    '深档+暖金字': worst(t.lo1, t.lo2, t.tl).toFixed(2),
    '深档+白字': worst(t.lo1, t.lo2, '#ffffff').toFixed(2),
    '中档+白字': worst(t.md1, t.md2, '#ffffff').toFixed(2),
    '中档+深彩字': worst(t.md1, t.md2, t.th).toFixed(2),
  })
}
console.table(rows)
