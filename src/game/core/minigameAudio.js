// 小游戏音效：全进程共用一个 AudioContext
//
// 起因（2026-09-21 审计）：15 个小游戏页原先各自在模块作用域里 `new AudioContext()`，
// 而且**从不 close** —— 每进一次页面就留下一个真正的实时音频线程；`Match10View` 更严重，
// 每次响一声就新建一个。实测一局「凑凑消」created 57 / closed 0，而 **JS 堆完全不增长**
// （实测 51MB → 51MB），所以任何看堆内存的守卫都发现不了它。
//
// 一个页面只需要一个上下文 ⇒ 这里做成单例：数量恒为 1、天然有界，也就不需要 close。
// 注意：本模块有意**不复用 `game/core/sound.js` 的上下文**——小游戏提示音历来直连
// `ctx.destination`（不受 `sfxVolume` 总线缩放），复用会顺带改变响度，属于另一件事。
let ctx = null

function ensureCtx() {
  if (ctx) return ctx
  try {
    const AC = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null
    if (!AC) return null
    ctx = new AC()
  } catch {
    ctx = null // 非浏览器 / 被浏览器拒绝：静默降级，游戏照常跑
  }
  return ctx
}

/** 短提示音。参数与原先各页的本地实现完全一致，行为（波形/音量包络）不变。 */
export function beep(freq, dur = 0.1, type = 'sine', vol = 0.06) {
  const c = ensureCtx()
  if (!c) return
  try {
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type
    o.frequency.value = freq
    o.connect(g)
    g.connect(c.destination)
    g.gain.setValueAtTime(vol, c.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur)
    o.start()
    o.stop(c.currentTime + dur)
  } catch {
    /* 无音频环境忽略 */
  }
}

/** 供守卫自检：当前已创建的上下文数量（应恒为 0 或 1） */
export function contextCount() {
  return ctx ? 1 : 0
}
