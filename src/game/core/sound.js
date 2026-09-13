// 轻量音效 / 背景音乐系统 — 全部 Web Audio **合成**（无外部音频资源），受设置里的
//   `soundEnabled`（音效）/ `bgmEnabled`（背景音乐）/ `sfxVolume` / `bgmVolume` 控制。
// 用法：事件桥接在 App.vue 里注册一次（全局点击音 + 各 EventBus 事件）；BGM 由 App.vue 按
//   主题（昼/夜）与是否在战斗中切换曲目；设置面板改音量时调用 setSfxVolume / setBgmVolume。
let ctx = null
let master = null // 音效总线（音量可调）
let musicGain = null // 音乐总线
let sfxVol = 0.6
let bgmVol = 0.35

function ensureCtx() {
  if (typeof window === 'undefined') return null // 非浏览器（测试）静默
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)()
      master = ctx.createGain()
      master.gain.value = sfxVol
      master.connect(ctx.destination)
      musicGain = ctx.createGain()
      musicGain.gain.value = bgmVol
      musicGain.connect(ctx.destination)
    }
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  } catch {
    return null
  }
}

/** 音效音量（0~1）：设置面板即时生效 */
export function setSfxVolume(v) {
  sfxVol = Math.max(0, Math.min(1, Number(v) || 0))
  if (master) master.gain.value = sfxVol
}
/** 音乐音量（0~1） */
export function setBgmVolume(v) {
  bgmVol = Math.max(0, Math.min(1, Number(v) || 0))
  if (musicGain) musicGain.gain.value = bgmVol
}

/** 单音合成：freq 频率 / dur 时长 / type 波形 / gain 音量 / when 延迟秒 / music 走音乐总线 */
function tone(freq, dur, type = 'sine', gain = 0.12, when = 0, music = false) {
  const c = ensureCtx()
  if (!c) return
  try {
    const osc = c.createOscillator()
    const g = c.createGain()
    osc.type = type
    osc.frequency.value = freq
    const t = c.currentTime + when
    g.gain.setValueAtTime(Math.max(0.0001, gain), t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    osc.connect(g)
    g.connect((music ? musicGain : master) ?? c.destination)
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
  // ── v2.1 扩充（14 个）──
  tab: () => tone(760, 0.04, 'sine', 0.04), // 页签切换
  coin: () => { tone(1046, 0.06, 'triangle', 0.08); tone(1318, 0.1, 'triangle', 0.07, 0.05) }, // 金币入账
  buy: () => { tone(392, 0.07, 'square', 0.08); tone(587, 0.12, 'square', 0.08, 0.06) }, // 购买 / 签约
  open: () => { tone(392, 0.1, 'triangle', 0.1); tone(523, 0.1, 'triangle', 0.1, 0.08); tone(659, 0.2, 'triangle', 0.1, 0.16) }, // 开箱 / 领档
  error: () => { tone(196, 0.1, 'square', 0.09); tone(147, 0.16, 'square', 0.09, 0.08) }, // 不可操作
  unlock: () => { tone(784, 0.09, 'triangle', 0.1); tone(1046, 0.12, 'triangle', 0.1, 0.08); tone(1318, 0.22, 'triangle', 0.1, 0.17) }, // 成就 / 天赋解锁
  prestige: () => { tone(262, 0.2, 'triangle', 0.12); tone(392, 0.2, 'triangle', 0.12, 0.14); tone(523, 0.28, 'triangle', 0.12, 0.28); tone(784, 0.4, 'triangle', 0.11, 0.44) }, // 转生
  mail: () => { tone(880, 0.07, 'sine', 0.07); tone(1175, 0.1, 'sine', 0.06, 0.06) }, // 到货 / 新邮件
  friend: () => { tone(587, 0.08, 'sine', 0.08); tone(880, 0.12, 'sine', 0.07, 0.07) }, // 拜访 / 社交
  serve: () => { tone(659, 0.07, 'triangle', 0.09); tone(988, 0.12, 'triangle', 0.08, 0.06) }, // 上菜 / 交付
  tower: () => { tone(440, 0.08, 'triangle', 0.09); tone(660, 0.1, 'triangle', 0.09, 0.07); tone(880, 0.16, 'triangle', 0.09, 0.15) }, // 爬塔推进
  boss: () => { tone(110, 0.3, 'sawtooth', 0.1); tone(165, 0.34, 'sawtooth', 0.09, 0.12) }, // 首领登场
  tick: () => tone(1320, 0.04, 'square', 0.05), // 计时到 / 刷新
  offline: () => { tone(523, 0.14, 'sine', 0.09); tone(392, 0.2, 'sine', 0.08, 0.12) }, // 离线结算
}

// ── 背景音乐：极简音序器（前瞻调度，无音频资源）────────────────
// 每首曲子 = 主旋律（五声音阶循环）+ 低音（每 N 拍一次）；音量压得很低，作为环境音。
const TRACKS = {
  day: { bpm: 84, wave: 'triangle', notes: [523, 587, 659, 784, 659, 587, 523, 440], bass: [131, 175], bassEvery: 4 },
  night: { bpm: 60, wave: 'sine', notes: [440, 523, 659, 587, 523, 440, 392, 349], bass: [110, 131], bassEvery: 4 },
  battle: { bpm: 132, wave: 'square', notes: [330, 392, 494, 440, 392, 330, 294, 330], bass: [82, 110], bassEvery: 2 },
}
let bgmTimer = null
let bgmTrack = null
let nextNoteAt = 0
let stepIndex = 0

function scheduleBgm() {
  const c = ensureCtx()
  if (!c || !bgmTrack) return
  const t = TRACKS[bgmTrack]
  const beat = 60 / t.bpm
  // 前瞻 0.6 秒：把到点的音符排进去（避免 setInterval 抖动造成断音）
  while (nextNoteAt < c.currentTime + 0.6) {
    const when = Math.max(0, nextNoteAt - c.currentTime)
    tone(t.notes[stepIndex % t.notes.length], beat * 0.9, t.wave, 0.05, when, true)
    if (stepIndex % t.bassEvery === 0) tone(t.bass[Math.floor(stepIndex / t.bassEvery) % t.bass.length], beat * 1.8, 'sine', 0.045, when, true)
    nextNoteAt += beat
    stepIndex++
  }
}

export const bgm = {
  /** 播放/切换曲目（day | night | battle）；同一曲目重复调用不重启 */
  play(id) {
    const c = ensureCtx()
    if (!c || !TRACKS[id]) return
    if (bgmTrack === id && bgmTimer) return
    this.stop()
    bgmTrack = id
    stepIndex = 0
    nextNoteAt = c.currentTime + 0.1
    scheduleBgm()
    bgmTimer = setInterval(scheduleBgm, 200)
  },
  stop() {
    if (bgmTimer) clearInterval(bgmTimer)
    bgmTimer = null
    bgmTrack = null
  },
  current() {
    return bgmTrack
  },
  playing() {
    return !!bgmTimer
  },
  /** 曲目表（设置面板展示用） */
  tracks() {
    return Object.keys(TRACKS)
  },
}

/** 供设置面板即时开关（首次调用时调用它解锁 AudioContext） */
export function primeAudio() {
  ensureCtx()
}
