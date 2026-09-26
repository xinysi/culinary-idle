// 界面皮肤（v2.1）— 每套皮肤给出**一整份**色板：主色家族 + 由主色推导的中性色（底色/面板/文字/
// 描边/滚动条）+ 调色板三元组（`--*-rgb`，供 `rgba(var(--x-rgb), α)` 用）。
//
// 设计要点
//   ① 皮肤只覆盖 CSS 变量；样式里已不再写死任何调色板色值（v2.1 已全量 token 化，
//      守卫见 `e2e` 指纹比对与 `system_test` 的皮肤组）。
//   ② **每套皮肤必须给浅色与深色两版**：浅色版压在奶油底上、深色版压在深色面板上。
//      只给一版会导致「深色文字压深色底」这类对比事故（2026-09-13 实测被 e2e-dark 逐套皮肤体检抓到）。
//   ③ 深色版**不要覆盖 `--primary-deep`**：深色主题块本身没定义它（靠回退拿浅色 `#7a2f16`），
//      覆盖会让「橙字压橙底」那类场景（侧栏选中行等）对比度失守。
//   ④ 语义色（good/warn/bad/info）、金色描边（`--border`/`--gold-glow`）与琥珀道具色（`--amber*`）
//      属**功能语义/设计身份**，不随皮肤变；小游戏高亮橙（`--accent*`）会跟着皮肤走。
//
// 应用方式：`applySkinToDom(id, theme)` 把变量写到 <html> 的**行内样式**（优先级最高，
//   浅色块与 `html[data-theme='dark']` 权威块都压不过它 → 不需要为皮肤再写一份 CSS 块）。
// 解锁：按**成就数**（need），与「成就」系统联动。

const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)))
const hex2rgb = (h) => {
  const s = h.replace('#', '')
  return { r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16) }
}
const toHex = ({ r, g, b }) => '#' + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('')
/** a、b 为 #rrggbb；t=0 取 a，t=1 取 b */
const mix = (a, b, t) => {
  const x = hex2rgb(a), y = hex2rgb(b)
  return toHex({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t })
}
/** 往黑（t<0）或白（t>0）方向推，|t| 为幅度 */
const shade = (hex, t) => mix(hex, t < 0 ? '#000000' : '#ffffff', Math.abs(t))
const lumOf = (hex) => {
  const c = hex2rgb(hex)
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
}
const contrastOf = (a, b) => { const [x, y] = [lumOf(a), lumOf(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }
/** 把颜色往黑推，直到与 target 的对比度 >= ratio（用于深色主色按钮：白字要够亮） */
const towardContrast = (hex, target, ratio) => {
  let out = hex
  for (let i = 0; i < 40 && contrastOf(out, target) < ratio; i++) out = mix(out, '#000000', 0.04)
  return out
}

/** 三元组字符串，供 `rgba(var(--x-rgb), α)` */
export const rgbOf = (hex) => { const c = hex2rgb(hex); return `${c.r}, ${c.g}, ${c.b}` }

// 中性色锚点（取自原味皮肤，保证推导结果落在熟悉的明度区间）
const L = { paper: '#ffffff', ink: '#241812', inkSoft: '#3c2c25', gray: '#5c534d', tint: '#6f6259', warm: '#d2c0a0', deep: '#5d4037', scrim: '#1e140c' }
const D = { base: '#140d09', surf: '#1f1610', surf2: '#241a13', raised: '#342821', hi: '#42342a', text: '#e8d3a0', textDim: '#cdb185', muted: '#bda173', tint: '#8a7a66' }

/** 浅色版：无论主色是什么色相，中性面都按主色微调（底色带一丝主色 → 整屏统一） */
function buildLight(p) {
  const strong = shade(p, -0.18)
  const deep = shade(p, -0.45)
  const soft = mix(L.paper, p, 0.17)
  const text = mix(L.ink, p, 0.34)
  return {
    '--primary': p,
    '--primary-strong': strong,
    '--primary-deep': deep,
    '--primary-soft': soft,
    '--primary-rgb': rgbOf(p),
    '--primary-strong-rgb': rgbOf(strong),
    '--primary-tint': p,
    '--primary-tint-rgb': rgbOf(p),
    '--accent': shade(p, 0.12),
    '--accent-strong': shade(p, -0.08),
    '--accent-rgb': rgbOf(shade(p, 0.12)),
    '--on-primary-tint': shade(p, 0.45),
    '--on-primary-tint-2': shade(p, 0.50),
    '--on-primary-tint-3': shade(p, 0.58),
    '--on-primary-tint-4': shade(p, 0.64),
    '--btn-primary-bg': towardContrast(p, '#ffffff', 4.5),
    '--btn-primary-border': shade(towardContrast(p, '#ffffff', 4.5), 0.14),
    '--btn-primary-hover': shade(towardContrast(p, '#ffffff', 4.5), 0.07),
    '--btn-primary-disabled-rgb': rgbOf(shade(p, -0.5)),
    '--accent': shade(p, 0.06),
    '--accent-strong': shade(p, -0.10),
    '--accent-rgb': rgbOf(shade(p, 0.06)),
    '--accent-strong-rgb': rgbOf(shade(p, -0.10)),
    '--bg': mix(L.paper, p, 0.055),
    '--card': mix(L.paper, p, 0.02),
    '--bg-soft': mix(L.paper, p, 0.035),
    '--sidebar-bg': mix(L.paper, p, 0.10),
    '--lock-bg': mix(L.paper, p, 0.075),
    '--border': mix(L.paper, p, 0.30),
    '--scrollbar': mix(L.paper, p, 0.45),
    '--text': text,
    '--text-dim': mix(L.inkSoft, p, 0.38),
    '--muted': mix(L.gray, p, 0.30), // 2026-09-26：0.38 时浅色下压在卡片底上 <4.5（DOM 对比度审计）
    '--panel-rgb': rgbOf(mix(L.paper, p, 0.02)),
    '--panel-soft-rgb': rgbOf(mix(L.paper, p, 0.035)),
    // 浅色玻璃面（行/卡片的高光底）：原先是各 .vue 里写死的 `rgba(255,255,255,0.6)`，
    // **每套皮肤下都是纯白、完全不跟皮肤**（实测 .card 跟着 --panel-soft-rgb 变色、.fest-ms 不变）。
    // 按主色推导后白色行底随皮肤走；原味是空覆盖 ⇒ 仍由 main.css 的 255,255,255 兜底，逐值不变。
    '--glass-rgb': rgbOf(mix(L.paper, p, 0.02)),
    '--panel-raised-rgb': rgbOf(mix(L.paper, p, 0.02)),
    '--panel-hi-rgb': rgbOf(mix(L.paper, p, 0.035)),
    '--tint-rgb': rgbOf(mix(L.tint, p, 0.45)),
    '--tint-warm-rgb': rgbOf(mix(L.warm, p, 0.30)),
    '--tint-deep-rgb': rgbOf(mix(L.deep, p, 0.35)),
    '--ink-rgb': rgbOf(text),
    '--scrim-rgb': rgbOf(mix(L.scrim, p, 0.25)),
    '--scrim-cool-rgb': rgbOf(mix(L.scrim, p, 0.25)),
    '--deep-soft-rgb': rgbOf(mix(L.deep, p, 0.25)),
    '--deepest-rgb': rgbOf(mix('#160f0a', p, 0.20)),
  }
}

/** 深色版：面板必须保持深色（e2e-dark 会判「深色下声明亮底」为 FAIL） */
function buildDark(pd) {
  const strong = shade(pd, 0.18)
  // 深色主题的主色按钮：底色要压深到与白字 ~5:1（原味的手工值 #b8502c 就是同一口径）
  const btnBg = towardContrast(pd, '#ffffff', 5)
  return {
    '--primary': pd,
    '--primary-strong': strong,
    '--primary-soft': mix('#1a120c', pd, 0.22),
    '--primary-rgb': rgbOf(pd),
    '--primary-strong-rgb': rgbOf(strong),
    '--primary-tint': pd,
    '--primary-tint-rgb': rgbOf(pd),
    '--accent': shade(pd, 0.12),
    '--accent-strong': shade(pd, -0.08),
    '--accent-rgb': rgbOf(shade(pd, 0.12)),
    '--on-primary-tint': shade(pd, 0.45),
    '--on-primary-tint-2': shade(pd, 0.50),
    '--on-primary-tint-3': shade(pd, 0.58),
    '--on-primary-tint-4': shade(pd, 0.64),
    '--btn-primary-bg': btnBg,
    '--btn-primary-border': shade(btnBg, 0.14),
    '--btn-primary-hover': shade(btnBg, 0.07),
    '--btn-primary-disabled-rgb': rgbOf(shade(pd, -0.5)),
    '--accent': pd,
    '--accent-strong': strong,
    '--accent-rgb': rgbOf(pd),
    '--accent-strong-rgb': rgbOf(strong),
    '--bg': mix(D.base, pd, 0.10),
    '--card': mix(D.surf, pd, 0.12),
    '--sidebar-bg': mix(D.surf, pd, 0.14),
    '--bg-soft': mix(D.surf, pd, 0.12),
    '--lock-bg': mix(D.surf, pd, 0.16),
    '--text': mix(D.text, pd, 0.12),
    '--text-dim': mix(D.textDim, pd, 0.15),
    '--muted': mix(D.muted, pd, 0.15),
    '--scrollbar': mix('#3a2b22', pd, 0.30),
    '--panel-rgb': rgbOf(mix(D.surf, pd, 0.12)),
    '--panel-soft-rgb': rgbOf(mix(D.surf2, pd, 0.12)),
    // 深色下玻璃面**保持浅色**：深色侧的面底由上面这些 `--panel-*-rgb` 的深色规则单独管，
    // 而 `inset 0 1px 0 rgba(255,255,255,…)` 这类同一字面量承担的是「高光」，改成深色会把高光抹掉。
    '--glass-rgb': '255, 255, 255',
    '--panel-raised-rgb': rgbOf(mix(D.raised, pd, 0.12)),
    '--panel-hi-rgb': rgbOf(mix(D.hi, pd, 0.12)),
    '--tint-rgb': rgbOf(mix(D.tint, pd, 0.35)),
    '--ink-rgb': rgbOf(mix(D.tint, pd, 0.20)),
    '--scrim-rgb': rgbOf(mix('#120b07', pd, 0.15)),
    '--scrim-cool-rgb': rgbOf(mix('#120b07', pd, 0.15)),
    '--deep-soft-rgb': rgbOf(mix('#241812', pd, 0.15)),
    '--deepest-rgb': rgbOf(mix('#0f0a06', pd, 0.15)),
  }
}

function makeSkin({ id, name, icon, need, light, dark, desc }) {
  return { id, name, icon, need, desc, vars: buildLight(light), varsDark: buildDark(dark) }
}

export const SKINS = [
  {
    id: 'classic', name: '原味', icon: '🍚', need: 0,
    vars: {}, varsDark: {}, // 空 = 用主题默认色（暖橙 + 奶油底）
    desc: '默认配色：暖橙主色、奶油底色',
  },
  makeSkin({ id: 'jade', name: '青瓷', icon: '🫖', need: 4, light: '#2f7d63', dark: '#4a9c80', desc: '青瓷釉色：豆青主色，静而清' }),
  makeSkin({ id: 'sakura', name: '樱花', icon: '🌸', need: 8, light: '#c0527a', dark: '#c96f96', desc: '樱花粉：春日的甜粉调' }),
  makeSkin({ id: 'matcha', name: '抹茶', icon: '🍵', need: 14, light: '#5f7d2f', dark: '#7f9440', desc: '抹茶绿：草本的青黄调' }),
  makeSkin({ id: 'salt', name: '海盐', icon: '🧂', need: 20, light: '#2f7a8a', dark: '#4d93a2', desc: '海盐青：带水汽的冷青调' }),
  makeSkin({ id: 'indigo', name: '靛蓝', icon: '🫐', need: 28, light: '#3f5a9c', dark: '#7189c0', desc: '靛蓝：染缸里的深蓝调' }),
  makeSkin({ id: 'plum', name: '梅子', icon: '🍑', need: 37, light: '#a2456b', dark: '#c97293', desc: '梅子红紫：偏甜的果酱色' }),
  makeSkin({ id: 'tomato', name: '番茄', icon: '🍅', need: 47, light: '#bf3b2b', dark: '#cf5f52', desc: '番茄红：比原味更红一档' }),
  makeSkin({ id: 'cinnamon', name: '桂皮', icon: '🥮', need: 58, light: '#8a5a2b', dark: '#b8874f', desc: '桂皮棕：烘焙里的暖木调' }),
  makeSkin({ id: 'amber', name: '琥珀', icon: '🍯', need: 70, light: '#b5791f', dark: '#bb8734', desc: '琥珀金棕：与金色描边最协调' }),
  makeSkin({ id: 'maroon', name: '豆沙', icon: '🍡', need: 83, light: '#8d4747', dark: '#c18282', desc: '豆沙红：沉稳的暗枣红' }),
  makeSkin({ id: 'truffle', name: '松露', icon: '🍄', need: 97, light: '#5c5148', dark: '#9d8f81', desc: '松露褐：近乎中性的灰褐调' }),
  makeSkin({ id: 'perilla', name: '紫苏', icon: '🍇', need: 112, light: '#6b4b9c', dark: '#9b83c6', desc: '紫苏紫：带蓝的深紫调' }),
  makeSkin({ id: 'turmeric', name: '姜黄', icon: '🟡', need: 128, light: '#9a7b12', dark: '#b08f26', desc: '姜黄：明亮的黄调香料色' }),
  makeSkin({ id: 'ink', name: '水墨', icon: '🖌️', need: 145, light: '#4a5568', dark: '#7d92ac', desc: '水墨灰青：去彩的极简配色' }),
]

/** 每套（非原味）皮肤必须给出的键（守卫用：system_test 的皮肤组） */
export const SKIN_REQUIRED_KEYS = [
  '--primary', '--primary-strong', '--primary-deep', '--primary-soft',
  '--accent', '--accent-strong', '--accent-rgb',
  '--primary-rgb', '--primary-strong-rgb', '--primary-tint', '--primary-tint-rgb',
  '--on-primary-tint', '--on-primary-tint-2', '--on-primary-tint-3', '--on-primary-tint-4', '--btn-primary-bg', '--btn-primary-border', '--btn-primary-hover', '--btn-primary-disabled-rgb',
  '--accent', '--accent-strong', '--bg', '--card', '--bg-soft', '--sidebar-bg', '--lock-bg',
  '--border', '--scrollbar', '--text', '--text-dim', '--muted',
  '--panel-rgb', '--panel-soft-rgb', '--glass-rgb', '--tint-rgb', '--ink-rgb', '--scrim-rgb',
]

const SKIN_INDEX = new Map(SKINS.map((s) => [s.id, s]))

export function getSkin(id) {
  return SKIN_INDEX.get(id) ?? SKINS[0]
}

/** 是否已解锁（按成就数） */
export function skinUnlocked(id, achievementCount = 0) {
  return achievementCount >= (getSkin(id).need ?? 0)
}

/** 取某皮肤在指定主题下要写的变量（原味返回空对象 = 用主题默认） */
export function skinVars(id, theme = 'light') {
  const skin = SKIN_INDEX.get(id)
  if (!skin) return {}
  return (theme === 'dark' ? skin.varsDark : skin.vars) ?? {}
}

/** 把皮肤变量写到 <html> 行内样式；先清掉所有皮肤可能写过的变量，避免上一套残留 */
export function applySkinToDom(id, theme = 'light') {
  if (typeof document === 'undefined') return
  const el = document.documentElement
  for (const s of SKINS) for (const k of new Set([...Object.keys(s.vars ?? {}), ...Object.keys(s.varsDark ?? {})])) el.style.removeProperty(k)
  for (const [k, v] of Object.entries(skinVars(id, theme))) el.style.setProperty(k, v)
}
