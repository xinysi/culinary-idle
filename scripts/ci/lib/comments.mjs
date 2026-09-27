// CI 守卫共用的「剥注释」小工具（2026-09-17）
// 为什么不能直接用 `src.replace(/\/\*[\s\S]*?\*\//g, '')`：
// 行注释或字符串里出现 `/*` 就会被当成块注释开头，把后面大段**代码**一起吃掉 ——
// 本轮实测踩到：`// 用 HTMLAudioElement 播 public/audio/bgm/*.mp3` 里的 `/*` 让 10 行代码消失，
// 于是「断言某写法不许出现」的守卫会对着一份残缺源码做判断（严重时变成恒真的假绿）。
// 本函数认三种状态：字符串（' " `）、行注释（//）、块注释（/* */），只在注释里才丢弃内容。
export function stripComments(src) {
  let out = ''
  let i = 0
  const n = src.length
  let quote = null
  while (i < n) {
    const c = src[i]
    const c2 = src[i + 1]
    if (quote) {
      out += c
      if (c === '\\') {
        out += c2 ?? ''
        i += 2
        continue
      }
      if (c === quote) quote = null
      i++
      continue
    }
    if (c === '/' && c2 === '/') {
      while (i < n && src[i] !== '\n') i++
      continue
    }
    if (c === '/' && c2 === '*') {
      i += 2
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++
      i += 2
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c
      out += c
      i++
      continue
    }
    out += c
    i++
  }
  return out
}

/**
 * 剥掉 `.vue` 模板里的 `<!-- … -->` 注释（2026-09-27 补）。
 * 为什么单独一条：`stripComments` 只管 **JS** 注释，模板注释会原样留下 ——
 * 于是「这个组件里不该再出现 X」这类断言会被**注释里提一句 X** 打回（我先在 C64 上踩到：
 * Sidebar 里写「原先那套浮层已删除」的说明，正好含 `.feature-flyout` 这个字样）。
 * 用法：扫 `.vue` 的模板/整文件时先 `stripHtmlComments(stripComments(src))`。
 */
export function stripHtmlComments(src) {
  return src.replace(/<!--[\s\S]*?-->/g, '')
}
