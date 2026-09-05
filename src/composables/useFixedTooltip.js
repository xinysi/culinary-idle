// 滚动容器内 tooltip 防裁剪：fixed 定位跟随鼠标（鼠标右下方，越界翻转）
// 用法：hover 源元素（item-cell / opp-row 等）加
//   @mouseenter="bindTip($event)" @mousemove="bindTip($event)"
// 并在其内部放置 <div class="tooltip follow-tooltip">（事件绑定在父级，tooltip 自身不可交互）
//
// 注意：CSS 中 transform / filter / backdrop-filter / will-change / contain 会劫持
// position: fixed 的包含块。若 tooltip 位于带这些属性的祖先内（如 .main-scroll 的
// backdrop-filter: blur），clientX/clientY（视口坐标）与 fixed 基准不一致会导致 tooltip
// 偏离光标很远。这里先把 fixed 置 0 读取包含块原点，再用相对它的坐标定位。
export function bindTip(e) {
  const host = e.currentTarget
  const tip = host.querySelector('.follow-tooltip')
  if (!tip) return
  const w = tip.offsetWidth || 240
  const h = tip.offsetHeight || 120
  // 先把 fixed 置 0,0，读其 getBoundingClientRect()，即可得到「fixed 包含块原点」在视口的位置。
  // 这样不管包含块是视口，还是被 transform/filter/backdrop-filter 劫持的祖先，原点都准确，
  // 不至于用 clientX/clientY（视口坐标）去对错误的基准导致浮窗偏离光标。
  tip.style.position = 'fixed'
  tip.style.left = '0px'
  tip.style.top = '0px'
  const or = tip.getBoundingClientRect()
  const ox = or.left
  const oy = or.top
  let x = e.clientX - ox + 14
  let y = e.clientY - oy + 14
  if (x + w > window.innerWidth - 4) x = Math.max(4, e.clientX - ox - w - 10)
  if (y + h > window.innerHeight - 4) y = Math.max(4, e.clientY - oy - h - 10)
  tip.style.left = `${x}px`
  tip.style.top = `${y}px`
}
