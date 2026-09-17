// 背景音乐曲库（2026-09-17）— 用户提供的 13 个真实音频（10 首正曲 + 3 首变奏），放在 public/audio/bgm/。
// 与旧的「Web Audio 合成 BGM」（sound.js 的 TRACKS）并存：真实音频优先，文件缺失/解码失败时自动回落到合成版。
//
// ⚠️ 响度：这 13 个文件是**母带级**响度（实测全曲 RMS −14 ~ −18.3 dBFS、峰值 −0.4 ~ −2.9 dBFS），
// 而游戏里的反馈音效是很轻的合成短音 —— 直接播放会「音乐盖过游戏」。
// 故两层衰减：① 每首 `trim` 把 RMS 校到同一基准（目标 −17 dBFS，见下表的实测值），
//            ② `BGM_MASTER_TRIM` 再整体压到背景级。最终音量 = settings.bgmVolume × BGM_MASTER_TRIM × trim。
export const BGM_MASTER_TRIM = 0.6 // ≈ −4.4dB：滑块拉满 ≈ −20dBFS（正常音乐），默认 0.35 ≈ −30dBFS（背景音）

/** 每首的响度校准（trim = 10^((−17 − 实测RMS)/20)，实测值见注释） */
const t = (rms) => Math.round(Math.pow(10, (-17 - rms) / 20) * 100) / 100

/**
 * 曲库。字段：
 *  - id     内部 id（= 文件名，也是存档里记的值）
 *  - name   显示名
 *  - file   public/audio/bgm/ 下的文件名
 *  - scene  自动播放时它负责哪个场景（变奏曲无 scene ⇒ 只能手动选）
 *  - desc   面板里的说明
 *  - trim   响度校准系数
 */
export const BGM_TRACKS = [
  { id: 'title', name: '山海晨光', file: 'title.mp3', scene: 'title', desc: '启动页 · 晨雾山间', trim: t(-18.3) },
  { id: 'day', name: '采撷昼日', file: 'day.mp3', scene: 'day', desc: '主界面 · 白天', trim: t(-16.9) },
  { id: 'night', name: '静夜灶前', file: 'night.mp3', scene: 'night', desc: '主界面 · 夜间', trim: t(-16) },
  { id: 'kitchen', name: '灶火慢烹', file: 'kitchen.mp3', scene: 'kitchen', desc: '制作 · 烹饪烘焙腌制酿造', trim: t(-16.1) },
  { id: 'kitchen2', name: '灶火慢烹 · 其二', file: 'kitchen2.mp3', desc: '变奏', trim: t(-15.5) },
  { id: 'diner', name: '堂前烟火', file: 'diner.mp3', scene: 'diner', desc: '餐厅经营 · 常客外卖宴会', trim: t(-16.1) },
  { id: 'duel', name: '厨艺切磋', file: 'duel.mp3', scene: 'duel', desc: '对决 · 竞技场试炼塔', trim: t(-16.6) },
  { id: 'boss', name: '山海盛宴', file: 'boss.mp3', scene: 'boss', desc: '首领战 · 秘境 · 塔高层', trim: t(-14) },
  { id: 'meditate', name: '食经修行', file: 'meditate.mp3', scene: 'meditate', desc: '山海食经 · 厨神之路', trim: t(-16.3) },
  { id: 'market', name: '夜市灯火', file: 'market.mp3', scene: 'market', desc: '夜市 · 节庆 · 赛季', trim: t(-16.8) },
  { id: 'market2', name: '夜市灯火 · 其二', file: 'market2.mp3', desc: '变奏', trim: t(-16.8) },
  { id: 'memory', name: '旧谱余香', file: 'memory.mp3', scene: 'memory', desc: '图鉴 · 故事 · 里程碑', trim: t(-16.1) },
  { id: 'memory2', name: '旧谱余香 · 其二', file: 'memory2.mp3', desc: '变奏', trim: t(-17.9) },
]

/** 场景 → 曲目 id（自动模式下用；变奏曲不参与自动播放，只能手动选） */
export const BGM_SCENE_TRACK = {
  title: 'title',
  day: 'day',
  night: 'night',
  kitchen: 'kitchen',
  diner: 'diner',
  duel: 'duel',
  boss: 'boss',
  meditate: 'meditate',
  market: 'market',
  memory: 'memory',
}

/** 场景显示名（面板提示用） */
export const BGM_SCENE_LABEL = {
  title: '启动页',
  day: '主界面·白天',
  night: '主界面·夜间',
  kitchen: '制作',
  diner: '餐厅经营',
  duel: '对决',
  boss: '首领战',
  meditate: '修行',
  market: '夜市节庆',
  memory: '图鉴故事',
}

const BY_ID = new Map(BGM_TRACKS.map((x) => [x.id, x]))
export const BGM_BASE = 'audio/bgm/'

/** 播放模式（2026-09-18）：单曲循环 / 顺序播放 / 随机播放 */
export const BGM_MODES = [
  { id: 'repeat', icon: '🔂', name: '单曲循环', desc: '这首放完从头再来' },
  { id: 'sequence', icon: '🔁', name: '顺序播放', desc: '放完自动接列表下一首' },
  { id: 'shuffle', icon: '🔀', name: '随机播放', desc: '放完随机换一首' },
]
export const BGM_MODE_IDS = BGM_MODES.map((m) => m.id)
export function getBgmMode(id) {
  return BGM_MODES.find((m) => m.id === id) ?? BGM_MODES[0]
}
/** 模式按钮的下一个模式（点一下轮流切） */
export function nextBgmMode(id) {
  const i = BGM_MODE_IDS.indexOf(getBgmMode(id).id)
  return BGM_MODE_IDS[(i + 1) % BGM_MODE_IDS.length]
}

/** 列表下一首（到底了回到第 1 首）；shuffle 时随机换一首（不会重复当前这首） */
export function nextTrackId(curId, mode = 'sequence', rand = Math.random) {
  const i = BGM_TRACKS.findIndex((t) => t.id === curId)
  if (mode === 'shuffle') {
    if (BGM_TRACKS.length <= 1) return BGM_TRACKS[0].id
    // 从「除当前这首以外」里随机抽，避免连点下一首还在原地
    const pool = BGM_TRACKS.filter((t) => t.id !== curId)
    return pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))].id
  }
  return BGM_TRACKS[(i + 1 + BGM_TRACKS.length) % BGM_TRACKS.length].id
}

/** 列表上一首（到头了回到最后一首）；shuffle 时同样走随机 */
export function prevTrackId(curId, mode = 'sequence', rand = Math.random) {
  if (mode === 'shuffle') return nextTrackId(curId, 'shuffle', rand)
  const i = BGM_TRACKS.findIndex((t) => t.id === curId)
  return BGM_TRACKS[(i - 1 + BGM_TRACKS.length) % BGM_TRACKS.length].id
}

export function getBgmTrack(id) {
  return BY_ID.get(id) ?? null
}
/** 曲目音频 URL（相对路径——与图片同理，Electron file:// 下根绝对路径会 404，见 AGENTS「静默失效 ⑤」） */
export function bgmUrl(id) {
  const tr = BY_ID.get(id)
  return tr ? BGM_BASE + tr.file : null
}
export function bgmTrackOfScene(scene) {
  return BGM_SCENE_TRACK[scene] ?? null
}
/** 该曲目的最终播放音量（0~1）：用户滑块 × 总衰减 × 每首校准 */
export function bgmTrackVolume(id, volume) {
  const tr = BY_ID.get(id)
  if (!tr) return 0
  const v = (Number(volume) || 0) * BGM_MASTER_TRIM * (tr.trim ?? 1)
  return Math.max(0, Math.min(1, v))
}
