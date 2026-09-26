// 用 manifest.json 里的真实 CSS 把新素材拼成控件样张（九宫格 border-image / 固定小件 background），
// 再截图给人看 —— 这是切边参数对不对的验收方式（不看代码，看图）。
// ⚠️ CSS 必须在 Node 侧算好再注入页面：页面里没有 pathToFileURL（把函数 toString 注进去会 ReferenceError）。
// 用法：node scripts/dev/preview_ui_assets.mjs
import fs from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { chromium } from 'playwright'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const UI = join(root, 'docs/ui-assets/ui2')
const manifest = JSON.parse(fs.readFileSync(join(UI, 'manifest.json'), 'utf8'))

const url = (rel) => pathToFileURL(join(root, 'public', rel)).href

/** 把 manifest 的一条转成完整 CSS 声明串（帧=九宫格；小件=定尺寸背景） */
function cssOf(m) {
  const file = url(m.colour)
  if (m.pull && m.slice_px > 0) {
    const s = m.css
    return `width:${m.css_size[0]}px;height:${m.css_size[1]}px;border-style:solid;` +
      `border-width:${s['border-image-width']};` +
      // ⚠️ url() 必须用**单引号**：这些声明会被拼进 `style="..."`（双引号界定）的属性里，
      //    用双引号会把属性截断 ⇒ border-image 整条失效、控件退化成默认黑框（第一版就是这么翻车的）。
      `border-image-source:url('${file}');border-image-slice:${s['border-image-slice']};` +
      `border-image-repeat:${s['border-image-repeat']};box-sizing:border-box;`
  }
  const [ew, eh] = m.export_size
  // ⚠️ 导出的是 @2x：CSS 里要按**一半**的像素写，否则 32×13 的盒子会只显示 64×26 图的左上角（看不见）
  const w = m.pull ? m.css_size[0] : ew / 2
  const h = m.pull ? m.css_size[1] : eh / 2
  const size = m.pull ? '100% 100%' : `${ew / 2}px ${eh / 2}px`
  return `width:${w}px;height:${h}px;background-image:url('${file}');` +
    `background-size:${size};background-repeat:no-repeat;background-position:center;box-sizing:border-box;`
}

const CSS = Object.fromEntries(manifest.map((m) => [m.id, cssOf(m)]))
const bgUrl = Object.fromEntries(manifest.map((m) => [m.id, `url('${url(m.colour)}')`]))

const page = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>新素材验收样张</title>
<style>
 body{margin:0;padding:22px 26px 40px;background:#FAF7F2;color:#2B2622;
      font:13px/1.55 "Microsoft YaHei","PingFang SC",system-ui,sans-serif}
 h1{font-size:17px;margin:0 0 6px}
 .sub{color:#7C7268;font-size:12px;margin-bottom:16px}
 .row{display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap;margin-bottom:14px}
 .lbl{font-size:11px;color:#9a938a;margin-bottom:5px}
 .t{color:#7C7268}
</style></head><body>
<h1>新素材验收样张 · 用 manifest 里的 CSS 接上</h1>
<div class="sub">卡组 = FRAME_CARD 九宫格拉伸 + BADGE_S + LINE_CHOPSTICK + WM_PLATE(6%)；面板/弹窗/按钮/页签/输入框/进度条/小件全部取规范的实机尺寸。</div>
<div id="app"></div>
<script>
const C = ${JSON.stringify(CSS)};
const BG = ${JSON.stringify(bgUrl)};
const el = (id, extra) => '<div style="' + C[id] + (extra || '') + '"></div>';
function card(name){
  // 边框现在按轴换算成实机像素（卡片约 32/11px），内容区已被 border-width 自动内缩 ⇒ padding 只留一点
  return '<div style="position:relative;' + C.FRAME_CARD + 'padding:5px">'
   + '<span style="position:absolute;right:4px;bottom:2px;width:56px;height:56px;opacity:.06;background:' + BG.WM_PLATE + ' center/contain no-repeat"></span>'
   + '<div style="font-weight:600;font-size:13px;margin-bottom:6px">' + name
   + ' <span style="display:inline-block;vertical-align:middle;' + C.BADGE_S + '"></span></div>'
   + '<div style="display:flex;justify-content:space-between;font-size:11px"><span class="t">经验/次</span><span>450</span></div>'
   + '<div style="display:flex;justify-content:space-between;font-size:11px"><span class="t">间隔</span><span>3.0s</span></div>'
   + '<div style="height:4px;margin:7px 0 5px;background:' + BG.LINE_CHOPSTICK + ' center/100% 100% no-repeat"></div>'
   + '<div style="height:4px;margin-bottom:5px;background:' + BG.LINE_CHOPSTICK + ' center/100% 100% no-repeat"></div>'
   + '<div style="display:flex;justify-content:space-between;font-size:11px"><span class="t">效率</span><span>72.0 万/时</span></div>'
   + '</div>';
}
document.getElementById('app').innerHTML = \`
<div class="row"><div><div class="lbl">目标卡组 214×331（FRAME_CARD 九宫格 · BADGE_S · 筷子双线 · WM_PLATE 6%）</div>
  <div class="row">\${['苹果','桃子','杏','嫩生姜','嫩大蒜'].map(card).join('')}</div></div></div>
<div class="row" id="ctl">
  <div><div class="lbl">面板 250×420（FRAME_PANEL）+ 蒸气线</div>
    <div style="\${C.FRAME_PANEL}position:relative">
      <div style="position:absolute;left:12px;right:12px;top:8px;height:8px;opacity:.55;background:\${BG.STEAM_LINE} center/100% 100% no-repeat"></div>
      <div style="padding:26px 14px 12px;font-size:11px;color:#7C7268">面板内容…</div></div></div>
  <div><div class="lbl">弹窗 300×200（FRAME_MODAL）</div>
    <div style="\${C.FRAME_MODAL}font-size:11px;color:#7C7268;text-align:center;line-height:200px">弹窗内容</div></div>
  <div>
    <div class="lbl">按钮 70×24（FRAME_BTN 常态/禁用）· 主按钮 216×31（FRAME_BTN_RED + SEAL_BOWL）</div>
    <div class="row" style="align-items:center">
      <div style="\${C.FRAME_BTN}font-size:12px;text-align:center;line-height:24px">选择</div>
      <div style="\${C.FRAME_BTN}font-size:12px;text-align:center;line-height:24px;filter:grayscale(60%);opacity:.45">已满</div>
      <div style="\${C.FRAME_BTN_RED}display:flex;align-items:center;justify-content:center;gap:6px;color:#FFF8F2;font-weight:600">
        <span style="display:inline-block;\${C.SEAL_BOWL}"></span>采集</div>
    </div>
    <div class="lbl" style="margin-top:10px">页签 75×29（FRAME_TAB / FRAME_TAB_ON + 左竖标）</div>
    <div class="row" style="align-items:center">
      <div style="\${C.FRAME_TAB}font-size:12px;line-height:29px;text-align:center;color:#7C7268">烹饪</div>
      <div style="\${C.FRAME_TAB_ON}display:flex;align-items:center;gap:5px;color:#FFF8F2">
        <span style="display:inline-block;width:2px;height:15px;background:#FFF8F2"></span>采摘</div>
    </div>
    <div class="lbl" style="margin-top:10px">输入框 170×24（FRAME_INPUT）· 进度条 220×8（FRAME_BAR_SLOT + FRAME_BAR_FILL）</div>
    <div class="row" style="align-items:center">
      <div style="\${C.FRAME_INPUT}font-size:12px;line-height:24px;padding-left:8px;color:#9a938a">搜索物品…</div>
      <div style="\${C.FRAME_BAR_SLOT}position:relative">
        <span style="position:absolute;left:2px;top:1px;bottom:1px;width:62%;background:\${BG.FRAME_BAR_FILL} left center/100% 100% no-repeat"></span></div>
    </div>
  </div>
</div>
<div class="row" id="parts">
  <div><div class="lbl">徽章 32×13 / 45×22 / 76×22</div><div class="row" style="align-items:center">\${['BADGE_S','BADGE_M','BADGE_L'].map(k=>el(k)).join('')}</div></div>
  <div><div class="lbl">复选 16/22（off/on）</div><div class="row" style="align-items:center">\${['CHECK_OFF_S','CHECK_ON_S','CHECK_OFF_M','CHECK_ON_M'].map(k=>el(k)).join('')}</div></div>
  <div><div class="lbl">锁 13 · 竖笔三色</div><div class="row" style="align-items:center">
    \${el('LOCK_LINEWORK')}
    <div style="width:3px;height:30px;background:\${BG.LINE_STROKE_RED} center/100% 100% no-repeat"></div>
    <div style="width:3px;height:30px;background:\${BG.LINE_STROKE_COPPER} center/100% 100% no-repeat"></div>
    <div style="width:3px;height:30px;background:\${BG.LINE_STROKE_AMBER} center/100% 100% no-repeat"></div>
  </div></div>
  <div><div class="lbl">食印（含竖长印 SEAL_CHOP）</div><div class="row" style="align-items:flex-end">\${['SEAL_BOWL','SEAL_POT','SEAL_SPOON','SEAL_TEAPOT','SEAL_STEAMER','SEAL_CHOP'].map(k=>el(k)).join('')}</div></div>
  <div><div class="lbl">水印（6%）</div><div class="row">\${['WM_PLATE','WM_STEAMER','WM_CHOPREST'].map(k=>el(k,'opacity:.06;')).join('')}</div></div>
</div>
\`;
</script></body></html>`

const outHtml = join(root, 'docs/ui-mockup/新素材验收样张.html')
fs.writeFileSync(outHtml, page, 'utf8')
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 })
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(pathToFileURL(outHtml).href, { waitUntil: 'load' })
await p.waitForTimeout(800)
const outPng = join(root, 'docs/ui-mockup/素材切图验收.png')
await p.screenshot({ path: outPng, fullPage: true })
// 放大两处（控件区 / 小件区）：1:1 的整页图看不出 13px 的锁、16px 的复选框到底对不对
const shots = [['控件区', '#ctl'], ['小件区', '#parts']]
for (const [label, sel] of shots) {
  const el = await p.$(sel)
  if (!el) continue
  await el.screenshot({ path: join(root, `docs/ui-mockup/验收-${label}放大.png`) })
}
const d = await p.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }))
await b.close()
console.log('saved', outPng, d.w + 'x' + d.h)
if (errs.length) console.log('页面错误:', errs.slice(0, 3))
