// 浅色主题对比度审计（2026-09-26 立）—— **按真实 DOM 算有效背景**，逐页找不达标的文字。
//
// 为什么不用现成的 `light_contrast_audit.mjs`：那只算「token × token」的组合（会给出根本没被用到的组合，
// 比如「白字 × primary-tint」在 15 个皮肤里全挂，但不知道哪一页真的这么渲染）。本脚本反过来 ——
// 打开每一页，遍历可见文字元素，**沿祖先链把半透明底色逐层合成**，得到该元素真实的底，再算 WCAG 对比度。
//
// 口径：正文（<18.66px，或非粗体 <24px）要求 ≥4.5；大字号/粗体大字号要求 ≥3.0。
// 跳过：不透明底之上还有 background-image 的元素（无法判定）、opacity<1、不可见、零尺寸、纯图标。
// 用法：`node scripts/dev/light_dom_contrast.mjs [皮肤名...]`（默认 classic + 全部皮肤各扫关键页）
import { chromium } from 'playwright'

const PAGES = ['skill', 'inventory', 'log', 'equipment', 'combat', 'restaurant', 'guild', 'season', 'mihuan', 'arena', 'tower', 'mijian', 'stats', 'decor']
const ONLY = process.argv.slice(2)
const SKINS = ONLY.length ? ONLY : ['classic']

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } })
await p.goto('http://localhost:5173/', { waitUntil: 'load' })
await p.waitForTimeout(500)
await p.locator('.splash-start-btn').click()
await p.waitForTimeout(400)
await p.locator('.start-slot-modal .slot-card').nth(0).locator('button').click()
await p.waitForTimeout(1200)

for (const skin of SKINS) {
  await p.evaluate((s) => {
    const app = document.querySelector('#app').__vue_app__.config.globalProperties
    const player = app.$pinia._s.get('player')
    player.settings.skin = s
    player.settings.theme = 'light'
    app.$pinia._s.get('ui').applyTheme?.()
    document.documentElement.setAttribute('data-skin', s)
    document.documentElement.setAttribute('data-theme', 'light')
  }, skin)
  await p.waitForTimeout(600)

  const all = []
  for (const view of PAGES) {
    await p.evaluate((v) => {
      const app = document.querySelector('#app').__vue_app__.config.globalProperties
      try { app.$pinia._s.get('ui').setView(v) } catch { /* 未注册的视图跳过 */ }
    }, view)
    await p.waitForTimeout(420)
    const rows = await p.evaluate(() => {
      const parse = (c) => {
        const m = String(c).match(/rgba?\(([^)]+)\)/)
        if (!m) return null
        const n = m[1].split(',').map((x) => parseFloat(x))
        return [n[0], n[1], n[2], n.length > 3 ? n[3] : 1]
      }
      const over = (fg, bg) => { // fg 叠在 bg 上
        const a = fg[3]
        return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1]
      }
      const lum = (c) => {
        const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
        return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
      }
      const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05) }
      /** 从元素往上把底色合成出来；遇到不透明底或 background-image 就停（bgi 记 true） */
      const effectiveBg = (el) => {
        let acc = null
        let hasImg = false
        for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
          const cs = getComputedStyle(n)
          if (cs.backgroundImage && cs.backgroundImage !== 'none') hasImg = true
          const c = parse(cs.backgroundColor)
          if (c && c[3] > 0) {
            acc = acc ? over(acc, c) : c
            if (acc[3] >= 0.99) return { bg: acc, hasImg }
          }
        }
        const root = parse(getComputedStyle(document.body).backgroundColor) ?? [255, 255, 255, 1]
        return { bg: acc ? over(acc, root) : root, hasImg }
      }
      const out = []
      const seen = new Set()
      const skipped = { emoji: 0, gradientText: 0, gradientBg: 0 }
      for (const el of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(el)
        if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.99) continue
        const r = el.getBoundingClientRect()
        if (r.width < 4 || r.height < 4) continue
        const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('')
        if (!text) continue
        // 假阳性①：**纯 emoji/符号** —— 画出来的是彩色的 emoji 字形，`color` 不参与渲染
        if (!/[\u4e00-\u9fa5A-Za-z0-9]/.test(text)) { skipped.emoji++; continue }
        const fg = parse(cs.color)
        if (!fg) continue
        // 假阳性②：**渐变文字**（`background-clip:text` + `color:transparent`）—— 真正上色的是渐变
        if (fg[3] === 0 || cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text') { skipped.gradientText++; continue }
        const { bg, hasImg } = effectiveBg(el)
        // 假阳性③：不透明底之上还有 **background-image（渐变/纹理）** —— 无法合成出真实底色
        if (hasImg) { skipped.gradientBg++; continue }
        const eff = fg[3] < 1 ? over(fg, bg) : fg
        const px = parseFloat(cs.fontSize)
        const bold = Number(cs.fontWeight) >= 700
        const large = px >= 24 || (bold && px >= 18.66)
        const need = large ? 3 : 4.5
        const cr = ratio(eff, bg)
        if (cr >= need) continue
        const sig = `${cs.color}|${Math.round(bg[0])},${Math.round(bg[1])},${Math.round(bg[2])}|${cs.fontSize}|${el.className}`
        if (seen.has(sig)) continue
        seen.add(sig)
        out.push({
          view: '', cls: String(el.className).slice(0, 44), text: text.slice(0, 18),
          cr: Math.round(cr * 100) / 100, need, px, fg: cs.color, bg: `rgb(${bg.slice(0, 3).map(Math.round).join(',')})`,
          tag: el.tagName.toLowerCase(),
        })
      }
      out.skipped = skipped
      return out
    })
    for (const r of rows) all.push({ ...r, view })
  }
  const bad = all.filter((r) => r.cr < 3)
  const warn = all.filter((r) => r.cr >= 3 && r.cr < r.need)
  const sk = all.skipped ?? {}
  console.log(`\n═══ 皮肤 ${skin}（浅色）· 扫描 ${PAGES.length} 页 ═══`)
  console.log(`严重（<3.0）：${bad.length} 处 · 偏弱（3.0~未达标）：${warn.length} 处 · 已排除假阳性：emoji ${sk.emoji ?? 0} · 渐变文字 ${sk.gradientText ?? 0} · 渐变底 ${sk.gradientBg ?? 0}`)
  for (const r of bad.slice(0, 20)) console.log(`  🔴 ${r.cr} (需${r.need}) ${r.view} .${r.cls} 「${r.text}」 ${r.fg} on ${r.bg}`)
  // 偏弱按「token 色值」聚合，便于用数据决定改哪个 token（而不是逐个选择器试）
  const byColor = new Map()
  for (const r of warn) {
    const k = `${r.fg} on ${r.bg}`
    byColor.set(k, (byColor.get(k) ?? 0) + 1)
  }
  console.log('  偏弱按「字色 on 底色」聚合（前 12，附 2 个选择器样例便于定位）：')
  for (const [k, n] of [...byColor.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    const samples = warn.filter((r) => `${r.fg} on ${r.bg}` === k).slice(0, 2).map((r) => `${r.view} .${r.cls}「${r.text}」`)
    console.log(`    ❌ ×${String(n).padStart(3)} ${k}\n        ${samples.join(' · ')}`)
  }
}
await b.close()
