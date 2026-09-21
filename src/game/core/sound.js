// 轻量音效 / 背景音乐系统 — 音效全部 Web Audio **合成**；BGM 优先放**真实音频**（2026-09-17 起，
//   `public/audio/bgm/*.mp3`，曲库见 `game/data/bgmTracks.js`），文件缺失/解码失败时回落到本文件里的合成曲。
// 受设置里的 `soundEnabled`（音效）/ `bgmEnabled`（背景音乐）/ `sfxVolume` / `bgmVolume` 控制。
// 用法：事件桥接在 App.vue 里注册一次（全局点击音 + 各 EventBus 事件）；BGM 由 App.vue 的 `syncBgm()`
//   （**唯一调用点**）按「场景 / 手动选曲」切换；设置面板与右下角播放器改音量时调用 setSfxVolume / setBgmVolume。
import { BGM_TRACKS, bgmUrl, bgmTrackVolume, getBgmTrack } from '../data/bgmTracks.js'

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
/** 音乐音量（0~1）：合成版走 musicGain，真实音频即时改元素音量 */
export function setBgmVolume(v) {
  bgmVol = Math.max(0, Math.min(1, Number(v) || 0))
  if (musicGain) musicGain.gain.value = bgmVol
  // 改音量要打断正在进行的淡变；而「切曲的淡出」被中途打断会留下一首**淡到一半的旧曲**继续出声
  // → 这里顺手把「不是当前曲目」的元素一律停掉并复位（保证任意时刻只有一首在响）
  for (const [id, el] of audioEls) {
    cancelFade(el)
    if (id === realTrack) continue
    if (!el.paused) {
      try {
        el.pause()
        el.currentTime = 0
      } catch {
        /* noop */
      }
    }
    el.volume = 0
  }
  if (realTrack) setElVolume(realTrack)
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

// ── 真实音频 BGM（2026-09-17）────────────────────────────────
// 用 HTMLAudioElement 播 public/audio/bgm/*.mp3；循环、交叉淡入淡出（1.2s）。
// 两层衰减见 bgmTracks.js（每首 trim + BGM_MASTER_TRIM）——这些是母带级响度的成品曲，
// 不压就会盖过游戏音效。任一文件加载失败 ⇒ 该曲目标记为不可用并回落到合成音序器（见下）。
const FADE_MS = 1200
const audioEls = new Map() // id -> HTMLAudioElement
const audioUnavailable = new Set() // 加载失败/不存在的曲目 id
const fadeTimers = new Map() // el -> 该元素自己的淡变定时器（**必须按元素分**，见下）
let realTrack = null // 当前真实音频曲目 id（含"暂停中"的那首）
let paused = false // 用户按了暂停（不停 bgmEnabled）
let playMode = 'repeat' // 'repeat' 单曲循环（默认，与 el.loop 一致）| 'sequence' 顺序 | 'shuffle' 随机
let endedCb = null // 顺序/随机模式下「这首放完」的回调（由 App.vue 注册：决定下一首，仍走 syncBgm 播放）

/** 取（或创建）某曲目的 audio 元素；首次会设置 loop 与初始音量 */
function audioFor(id) {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null
  if (audioUnavailable.has(id)) return null
  let el = audioEls.get(id)
  if (!el) {
    const url = bgmUrl(id)
    if (!url) return null
    el = new Audio(url)
    el.loop = playMode === 'repeat' // 顺序/随机模式下不循环，靠 ended 事件换下一首
    el.preload = 'auto'
    el.volume = 0
    el.addEventListener('ended', () => {
      // 单曲循环由 el.loop 处理（不会触发 ended）；顺序/随机模式下曲子放完 → 交给上层换下一首
      if (endedCb) endedCb(id)
      else el.currentTime = 0
    })
    el.addEventListener('error', () => {
      // 文件缺失/损坏：标记不可用 → 回落合成版（打包漏文件时游戏仍有声音）
      audioUnavailable.add(id)
      audioEls.delete(id)
      if (realTrack === id) {
        realTrack = null
        synthFallbackFor(id)
      }
    })
    audioEls.set(id, el)
  }
  return el
}

/** 合成版回落：把真实曲目 id 映射到最近的合成曲（day/night/battle） */
function synthFallbackFor(id) {
  const tr = getBgmTrack(id)
  const scene = tr?.scene ?? 'day'
  const synthId = scene === 'duel' || scene === 'boss' ? 'battle' : scene === 'night' ? 'night' : 'day'
  startSynth(synthId)
}

function setElVolume(id) {
  const el = audioEls.get(id)
  if (el) el.volume = bgmTrackVolume(id, bgmVol)
}

/** 取消某元素正在进行的淡变（只取消它自己的） */
function cancelFade(el) {
  const t = fadeTimers.get(el)
  if (t) {
    clearInterval(t)
    fadeTimers.delete(el)
  }
}

/**
 * 淡变到目标音量。
 * ⚠️ 定时器**必须按元素存**：2026-09-17 用户报「点其它音乐时原本的不中断、会重叠播放」——
 * 根因就是这里原先只有一个全局 `realFadeTimer`：切曲时「旧曲淡出」与「新曲淡入」两次调用，
 * 后者的 clearInterval 会把前者的淡出打断 → 旧曲的完成回调永不执行 → 它一直以原音量播下去。
 */
function fadeTo(el, target, ms, done) {
  cancelFade(el)
  const steps = Math.max(1, Math.round(ms / 40))
  const from = el.volume
  let i = 0
  const timer = setInterval(() => {
    i++
    const k = Math.min(1, i / steps)
    try {
      el.volume = Math.max(0, Math.min(1, from + (target - from) * k))
    } catch {
      /* 元素被回收 */
    }
    if (k >= 1) {
      cancelFade(el)
      if (done) done()
    }
  }, 40)
  fadeTimers.set(el, timer)
}

/** 停掉真实音频；`keepPosition` = 暂停（保留播放进度，供继续播放），false = 复位 */
function stopReal(fade = true, keepPosition = false) {
  const id = realTrack
  if (!id) return
  const el = audioEls.get(id)
  if (!el) {
    realTrack = null
    return
  }
  const finish = () => {
    try {
      el.pause()
      if (!keepPosition) el.currentTime = 0
    } catch {
      /* noop */
    }
    if (!keepPosition) realTrack = null
  }
  if (!fade) {
    finish()
    return
  }
  fadeTo(el, 0, FADE_MS, finish)
}

function playReal(id) {
  const el = audioFor(id)
  if (!el) return false
  if (realTrack === id) {
    // 同一首：暂停中 → 继续（从原进度淡入）；已在播 → 什么都不做（别重头开始）
    if (el.paused) {
      el.volume = 0
      const p = el.play()
      if (p && typeof p.catch === 'function') p.catch(() => {})
      fadeTo(el, bgmTrackVolume(id, bgmVol), FADE_MS)
    }
    return true
  }
  const prev = realTrack ? audioEls.get(realTrack) : null
  if (prev && prev !== el) {
    // 交叉淡出旧曲（它有自己的定时器，不会被下面的淡入打断），同时淡入新曲
    fadeTo(prev, 0, FADE_MS, () => {
      try {
        prev.pause()
        prev.currentTime = 0
      } catch {
        /* noop */
      }
    })
  }
  realTrack = id
  el.volume = 0
  const p = el.play()
  if (p && typeof p.catch === 'function') p.catch(() => {}) // 自动播放被拦：等用户手势后 syncBgm 会再试
  fadeTo(el, bgmTrackVolume(id, bgmVol), FADE_MS)
  return true
}

// ── 背景音乐（合成版）：极简音序器（真实音频不可用时的回落）────
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

/** 合成版停止（内部用） */
const synthStop = () => {
  if (bgmTimer) clearInterval(bgmTimer)
  bgmTimer = null
  bgmTrack = null
}

/**
 * 合成版播放（内部用）：切到某首合成曲并启动前瞻调度。
 * 同一首已在放时直接返回（不重启、不从头发声）。没有 Web Audio 时静默失败。
 *
 * 2026-09-21 修：此前这里写的是 `synthPlayer.play(id)` / `synthActive` / `synthTimer` 三个
 * **从未声明的标识符** —— 真实音频缺失时本应回落到合成曲，实际抛 `ReferenceError`（实测
 * `bgm.play('battle')` → `synthPlayer is not defined`），也就是「打包漏了 mp3 就全程没有 BGM」。
 * 现在改为复用本模块已有的音序器状态（bgmTrack / bgmTimer / scheduleBgm）。
 */
function startSynth(id) {
  if (!TRACKS[id]) return false
  const c = ensureCtx()
  if (!c) return false
  if (bgmTrack === id && bgmTimer) return true // 已在放这首，别重启
  synthStop()
  bgmTrack = id
  stepIndex = 0
  // 起点要落在当前时间**之后**：若停在 0，下面的 while 会把「从 0 到现在」的音符一次性补发出来
  nextNoteAt = c.currentTime + 0.08
  scheduleBgm()
  bgmTimer = setInterval(scheduleBgm, 200) // lookahead：每 200ms 排未来 0.6 秒的音符，避免 setInterval 抖动断音
  return true
}

/**
 * 背景音乐统一出口（App.vue 的 syncBgm() 是唯一调用点）。
 *   play(id)   —— id 既可以是曲库里的真实曲目（bgmTracks.js），也可以是合成曲 day/night/battle
 *   pause()    —— 淡出并暂停（**保留进度**，用户按暂停用它；再次 play(同一 id) 会从原进度继续）
 *   stop()     —— 淡出停止并复位
 * 同一 id 重复调用不重启（playing 中直接返回、暂停中则继续）；真实音频优先，不可用则回落到合成版。
 */
export const bgm = {
  play(id) {
    paused = false
    if (getBgmTrack(id)) {
      if (playReal(id)) {
        synthStop() // 真实音频接手，停掉可能还在跑的合成版
        return
      }
      // 真实音频不可用（文件缺失/解码失败）→ 按该曲的场景回落到合成版。
      // 注意：这里**不能直接 return** —— 真实曲目 id（diner/market/…）不在 TRACKS 里，
      // 直接 return 会变成「静音」而不是回落（2026-09-21 修）。
      synthFallbackFor(id)
      return
    }
    if (!TRACKS[id]) return
    stopReal()
    startSynth(id)
  },
  /** 暂停（保留进度）：不改变 settings.bgmEnabled，也不清 settings.bgmTrack */
  pause() {
    if (paused) return
    paused = true
    if (realTrack) stopReal(true, true)
    synthStop()
  },
  stop() {
    paused = false
    stopReal()
    synthStop()
  },
  /** 是否处于「用户按了暂停」状态 */
  isPaused() {
    return paused
  },
  /** 当前曲目 id（真实音频优先） */
  current() {
    return realTrack ?? bgmTrack
  },
  playing() {
    if (paused) return false
    if (realTrack) {
      const el = audioEls.get(realTrack)
      return !!el && !el.paused
    }
    return !!bgmTimer
  },
  /** 正在出声的真实音频元素个数（守卫用：切曲后必须 ≤1，防「两首叠着放」回潮） */
  playingCount() {
    let n = 0
    for (const el of audioEls.values()) if (!el.paused) n++
    return n
  },
  /** 当前真实音频的播放进度（秒；暂停后仍可读——守卫用它验证「继续」不是从头开始） */
  position() {
    const el = realTrack ? audioEls.get(realTrack) : null
    return el ? el.currentTime : null
  },
  /** 当前曲目总时长（秒；没在放真实音频时为 null） */
  duration() {
    const el = realTrack ? audioEls.get(realTrack) : null
    return el && Number.isFinite(el.duration) ? el.duration : null
  },
  /** 跳转到指定秒（播放器 API；守卫也用它把曲子推到结尾来验证「放完接下一首」） */
  seek(sec) {
    const el = realTrack ? audioEls.get(realTrack) : null
    if (!el || !Number.isFinite(el.duration)) return false
    try {
      el.currentTime = Math.max(0, Math.min(el.duration, Number(sec) || 0))
      return true
    } catch {
      return false
    }
  },
  /** 当前元素是否循环（repeat 模式为 true；顺序/随机为 false，靠 ended 换下一首） */
  looped() {
    const el = realTrack ? audioEls.get(realTrack) : null
    return el ? el.loop : null
  },
  /** 曲库（设置面板 / 右下角播放器展示用） */
  tracks() {
    return BGM_TRACKS.map((x) => x.id)
  },
  /**
   * 播放模式：'repeat'（单曲循环，默认）/ 'sequence'（顺序）/ 'shuffle'（随机）。
   * 只有 repeat 用 `el.loop`；另两种靠 `ended` 事件交回上层（见 `onEnded`）。
   */
  setMode(mode) {
    playMode = mode === 'sequence' || mode === 'shuffle' ? mode : 'repeat'
    for (const el of audioEls.values()) {
      try {
        el.loop = playMode === 'repeat'
      } catch {
        /* noop */
      }
    }
    return playMode
  },
  mode() {
    return playMode
  },
  /**
   * 注册「这首放完」回调（顺序/随机模式用）。回调里由上层决定下一首并**通过 syncBgm 播放**
   * —— 引擎不写存档，保持「bgm.play 的唯一调用点是 syncBgm」这条纪律。
   */
  onEnded(cb) {
    endedCb = typeof cb === 'function' ? cb : null
  },
  /** 某曲目是否真的有音频文件可用（加载失败过的会被排除） */
  available(id) {
    if (!getBgmTrack(id)) return TRACKS[id] !== undefined
    return !audioUnavailable.has(id)
  },
  /** 当前是否在放真实音频（排查/测试用） */
  usingRealAudio() {
    return !!realTrack
  },
  /** 真实音频元素的实际音量（0~1；没在放真实音频时为 null）——播放器与守卫用它核对衰减是否生效 */
  realVolume() {
    if (!realTrack) return null
    const el = audioEls.get(realTrack)
    return el ? el.volume : null
  },
}

/** 供设置面板即时开关（首次调用时调用它解锁 AudioContext） */
export function primeAudio() {
  ensureCtx()
}
