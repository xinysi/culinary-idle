# 《美食放置：食灵山海》BGM 提示词（10 首）

> 2026-09-17 立。用途：给 AI 音乐生成工具（Suno / Udio / Stable Audio / 海绵音乐 / Mureka 等）产出 10 首**可循环的环境 BGM**。
> 设计基准：现有 BGM 是 Web Audio 合成的极简五声音阶（`src/game/core/sound.js`：day 84bpm triangle / night 60bpm sine / battle 132bpm square，音量 0.05 当环境音）。
> 新曲**保持同一套音乐语言**：中式民乐 + 五声音阶 + 极简配器 + 大量留白，**全程舒缓、无爆点**，音量压低当"房间里的空气"，不抢操作反馈音效。

---

## 一、通用规范（先读，10 首都适用）

### 音乐语言
| 项 | 规格 | 理由 |
| --- | --- | --- |
| 调式 | **五声音阶**（宫/羽调式为主，中国风"无半音"听感） | 与现有 day/night/battle 三首同源，混播不打架 |
| 配器 | 箫 / 笛 / 古筝 / 古琴 / 琵琶 / 扬琴 / 阮 / 笙 / 编钟 / 木鱼 / 钵 + 轻环境声（雨、炭火、风铃） | 中华民乐为骨；**禁用**：电音鼓组、失真吉他、铜管齐奏 |
| 音量 | 成品 −20 ~ −18 LUFS（比常规音乐低 6~8 dB） | 游戏里 BGM 是背景，玩家还要听点击/成功/失败音效 |
| 动态 | **全曲无明显爆点**：不要 drop、不要渐强到高潮、不要突然齐奏 | 用户明确要求"舒缓、不炸裂"；放置游戏要能长时间挂着听 |
| 人声 | **纯器乐（instrumental）**，无任何人声/吟唱/哼鸣 | 有人声会与游戏叙事抢注意力，也难做无缝循环 |
| 时长 | 建议 **1:30 ~ 2:30**，且**首尾可无缝循环**（末尾 2 秒不含收尾音、回到开头不突兀） | 挂机场景要循环几小时 |
| 格式 | 44.1kHz · 立体声 · MP3 **160~192 kbps**（或 OGG） | 体积与音质平衡（10 首约 20~30MB） |

### 提示词写法（关键三条）
1. **「纯器乐 + 舒缓 + 循环」必须写进提示词**：`instrumental, no vocals, calm, ambient, seamless loop, background music for an idle game`。AI 默认爱加人声和副歌爆点。
2. **负向提示词（negative）每首都带上**：`no vocals, no lyrics, no drum drops, no EDM, no dubstep, no sudden loud dynamics, no brass fanfare, no distortion, no dramatic climax`。
3. **明确乐器与速度**（`solo dizi flute, guzheng arpeggio, 60 BPM, pentatonic`）比"中国风"三个字有效得多。

### 落盘与命名（做好后放这里，我来接进游戏）
```
public/audio/bgm/
  title.mp3      # 1 山海晨光（启动页）
  day.mp3        # 2 采撷昼日（主界面·白天）
  night.mp3      # 3 静夜灶前（主界面·夜间）
  kitchen.mp3    # 4 灶火慢烹（制作/厨房）
  diner.mp3      # 5 堂前烟火（餐厅经营）
  duel.mp3       # 6 厨艺切磋（普通对决）
  boss.mp3       # 7 山海盛宴（首领战）
  meditate.mp3   # 8 食经修行（山海食经 / 厨神之路）
  market.mp3     # 9 夜市灯火（夜市/节庆/赛季）
  memory.mp3     # 10 旧谱余香（图鉴/故事/转生）
```
> 现在的 BGM 是代码合成的（`bgm.play('day'|'night'|'battle')`，由 `App.vue` 的 `syncBgm()` 单点调用）。
> 换成真实音频只需改 `sound.js` 一处（把音序器换成 `<audio>` 循环 + 交叉淡入淡出），**不影响存档与玩法**——需要的话说一声。

---

## 二、10 首逐条

### 1. 山海晨光 · 启动页 / 标题
- **播放位置**：启动界面（`.splash`）、选存档弹窗
- **情绪**：拂晓、悬念很轻、"翻开一本食经"的仪式感
- **规格**：60 BPM · 羽调式（A minor pentatonic）· 长笛（箫）+ 古筝点音 + 极轻的风铃声
- **结构**：8 小节引子（只有风铃与箫的长音）→ 16 小节主体（古筝每小节 2~3 个音）→ 循环
- **Prompt（EN）**：
  `instrumental Chinese ambient, solo xiao flute with long airy notes, sparse guzheng plucks, distant wind chimes, 60 BPM, pentatonic minor, very calm and spacious, dawn over misty mountains, minimal and contemplative, background music for a game title screen, no vocals, seamless loop, soft reverb`
- **Negative**：`no vocals, no drums, no percussion hits, no EDM, no sudden dynamics, no climax, no brass`
- **中文提示词**：`纯器乐中国风环境音乐，箫独奏长音，古筝稀疏点音，远处风铃，60 BPM，五声羽调式，极简留白，晨雾山间的黎明，游戏标题界面背景音乐，无人声，可无缝循环`

### 2. 采撷昼日 · 主界面（白天）
- **播放位置**：默认主界面（技能/采集/挂机页），对应现有 `day` 曲
- **情绪**：温和的日常、田园劳作、阳光但不刺眼
- **规格**：84 BPM · 宫调式（C major pentatonic）· 竹笛主旋律 + 阮/中阮伴奏 + 木鱼轻点 + 鸟鸣环境
- **结构**：笛子每 4 小节一句、句尾留 1 小节空拍；木鱼每 2 拍一下（**音量极小，只当心跳**）
- **Prompt（EN）**：
  `instrumental Chinese folk ambient, bamboo dizi flute melody, soft ruan lute accompaniment, light woodblock pulse, subtle birdsong ambience, 84 BPM, C major pentatonic, warm and pastoral, gentle daytime idle game background music, relaxed and unhurried, no vocals, seamless loop, low dynamics`
- **Negative**：`no vocals, no taiko, no drum kit, no EDM, no buildup, no loud climax, no distortion`
- **中文提示词**：`纯器乐中国田园风，竹笛主旋律，中阮轻伴奏，木鱼极轻节拍，鸟鸣环境声，84 BPM，五声宫调式，温暖闲适的白天，放置游戏主界面背景音乐，舒缓，无人声，无缝循环`

### 3. 静夜灶前 · 主界面（夜间）
- **播放位置**：深色主题下的主界面，对应现有 `night` 曲
- **情绪**：夜灯、炭火余温、安静但不冷
- **规格**：60 BPM · 羽调式 · 箫 + 古琴 + 低音笙持续音 + 极轻的炭火噼啪
- **结构**：古琴每 2 小节一次泛音，箫长音铺底；**几乎无节奏**（无鼓）
- **Prompt（EN）**：
  `instrumental Chinese night ambient, low xiao flute drones, sparse guqin harmonics, sustained sheng pad, faint crackling charcoal fire, 60 BPM, pentatonic minor, intimate and still, lamplight in a quiet kitchen at night, cozy idle game background music, no percussion, no vocals, seamless loop`
- **Negative**：`no vocals, no percussion, no drum machine, no EDM, no sudden loudness, no strings swell into climax`
- **中文提示词**：`纯器乐中国风夜曲，低音箫长音，古琴稀疏泛音，笙持续铺底，极轻炭火声，60 BPM，五声羽调式，温暖的安静，深夜厨房的一盏灯，放置游戏夜间背景音乐，无打击乐，无人声，无缝循环`

### 4. 灶火慢烹 · 制作 / 厨房
- **播放位置**：烹饪 / 烘焙 / 腌制 / 酿造 / 调料 / 锻造等制作页（`skill` 视图的制作类技能）
- **情绪**：专注、轻快但不吵、有"手上的活儿"的律动
- **规格**：92 BPM · 徵调式（G pentatonic）· 扬琴 + 木琴 + 中阮 + 轻手鼓（**只打 1、3 拍**）+ 锅勺/切菜的环境音点缀
- **结构**：扬琴 8 分音符走句为主，木琴在句尾接 2 音；每 16 小节去掉一次手鼓（呼吸感）
- **Prompt（EN）**：
  `instrumental Chinese kitchen folk, yangqin hammered dulcimer ostinato, light marimba accents, mid-range ruan, soft hand drum on beats 1 and 3 only, subtle kitchen ambience (wooden spoon, gentle chopping), 92 BPM, pentatonic, focused and cheerful but restrained, cozy cooking-game background music, no vocals, seamless loop`
- **Negative**：`no vocals, no heavy drums, no drum fill, no EDM, no brass, no sudden dynamics, no rock guitar`
- **中文提示词**：`纯器乐中国厨房风情，扬琴走句，木琴点缀，中阮中声部，轻手鼓只打 1、3 拍，锅勺与轻切菜的厨房环境音，92 BPM，五声音阶，专注而不吵的做菜氛围，烹饪游戏背景音乐，无人声，无缝循环`

### 5. 堂前烟火 · 餐厅经营
- **播放位置**：餐厅 / 班底 / 分店 / 常客 / 套餐定食 / 外卖 / 供应商 / 宴会
- **情绪**：宾主尽欢的松弛感、暖调、像小馆子里放着的小乐队
- **规格**：78 BPM · 商调式混一点爵士和声 · 琵琶 + 钢琴 + 贝斯 + brushes 鼓刷 + 单簧管点缀
- **结构**：钢琴与琵琶轮流主奏，鼓刷只做"沙沙"的底噪；音量起伏极小
- **Prompt（EN）**：
  `instrumental Chinese jazz lounge, pipa and soft piano trading melody, upright bass walking slowly, brushed drums, clarinet accents, 78 BPM, warm pentatonic with light jazz harmony, relaxed dinner ambience, restaurant management idle game background music, mellow and unobtrusive, no vocals, seamless loop`
- **Negative**：`no vocals, no scat, no trumpet solo, no big band, no loud swing, no EDM, no drop`
- **中文提示词**：`纯器乐中式轻爵士，琵琶与柔和钢琴交替主奏，低音贝斯慢走，鼓刷轻扫，单簧管点缀，78 BPM，五声音阶加轻爵士和声，温暖的用餐氛围，餐厅经营游戏背景音乐，无人声，无缝循环`

### 6. 厨艺切磋 · 普通对决
- **播放位置**：对决（普通区域对手）、竞技场、试炼塔、厨具赛、名厨挑战
- **情绪**：有推进感但**不凶**——"料理擂台"而不是厮杀
- **规格**：110 BPM · 羽调式 · 二胡短句 + 琵琶轮指 + 中国大鼓（中低音量、每 2 拍）+ 编钟点音
- **结构**：8 小节循环，2 小节一个动机；鼓始终在中低音量、**不做渐强**；不要铜管、不要失真
- **Prompt（EN）**：
  `instrumental Chinese battle-lite, erhu short phrases, pipa tremolo, mid-volume Chinese daiko drum every 2 beats, bianzhong bell accents, 110 BPM, pentatonic minor, determined but not aggressive, cooking-duel game background music, steady groove without buildup, no vocals, seamless loop`
- **Negative**：`no vocals, no shouting, no heavy metal, no distorted guitar, no orchestral crescendo, no EDM drop, no brass fanfare`
- **中文提示词**：`纯器乐中式轻战斗，二胡短句，琵琶轮指，中国大鼓中低音量每 2 拍，编钟点音，110 BPM，五声羽调式，坚定但不凶狠，料理对决游戏背景音乐，平稳不渐强，无人声，无缝循环`

### 7. 山海盛宴 · 首领战
- **播放位置**：区域 BOSS、无尽挑战塔高层、食神秘境
- **情绪**：庄重、有压迫感但**克制**（"山海异兽登场"而非"爆炸"）
- **规格**：132 BPM（与现有 battle 同速）· 羽调式 · 编钟 + 大鼓 + 低音笙 + 二胡 + 箫的呼应对答
- **结构**：4 小节庄严引子（编钟）→ 主体鼓点稳住不加速；**禁止提速、禁止全奏爆点**，张力靠低音与和声而非音量
- **Prompt（EN）**：
  `instrumental Chinese ceremonial epic, bianzhong bells, deep Chinese daiko drum steady groove, low sheng drone, erhu and xiao call and response, 132 BPM, pentatonic minor, dignified tension without explosion, mythic mountain-and-sea boss theme for an idle cooking game, no vocals, seamless loop, controlled dynamics`
- **Negative**：`no vocals, no choir, no orchestral hit, no timpani roll crescendo, no brass fanfare, no EDM, no guitar`
- **中文提示词**：`纯器乐中式庄严史诗，编钟，低沉中国大鼓稳定律动，低音笙铺底，二胡与箫对答，132 BPM，五声羽调式，庄重有张力但不爆，山海异兽登场，放置料理游戏首领战背景音乐，无人声，无缝循环，动态克制`

### 8. 食经修行 · 山海食经 / 厨神之路
- **播放位置**：山海食经、厨神之路、传承、信仰、转生相关页
- **情绪**：空、静、冥想；像在洞里打坐听到的水滴与气息
- **规格**：50 BPM · 无明确节拍（自由速度）· 颂钵 + 木鱼（极疏，10~15 秒一次）+ 低音笛 + 长混响 pad
- **结构**：无旋律发展，只有音色与空间的缓慢变化；**全曲音量几乎恒定**
- **Prompt（EN）**：
  `instrumental meditative Chinese ambient, singing bowl, very sparse wooden fish, low dizi breath tones, long reverb pads, 50 BPM implied with no clear beat, spacious and timeless, cultivation and meditation mood, spirit-cultivation tech-tree screen music for a game, no vocals, seamless loop, extremely gentle`
- **Negative**：`no vocals, no chanting, no drums, no beat, no melody hook, no dynamics, no EDM`
- **中文提示词**：`纯器乐中式冥想环境音乐，颂钵，极稀疏木鱼，低音笛气息音，长混响铺底，约 50 BPM 无明显节拍，空旷悠远，修行打坐，游戏中的食经/天赋树界面音乐，无人声无吟唱，无缝循环，极度轻柔`

### 9. 夜市灯火 · 夜市 / 节庆 / 赛季
- **播放位置**：夜市狂潮窗口、节庆、赛季页、节庆限定活动、小游戏大厅
- **情绪**：热闹、喜庆，但**是"远处看的灯会"**——人声喧腾被推到很远，音乐本体依然轻
- **规格**：88 BPM · 徵调式 · 笛子主奏 + 扬琴 + 小锣（每 4 小节一下）+ 远处人声嗡鸣（**非歌词，只当环境层**）+ 灯笼/风铃
- **结构**：句尾加小锣过门；情绪保持在同一档（**不许有"副歌拉起来"**）
- **Prompt（EN）**：
  `instrumental Chinese festive folk, bright dizi lead, yangqin accompaniment, small gong every 4 bars, distant crowd murmur as ambience layer (not lyrics), lantern festival at night, 88 BPM, pentatonic major, cheerful yet gentle, festival event background music for a game, consistent energy with no chorus lift, no vocals, seamless loop`
- **Negative**：`no vocals, no lyrics, no shouting, no lion dance drum barrage, no firecrackers, no EDM, no sudden dynamic lift`
- **中文提示词**：`纯器乐中国节庆风，明亮笛子主奏，扬琴伴奏，小锣每 4 小节，远处人群喧闹只作环境层（不含歌词），夜晚灯会，88 BPM，五声宫调式，喜庆而轻柔，游戏节庆活动背景音乐，情绪平稳不上扬，无人声，无缝循环`

### 10. 旧谱余香 · 图鉴 / 故事 / 转生回顾
- **播放位置**：图鉴（LogView）、故事与轶事、年鉴、里程碑、赛季回顾、荣誉殿堂、系统日志
- **情绪**：回忆、淡淡的怅然、翻旧菜谱的触感
- **规格**：54 BPM · 羽调式 · 古琴独奏为主 + 箫长音 + 极轻的翻书声（可省）
- **结构**：古琴散音与按音交替，句与句之间**留 2~3 秒空白**；不要伴奏乐器进来
- **Prompt（EN）**：
  `instrumental solo guqin, sparse open-string and stopped notes with long silences, faint xiao drone in the background, 54 BPM, pentatonic minor, nostalgic and bittersweet, like leafing through an old recipe book, archive and story screen music for a game, no vocals, seamless loop, very low dynamics`
- **Negative**：`no vocals, no percussion, no ensemble, no piano, no strings swell, no EDM, no rhythm section`
- **中文提示词**：`纯器乐古琴独奏，稀疏的散音与按音、句间长留白，背景极轻的箫长音，54 BPM，五声羽调式，怀旧而微怅，像翻一本旧菜谱，游戏图鉴/故事界面音乐，无人声，无缝循环，动态极小`

---

## 三、给 AI 工具用的小技巧

1. **Suno**：歌词框留空或写 `[Instrumental]`；Style 框粘贴上面的 EN 提示词（**控制在 200 字符内**，超了它只取前段）；生成后优先选 `Cover`/`Extend` 里最平的那一版。
2. **Udio**：可把负向提示词填进 `Negative` 字段（Suno 没有该字段，就写在 style 末尾：`no vocals, no drums` 也能起作用）。
3. **一次多生成几版**：AI 很容易偷偷加鼓点与人声副歌 → **每首建议生成 4~6 版，挑「从头到尾一条线」的那版**；出现渐强的一律弃用（挂机场景会听很久）。
4. **无缝循环验收**：把成品丢进音频软件，把末尾 2 秒与开头 2 秒交叉对齐试听；或用 `ffplay` 循环播放 3 遍听接缝。若接缝明显，让 AI 重生成（别自己剪，容易剪出爆音）。
5. **统一音量**：10 首之间均衡到同一响度（−20 ~ −18 LUFS），否则切场景会忽大忽小——Audacity「效果 → 响度归一化 (LUFS)」或 `ffmpeg -af loudnorm` 都能做。
6. **版权**：AI 生成曲目用于个人/小范围项目一般没问题，但**发布到商店前请确认所用平台当时的商用条款**（Suno/Udio 的免费档与付费档条款不同）。

---

## 四、放进游戏里要改什么（等你做好后一起接）

现在 `src/game/core/sound.js` 里 BGM 是**代码合成的音序器**（3 首，`bgm.play('day'|'night'|'battle')`），
`App.vue` 的 `syncBgm()` 是**唯一调用点**（`getCombat()?.inFight ? 'battle' : 深色 ? 'night' : 'day'`）。

换成真实音频的改动面很小、**不碰存档与玩法**：
1. `sound.js`：新增 `HTMLAudioElement` 池 + `fadeIn/fadeOut`（交叉淡入淡出 ~1.2s）+ `loop = true`；
2. 曲目 id 从 3 个扩到 10 个（保留 `day`/`night`/`battle` 三个 id 以兼容现有调用），新增按视图映射（如 `kitchen`/`diner`/`meditate`/`memory`/`market`/`boss`/`title`）；
3. `syncBgm()` 增加「按 `ui.activeView` + 是否在战斗 + 主题」的映射表（一处集中判定，别散在组件里）；
4. 保留 `bgmEnabled` / `bgmVolume` 两个设置项与设置面板绑定（**对外行为不变**）；
5. 加一条守卫：`public/audio/bgm/` 下文件缺失时静默回落到合成版（避免打包漏文件导致完全没声音）。
