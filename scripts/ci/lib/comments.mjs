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
