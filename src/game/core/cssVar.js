// 读 <html> 上的 CSS 变量 —— 供 **canvas / JS 内联样式** 等用不了 `var()` 的地方使用。
// 皮肤（`data/skins.js`）把变量写在 <html> 行内样式上，因此这里读到的就是当前皮肤的值。
// 非浏览器环境（测试脚本）返回 fallback，不抛错。

const FALLBACK = {
  '--primary': '#d95a38',
  '--primary-strong': '#b8442a',
  '--primary-tint-rgb': '217, 90, 56',
  '--primary-rgb': '217, 90, 56',
}

/** 取变量值（去掉首尾空白）；不存在时返回 fallback */
export function cssVar(name, fallback = FALLBACK[name] ?? '') {
  if (typeof document === 'undefined') return fallback
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return v || fallback
  } catch {
    return fallback
  }
}

/** 把 `--x-rgb` 三元组变量拼成 rgba(...) 字符串；变量缺失时用 fallback 三元组 */
export function cssRgb(name, alpha = 1, fallbackTriplet = '217, 90, 56') {
  const tri = cssVar(name, fallbackTriplet)
  return `rgba(${tri}, ${alpha})`
}
