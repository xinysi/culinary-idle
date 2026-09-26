// 浅色主题对比度诊断（临时）：把各皮肤浅色下的「文字 token × 常见底」逐对算比值，
// 找出哪些 token 在浅色下天生不达标 —— 用数据决定改哪个 token，而不是逐个选择器试。
import { SKINS, skinVars } from '../../src/game/data/skins.js'

const toTriplet = (v) => {
  const t = String(v ?? '').trim()
  if (!t) return null
  if (t.startsWith('#')) {
    const h = t.length === 4 ? t.slice(1).split('').map((c) => c + c).join('') : t.slice(1)
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
  }
  const p = t.split(',').map((x) => parseFloat(x))
  return p.length >= 3 && p.every(Number.isFinite) ? p.slice(0, 3) : null
}
const lum = ([r, g, b]) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
const mix = (fg, bg, alpha) => fg.map((c, i) => c * alpha + bg[i] * (1 - alpha))

const PAIRS = [
  ['primary-deep × tint(.25)', '--primary-deep', (v) => mix(toTriplet(v['--primary-tint']) ?? [255, 255, 255], toTriplet(v['--panel']) ?? [255, 255, 255], 0.25)],
  ['primary-strong × tint(.25)', '--primary-strong', (v) => mix(toTriplet(v['--primary-tint']) ?? [255, 255, 255], toTriplet(v['--panel']) ?? [255, 255, 255], 0.25)],
  ['primary-deep × tint(.12)', '--primary-deep', (v) => mix(toTriplet(v['--primary-tint']) ?? [255, 255, 255], toTriplet(v['--panel']) ?? [255, 255, 255], 0.12)],
  ['白字 × primary-tint(0.78)', 'white', (v) => mix(toTriplet(v['--primary-tint']) ?? [255, 255, 255], toTriplet(v['--panel']) ?? [255, 255, 255], 0.78)],
  ['白字 × primary-strong', 'white', (v) => toTriplet(v['--primary-strong'])],
  ['白字 × primary', 'white', (v) => toTriplet(v['--primary'])],
  ['primary-deep 字 × panel', '--primary-deep', (v) => toTriplet(v['--panel'])],
  ['primary-strong 字 × panel', '--primary-strong', (v) => toTriplet(v['--panel'])],
  ['text-dim 字 × panel', '--text-dim', (v) => toTriplet(v['--panel'])],
  ['muted 字 × panel', '--muted', (v) => toTriplet(v['--panel'])],
  ['muted 字 × panel-raised', '--muted', (v) => toTriplet(v['--panel-raised'])],
  ['good-strong 字 × good-soft', '--good-strong', (v) => toTriplet(v['--good-soft'])],
  ['warn-strong 字 × warn-soft', '--warn-strong', (v) => toTriplet(v['--warn-soft'])],
  ['bad-strong 字 × bad-soft', '--bad-strong', (v) => toTriplet(v['--bad-soft'])],
]

console.log('皮肤（浅色）逐对对比度（<4.5 标 ❌，<3 标 🔴）\n')
const head = PAIRS.map(([n]) => n.slice(0, 21).padEnd(22)).join('')
console.log('皮肤'.padEnd(10) + head)
const worst = new Map()
for (const s of SKINS) {
  const v = skinVars(s.id, 'light')
  const cells = []
  PAIRS.forEach(([label, fgTok, bgFn], i) => {
    const fg = fgTok === 'white' ? [255, 255, 255] : toTriplet(v[fgTok])
    const bg = bgFn(v)
    if (!fg || !bg) { cells.push('—'.padEnd(22)); return }
    const r = ratio(fg, bg)
    const flag = r < 3 ? '🔴' : r < 4.5 ? '❌' : '✅'
    cells.push(`${flag}${r.toFixed(2)}`.padEnd(22))
    if (r < 4.5) {
      const cur = worst.get(label) ?? []
      cur.push(`${s.id}:${r.toFixed(2)}`)
      worst.set(label, cur)
    }
  })
  console.log(s.id.padEnd(10) + cells.join(''))
}
console.log('\n=== 不达标汇总（按对）===')
for (const [label, list] of [...worst.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n${label}（${list.length}/15 皮肤不达标）`)
  console.log('  ' + list.join(' · '))
}
