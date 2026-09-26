// 像素美食套「1:1 实机尺寸」样张：用**交付的真实 PNG** 按真实 css 尺寸拼一页，浅色/深色各截一张。
//
// 为什么要有它：本项目两次换皮都栽在「先接全站再给用户看」。这个脚本不动 src/、不动游戏，
// 只读 public/images/ui-food-pixel/ 里的图，按 manifest 的 slice_px / css_size 拼出控件，截图给人看。
//
// 🔴 三条纪律（前两条照抄 AGENTS「九宫格切图」，第三条是这个脚本自己踩出来的）：
//   ① `url()` 一律写**单引号**（声明拼进 style="…" 会被内层双引号截断）；
//   ② 换皮去圆角（border-radius: 0），否则圆角会把 border-image 的角切掉；
//   ③ **尺寸一律读 manifest 的 `css_size`**（@2x 文件是它的两倍）——手写尺寸会把小件放大 2 倍，
//      样张就假了（第一版就是这么错的）。
//   ④ 页面必须**写盘后 goto(file://)**：`setContent()` 的文档是 about:blank，
//      Chromium 会静默拒绝它加载 file:// 图片 ⇒ 整页只剩文字。
// 用法：node scripts/dev/shot_pixel_ui.mjs
import fs from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { chromium } from 'playwright'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const DIR = join(root, 'public', 'images', 'ui-food-pixel')
const OUT = join(root, 'docs', 'ui-pixel', '_check')
const man = JSON.parse(fs.readFileSync(join(DIR, 'manifest.json'), 'utf8'))
const byId = new Map(man.map((e) => [e.id, e]))
const fileOf = (id) => join(DIR, `${id}@2x.png`)
const has = (id) => fs.existsSync(fileOf(id))
const url = (id) => pathToFileURL(fileOf(id)).href
const css = (id) => (byId.get(id)?.css_size ?? [16, 16])

/** 九宫格帧：slice 是导出像素，绘制宽度取一半（@2x → css px）
 *  🔴 默认 `round`：2026-09-23 验收定了这一档（`stretch` 会把 848px 宽卡片的右上角拉成斜纹，
 *     只有按实机尺寸拼才看得出来）。样张要和 pixel-skin.css 的实际取值一致，否则样张会说谎。 */
function frame(id, extra = '', repeat = 'round') {
  if (!has(id)) return `/* 缺 ${id} */`
  const e = byId.get(id)
  const w = e.slice_px ? e.slice_px / 2 : 4
  return `border:${w}px solid transparent; border-image:url('${url(id)}') ${e.slice_px} fill / ${w}px ${repeat}; ${extra}`
}
/** 固定尺寸小件：尺寸取 manifest.css_size，background-size 写 100% 100% */
function piece(id, extra = '') {
  if (!has(id)) return `/* 缺 ${id} */`
  const [w, h] = css(id)
  return `display:inline-block;width:${w}px;height:${h}px;background:url('${url(id)}') 0 0/100% 100% no-repeat; ${extra}`
}

const S = () => `
*{box-sizing:border-box;margin:0;padding:0}
body{font:13px/1.6 "Segoe UI","Microsoft YaHei",sans-serif;padding:18px;background:#6b5a49;color:#2b2118}
html.dark body{background:#15100c;color:#e8dcc8}
.row{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
.col{display:flex;flex-direction:column;gap:10px}
.h{font-size:11px;letter-spacing:.06em;opacity:.7;margin:6px 0 2px}
.shell{display:flex;gap:12px}
.side{width:250px;flex:0 0 250px;${frame('FRAME_PANEL')}padding:12px}
.main{flex:1;min-width:0;${frame('FRAME_PANEL')}padding:14px}
.tabs{display:flex;gap:8px;margin-bottom:12px}
.tab{height:24px;padding:0 12px;display:flex;align-items:center;justify-content:center;font-size:12px;${frame('FRAME_TAB')}}
.tab.on{${frame('FRAME_TAB_ON')}color:#fff8f0}
.card{${frame('FRAME_CARD')}padding:10px 14px}
.card h3{font-size:15px;margin-bottom:4px;display:flex;align-items:center;gap:8px}
.card p{font-size:12px;opacity:.85}
.acts{display:flex;gap:8px;margin-top:10px;align-items:center}
.gcard{width:214px;${frame('FRAME_CARD')}padding:10px}
.btn{height:24px;padding:0 14px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;background:none;color:inherit;font:inherit;font-size:12px;${frame('FRAME_BTN')}}
.btn.pri{height:32px;color:#fff6ee;font-weight:600;${frame('FRAME_BTN_PRIMARY')}}
.btn.dis{opacity:.45}
/* 进度条：槽与填充都按 1:1 原尺寸摆（不拉伸），这样看到的是素材真实观感 */
.bar{width:224px;height:18px;position:relative;background:url('${has('FRAME_BAR_SLOT') ? url('FRAME_BAR_SLOT') : ''}') 0 0/100% 100% no-repeat}
.bar i{position:absolute;left:6px;top:6px;height:6px;border-radius:0;
  background:url('${has('TEX_BAR_FILL') ? url('TEX_BAR_FILL') : ''}') 0 0/16px 16px repeat, #d82818}
input.f{width:180px;height:26px;background:none;color:inherit;font:inherit;font-size:12px;padding:0 10px;${frame('FRAME_INPUT')}}
.tile{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:10px;width:58px;text-align:center}
.tile img{image-rendering:pixelated}
.icon{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:10px;width:56px;text-align:center}
.icon img{image-rendering:pixelated}
.fixbar{display:flex;gap:15px;align-items:flex-start}
.fixbar>div{flex:1}
.tagname{font-size:11px;opacity:.8}
html.dark .card,html.dark .gcard{color:#f2e6ce}
`

const img = (id, size, label) =>
  has(id) ? `<div class="icon"><img src="${url(id)}" style="width:${size}px;height:${size}px" alt=""><span>${label}</span></div>` : ''
const tile = (id, label) => {
  if (!has(id)) return ''
  const [w] = css(id)
  return `<div class="tile"><img src="${url(id)}" style="width:${w}px;height:${w}px" alt=""><span>${label}</span></div>`
}

function page(dark) {
  const d = (id) => (dark && has(id + '_dark') ? id + '_dark' : id)
  return `<!doctype html><html class="${dark ? 'dark' : ''}"><head><meta charset="utf-8"><style>${S()}</style></head><body>
<div class="h">页签 · 徽章 / 勾 / 锁 / 食印 · 输入框 · 按钮</div>
<div class="tabs"><div class="tab on">今日</div><div class="tab">采集</div><div class="tab">制作</div><div class="tab">图鉴</div><div class="tab">设置</div></div>
<div class="row">
  <span style="${piece(d('BADGE_S'))}"></span>
  <span style="${piece(d('BADGE_M'))}"></span>
  <span style="${piece(d('BADGE_L'))}"></span>
  <span style="display:inline-flex;align-items:center;gap:6px"><span style="${piece('CHECK_ON_S')}"></span>已完成</span>
  <span style="display:inline-flex;align-items:center;gap:6px"><span style="${piece('CHECK_OFF_S')}"></span>未完成</span>
  <span style="${piece('LOCK_PIXEL')}"></span>
  <span style="${piece('SEAL_BOWL')}"></span><span style="${piece('SEAL_SPOON')}"></span>
  <span style="${piece('SEAL_POT')}"></span><span style="${piece('SEAL_TEAPOT')}"></span>
  <span style="${piece('SEAL_STEAMER')}"></span><span style="${piece('SEAL_CHOP')}"></span>
</div>
<div class="row">
  <input class="f" placeholder="搜索食材">
  <button class="btn">普通按钮</button><button class="btn pri">开始烹饪</button><button class="btn dis">已锁定</button>
  <span style="${piece('COIN_PIXEL')}"></span><span style="${piece('TICKET_PIXEL')}"></span>
  <span style="${piece('CHEST_PIXEL')}"></span><span style="${piece('LETTER_PIXEL')}"></span>
  <span style="${piece('MEDAL_L')}"></span>
  <span style="${piece('ICON_ARROW')}"></span><span style="${piece('ICON_CLOSE')}"></span>
</div>

<div class="h">🔴 同一张 FRAME_CARD 拉到 848px 宽：border-image-repeat 的三种取值对比（本次最大的观感问题）</div>
<div class="fixbar" style="margin-bottom:14px">
  <div><div class="tagname">stretch（现状）</div><div style="${frame(d('FRAME_CARD'))}height:56px;padding:8px 12px">长卡片会被拉出斜纹</div></div>
  <div><div class="tagname">round（平铺取整）</div><div style="${frame(d('FRAME_CARD'), '', 'round')}height:56px;padding:8px 12px">碎边重复出现</div></div>
  <div><div class="tagname">repeat（平铺）</div><div style="${frame(d('FRAME_CARD'), '', 'repeat')}height:56px;padding:8px 12px">末端可能截断</div></div>
</div>

<div class="shell">
  <div class="side">
    <div class="h">侧栏面板 + 功能磁贴（ICON_TILE，54×54）</div>
    <div class="row" style="gap:2px">
      ${tile('ICON_TILE_01_today', '今日')}${tile('ICON_TILE_09_shop', '商店')}${tile('ICON_TILE_11_alchemy', '炼金')}
      ${tile('ICON_TILE_23_shanhai', '山海')}${tile('ICON_TILE_41_minigames', '小游戏')}${tile('ICON_TILE_48_achievements', '成就')}
    </div>
    <div class="h">分组头（ICON_GROUP，18×18）</div>
    <div class="row" style="gap:4px">
      ${img('ICON_GROUP_01', 18, '分组1')}${img('ICON_GROUP_02', 18, '分组2')}${img('ICON_GROUP_03', 18, '分组3')}${img('ICON_GROUP_04', 18, '分组4')}
    </div>
    <div class="h">进度条（FRAME_BAR_SLOT + TEX_BAR_FILL）</div>
    <div class="col">
      <div class="bar"><i style="width:72%"></i></div>
      <div class="bar"><i style="width:38%"></i></div>
      <div class="bar"><i style="width:91%"></i></div>
    </div>
  </div>

  <div class="main">
    <div class="h">主区面板里的卡片（FRAME_CARD，宽度按游戏里的真实档位）</div>
    <div class="col">
      <div class="card">
        <h3><span style="${piece('SEAL_BOWL')}"></span>苹果采摘 · Lv.42</h3>
        <p>成熟度 78% · 预计 12 秒后成熟 · 附产概率 4.2%</p>
        <p style="opacity:.75">低目标经验减半：目标等级低于技能等级 5 级及以上时，获得的经验减半。</p>
        <div class="acts"><button class="btn pri">开始</button><button class="btn">详情</button><button class="btn">配方树</button>
          <span style="${piece('BADGE_M')}"></span><span style="${piece('CHECK_ON_S')}"></span></div>
      </div>
      <div class="row">
        <div class="gcard"><h3><span style="${piece('SEAL_SPOON')}"></span>松木长凳</h3>
          <p>材料：松木×4 + 铁矿×4</p><div class="acts"><button class="btn">制作 ×5</button></div></div>
        <div class="gcard"><h3><span style="${piece('SEAL_STEAMER')}"></span>烟熏鲑鱼</h3>
          <p>材料：鲑鱼×2 + 海盐×3</p><div class="acts"><button class="btn pri">制作</button></div></div>
      </div>
    </div>
    <div class="h">技能（18×18）/ 小游戏（24×24）/ 动作（16×16）图标</div>
    <div class="row" style="gap:2px">
      ${img('ICON_SKILL_01_foraging', 18, '采摘')}${img('ICON_SKILL_08_cooking', 18, '烹饪')}
      ${img('ICON_SKILL_19_spiritSummoning', 18, '食灵')}${img('ICON_SKILL_22_exploration', 18, '探索')}
      ${img('ICON_GAME_01', 24, '火候炉')}${img('ICON_GAME_05', 24, '拼图')}${img('ICON_GAME_17', 24, '贪吃蛇')}
      ${img('ICON_ACT_01', 16, '关闭')}${img('ICON_ACT_03', 16, '设置')}${img('ICON_ACT_13', 16, '加号')}
      ${img('ICON_ACT_05', 16, '筛选')}${img('ICON_ACT_06', 16, '刷新')}
    </div>
  </div>
</div>
</body></html>`
}

const browser = await chromium.launch()
fs.mkdirSync(OUT, { recursive: true })
for (const dark of [false, true]) {
  const htmlPath = join(OUT, `样张-像素美食-${dark ? '深色' : '浅色'}.html`)
  fs.writeFileSync(htmlPath, page(dark), 'utf8')
  const p = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 })
  const failed = []
  p.on('requestfailed', (r) => failed.push(r.url()))
  await p.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' })
  await p.waitForTimeout(300)
  const st = await p.evaluate(() => {
    const ims = [...document.images]
    return { loaded: ims.filter((i) => i.naturalWidth).length, broken: ims.filter((i) => !i.naturalWidth).length }
  })
  if (st.broken || failed.length) console.log(`⚠️ ${dark ? '深色' : '浅色'}：${st.broken} 张图未加载，请求失败 ${failed.length} 条`, failed.slice(0, 3))
  const f = join(OUT, `样张-像素美食-${dark ? '深色' : '浅色'}.png`)
  await p.screenshot({ path: f, fullPage: true })
  console.log(`已截图 ${f}（img 加载 ${st.loaded} 张）`)
  await p.close()
}
await browser.close()
