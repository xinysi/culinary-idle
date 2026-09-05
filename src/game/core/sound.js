// 轻量音效系统 — Web Audio 合成（无外部资源），受 settings.soundEnabled 控制
// 用法：EventBus 桥接在 App.vue 注册一次（initSoundBridge），各事件自动发声
let ctx = null

function ensureCtx() {
  if (typeof window === 'undefined') return null // 非浏览器（测试）静默
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  } catch {
    return null
  }
}

/** 单音合成：freq 频率 / dur 时长 / type 波形 / gain 音量 / when 延迟秒 */
function tone(freq, dur, type = 'sine', gain = 0.12, when = 0) {
  const c = ensureCtx()
  if (!c) return
  try {
    const osc = c.createOscillator()
    const g = c.createGain()
    osc.type = type
    osc.frequency.value = freq
    const t = c.currentTime + when
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    osc.connect(g)
    g.connect(c.destination)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  } catch {
    /* 音效失败不影响游戏 */
  }
}

export const sfx = {
  click: () => tone(620, 0.05, 'square', 0.05),
  craft: () => { tone(520, 0.08, 'triangle', 0.1); tone(780, 0.1, 'triangle', 0.09, 0.06) },
  craftFail: () => tone(200, 0.16, 'sawtooth', 0.07),
  collect: () => tone(880, 0.06, 'sine', 0.08),
  levelup: () => { tone(523, 0.09, 'triangle', 0.1); tone(659, 0.09, 'triangle', 0.1, 0.07); tone(784, 0.16, 'triangle', 0.1, 0.14) },
  hit: () => tone(150, 0.05, 'square', 0.08),
  win: () => { tone(523, 0.1, 'triangle', 0.12); tone(784, 0.18, 'triangle', 0.12, 0.09) },
  lose: () => { tone(330, 0.13, 'sawtooth', 0.09); tone(220, 0.22, 'sawtooth', 0.09, 0.11) },
  reward: () => { tone(660, 0.08, 'triangle', 0.1); tone(990, 0.14, 'triangle', 0.1, 0.07) },
  warn: () => tone(290, 0.12, 'square', 0.07),
}

/** 供设置面板即时开关（首次调用时自动解锁 AudioContext） */
export function primeAudio() {
  ensureCtx()
}
