<script setup>
// ─────────────────────────────────────────────────────────────────────────────
// 餐厅实景（2026-09-23，第二版：**画面里不再放 UI**）
// 🔴 只读不写：收入 / 菜单 / 食客订单 / 评论家 全部来自 store，不新增存档字段、不改平衡。
//
// 重做原因（用户：「你画的图丑的要死」）：上一版把**界面元素**画进了美术里 ——
//   6 张白色气泡卡、横贯整墙的菜单板、一排 emoji 挂饰、左下角一块吧台色块、6 条一样的小桌板。
//   四种媒介（CSS 形状 + emoji + 白卡 + 像素画）叠在一张像素内景上，越加越乱。这一版的分工：
//     · **画面**：内景底图 + 人物立绘 + 人物头顶「要哪道菜」的小图标 + 一道耐心细条（不描边、不白底）
//     · **面板**（画外的 RestaurantView）：名字、赏金、剩余分钟、上菜按钮、菜单、装潢
// 🔴 **人物尺寸一律走「房间高的百分比」，不写死 px**（2026-09-23 用户第四次说「人物太小」后改）。
//   旧版写死 260px 有两个后果：1440 下只占台上 58%；1024 下反而**超出** 294px 高的台子、头顶被裁 17px。
//   现在 `.rs-person` 撑满房间高、立绘取它的 80% ⇒ 任何宽度下同比例、且不可能被裁
//   （实测 1440：立绘 322px = 台高 72%，人物实画 119×322）。
//   立绘是 512 方图、人物只占中间 ≈37% 宽（实测 20 张食客 + 老板：0.22~0.54）⇒ 用 -7% 负边距让人挨近而不挤。
// ⏱ 不挂 `ui.loopTick`；倒计时读父组件传的 `nowMs`，动效全是 CSS。
// ─────────────────────────────────────────────────────────────────────────────
import { computed, onUnmounted, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { getItem } from '../game/data/items.js'
import { itemImage, assetUrl } from '../game/data/itemImage.js'
import { chefImage, chefEmoji } from '../game/data/chefImage.js'
import { catLabel, ORDER_TTL_MS } from '../game/data/restaurantOrders.js'
import { guestPortrait, criticPortrait } from '../game/data/restaurantFaces.js'

const props = defineProps({
  nowMs: { type: Number, default: 0 },
  flowText: { type: String, default: '' },     // 「下一波食客约 N 分钟」——由页面算好传进来（口径只有一份）
  regularText: { type: String, default: '' },  // 「常客 12/12 · 已全结识」
})
const emit = defineEmits(['focus-critic'])
const player = usePlayerStore()
const ui = useUiStore()

// ── 人物：食客按名字稳定取一张像素立绘（同一名字永远同一张脸）；图挂了才回落 emoji ──
const FACES = ['🧑', '👩', '👨', '👵', '👴', '🧓', '🧕', '👳']
function faceOf(name) {
  let h = 0
  for (const ch of String(name ?? '')) h = (h * 31 + ch.codePointAt(0)) % 9973
  return FACES[h % FACES.length]
}
const picOk = ref({})
/** 取脸：**用订单 id 当种子**（不是名字）。
 *  名字池只有 12 个而立绘有 20 张 —— 按名字取的话有 8 张永远轮不到，而且同名两位客人会撞成同一张脸。
 *  按订单 id 取（每次到访唯一）⇒ 同屏不撞脸、20 张都会用到；同一单在屏幕上期间脸是稳定的。 */
/** 取脸：种子用**订单 id**（保证同屏不撞脸），同时把**名字**也传进去（命中「名字→立绘」指定表时以名字为准） */
function picOf(key, name) { return picOk.value[key] === false ? null : guestPortrait(name ?? key) }
/** 雅座（评论家）的脸：只从「像评委」的那批里取 */
function vipPic(name) { return picOk.value[name] === false ? null : criticPortrait(name) }
function markPicBad(key) { picOk.value = { ...picOk.value, [key]: false } }

// ── 桌位 = 菜单位；客人 = 真实订单（坐不下的进等位区）──
const orders = computed(() => player.orders?.list ?? [])
const seatedOrders = computed(() => orders.value.slice(0, player.restaurantSlots ?? 0))
const waitingOrders = computed(() => orders.value.slice(player.restaurantSlots ?? 0))
const critic = computed(() => player.criticState?.().order ?? null)
/** 台上有几个人（老板 + 在座 + 雅座评论家 + 门口等位）—— 立绘尺寸 `--u` 的唯一输入：
 *  人越多、每人分到的宽度越小，立绘就要越矮，否则一排人会被舞台两侧裁掉。 */
const headcount = computed(() => 1 + seatedOrders.value.length + (critic.value ? 1 : 0) + waitingOrders.value.length)

/** 内景底图（用户出图，2026-09-23）：1152×448，墙:地 = 64:36 —— 舞台按同比例锁死，地平线才不会跑 */
const roomPic = computed(() => assetUrl('images/restaurant/room.png'))
const chefPic = computed(() => chefImage(player.settings?.chefAvatar))
const chefPicOk = ref(true)
const chefFallback = computed(() => chefEmoji(player.settings?.chefAvatar))

// ── 上菜（与面板里的「上菜」按钮同一个出口 `player.finishOrder`）──
const flashId = ref('')
const floats = ref({})
const timers = new Set()
function later(fn, ms) {
  const t = setTimeout(() => { timers.delete(t); fn() }, ms)
  timers.add(t)
}
onUnmounted(() => { for (const t of timers) clearTimeout(t) })

function haveEnough(o) { return (player.inventory?.[o.itemId] ?? 0) >= o.qty }
function patiencePct(o) {
  const left = (o.expireAt ?? 0) - (props.nowMs || Date.now())
  return Math.max(0, Math.min(1, left / ORDER_TTL_MS))
}
function remainMin(o) {
  return Math.max(0, Math.ceil(((o.expireAt ?? 0) - (props.nowMs || Date.now())) / 60000))
}
function serveOrder(o) {
  if (!o) return
  if (!haveEnough(o)) {
    ui.pushLog(`料理不足：需要 ${getItem(o.itemId)?.name ?? '这道菜'}×${o.qty}`, 'warn')
    return
  }
  const r = player.finishOrder(o.id)
  if (!r?.ok) { ui.pushLog(r?.msg ?? '交付失败', 'warn'); return }
  ui.pushLog(`🍽 食客「${r.name}」满意而归：+${r.reward} 金币`, 'gain')
  flashId.value = o.id
  later(() => { if (flashId.value === o.id) flashId.value = '' }, 520)
  floats.value = { ...floats.value, [o.id]: `+${r.reward} 金` }
  later(() => { const n = { ...floats.value }; delete n[o.id]; floats.value = n }, 1200)
}
</script>

<template>
  <div class="rs-stage" :style="{ backgroundImage: `url('${roomPic}')`, '--n': headcount }">
    <!-- 夜色：深色模式把画压暗（压面不压光 —— 窗与吊灯的暖光仍透出来） -->
    <span class="rs-night" aria-hidden="true" />

    <!-- 左上角：客流（2026-09-23 用户要求放回画面里）。压在画上的文字**必须自带不透明底**，
         否则浅色主题下深色字压在暖色画上读不清（也是 e2e-dark 的对比度判定口径）。 -->
    <div class="rs-flow">
      <span class="rs-flow-line">🚪 {{ flowText }}</span>
      <span class="rs-flow-line rs-flow-dim">{{ regularText }}</span>
    </div>

    <!-- ══ 店里的人 ══
         画面里**只有**人物 + 头顶「要哪道菜」的小图标 + 一道耐心细条；
         名字 / 赏金 / 剩余分钟 / 按钮全在画外的面板里（别把界面画进美术）。 -->
    <div class="rs-room">
      <!-- 老板站在最左（玩家的厨师形象） -->
      <div class="rs-person rs-owner">
        <img v-if="chefPic && chefPicOk" class="rs-pic" :src="chefPic" alt="" @error="chefPicOk = false" loading="lazy" decoding="async" />
        <span v-else class="rs-emoji">{{ chefFallback }}</span>
        <span class="rs-ground" aria-hidden="true" />
      </div>

      <!-- 在座的食客 -->
      <div
        v-for="o in seatedOrders"
        :key="o.id"
        class="rs-person rs-guest"
        :class="{ 'is-flash': flashId === o.id, 'is-broke': !haveEnough(o) }"
        :title="`${o.name} 想要 ${getItem(o.itemId)?.name}×${o.qty}｜赏金 ${o.reward} 金｜还剩 ${remainMin(o)} 分钟`"
        @click="serveOrder(o)"
      >
        <span class="rs-order">
          <img v-if="itemImage(o.itemId)" :src="itemImage(o.itemId)" alt="" @error="$event.target.style.display = 'none'" loading="lazy" decoding="async" />
          <span class="rs-patience"><i :style="{ width: patiencePct(o) * 100 + '%' }" /></span>
        </span>
        <img v-if="picOf(o.id, o.name)" class="rs-pic" :src="picOf(o.id, o.name)" alt="" @error="markPicBad(o.id)" loading="lazy" decoding="async" />
        <span v-else class="rs-emoji">{{ faceOf(o.name) }}</span>
        <span class="rs-ground" aria-hidden="true" />
        <span v-if="floats[o.id]" class="rs-float">{{ floats[o.id] }}</span>
      </div>

      <!-- 靠窗雅座：评论家到访时坐这里（点它 → 滚到下方提交） -->
      <div
        v-if="critic"
        class="rs-person rs-guest rs-vip"
        :title="`${critic.name}：要「${catLabel(critic.category)}」${critic.minTier} 档以上`"
        @click="emit('focus-critic')"
      >
        <span class="rs-order rs-order-vip" aria-hidden="true">📷</span>
        <img v-if="vipPic(critic.name)" class="rs-pic" :src="vipPic(critic.name)" alt="" @error="markPicBad(critic.name)" loading="lazy" decoding="async" />
        <span v-else class="rs-emoji">{{ critic.name.startsWith('甜点') ? '👑' : '🎩' }}</span>
        <span class="rs-ground" aria-hidden="true" />
      </div>

      <!-- 门口等位：订单多于桌位时站在这儿 -->
      <div
        v-for="o in waitingOrders"
        :key="'w' + o.id"
        class="rs-person rs-guest rs-wait"
        :class="{ 'is-flash': flashId === o.id, 'is-broke': !haveEnough(o) }"
        :title="`${o.name}（等位）想要 ${getItem(o.itemId)?.name}×${o.qty}｜赏金 ${o.reward} 金｜还剩 ${remainMin(o)} 分钟`"
        @click="serveOrder(o)"
      >
        <span class="rs-order">
          <img v-if="itemImage(o.itemId)" :src="itemImage(o.itemId)" alt="" @error="$event.target.style.display = 'none'" loading="lazy" decoding="async" />
          <span class="rs-patience"><i :style="{ width: patiencePct(o) * 100 + '%' }" /></span>
        </span>
        <img v-if="picOf(o.id, o.name)" class="rs-pic" :src="picOf(o.id, o.name)" alt="" @error="markPicBad(o.id)" loading="lazy" decoding="async" />
        <span v-else class="rs-emoji">{{ faceOf(o.name) }}</span>
        <span class="rs-ground" aria-hidden="true" />
        <span v-if="floats[o.id]" class="rs-float">{{ floats[o.id] }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ══ 舞台：内景底图 + `aspect-ratio` 锁死同比例（否则底图地平线会随盒高漂移，人就「站进墙里」）══ */
.rs-stage {
  position: relative;
  aspect-ratio: 1152 / 448;
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  background-color: rgba(var(--panel-rgb), 0.9);
  background-size: 100% 100%;
  background-position: center top;
  background-repeat: no-repeat;
  box-shadow: 0 8px 22px rgba(var(--tint-rgb), 0.12);
  margin-bottom: 14px;
  /* 人物尺寸 `--u` 用 cqh/cqw（容器查询单位）算 ⇒ 舞台自己就是查询容器。
     舞台在宽高两轴都确定（宽来自布局、高来自 aspect-ratio 或窄屏的 `height`）⇒ `container-type: size` 合法。 */
  container-type: size;
  /* 🔴 滚动时「画面抖」的修法：把整块场景提升成独立合成层。
     舞台高度是 446.44（aspect-ratio 算出来的小数），立绘又落在分数坐标上 ——
     滚动时浏览器会按新的亚像素偏移**重新光栅化**这些 512px 图，肉眼看就是像素在抖。
     提升成一层后只做图层平移，不再重算。实测（Playwright 1440）：提升前滚动 198px 时
     人物相对舞台稳定，但整块图会重采样；提升后逐帧一致。 */
  transform: translateZ(0);
  will-change: transform;
  /* ── 人物尺寸的唯一来源（2026-09-23 用户第四次说「人物太小」后重做）────────────────
     取「竖向预算」与「横向预算」的较小值：
       · 竖向 `calc(78cqh - 32px)` = 舞台高的 78% 再让出边距（舞台高由底图比例锁死）
       · 横向 `calc(176cqw / var(--n))` = 一行 N 个人每人分到的宽 ×2
     ×2 是因为下面 `.rs-person` 用 `-0.25u` 负边距让相邻两人重叠半个盒宽，
     而方图里只有中间 ≈37% 是人物 ⇒ 重叠后人物之间正好留 ≈0.13u 的空隙。
     176 而不是 200：还要扣掉左右 padding、人之间的 gap、以及老板那点额外间距
     （实测 190 时 640px 视口下最右一人的袖子被切掉 10px）。
     两个都用容器单位 ⇒ 与舞台同比例（实测）：1440 下 315px（台上 71%）、1280 → 266、1024 → 196、900 → 231、640 → 218，
     五个宽度下**都不被裁**（人物实画包围盒完全落在台内）。
     ——**旧版写死 260px：1440 下只占 58%，1024 下反而超出 294px 高的台子、头顶被裁 17px**。
     头顶菜图 / 耐心条 / 接地影全部按 `--u` 的倍数算 ⇒ 一起缩放（旧版写死 px，
     盒宽被压窄时菜图会浮在半空中）。 */
  --u: min(calc(78cqh - 32px), calc(176cqw / var(--n, 1)));
}
.rs-night {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  background-image: linear-gradient(180deg, rgba(18, 10, 5, 0.66), rgba(10, 6, 3, 0.74));
  transition: opacity 0.2s;
}
.rs-flow {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: clamp(4px, 1.4cqh, 6px) clamp(7px, 2.5cqh, 11px);
  border-radius: 8px;
  background-color: #2f1c10;                              /* 不透明：给守卫一个可计算的底 */
  background-image: linear-gradient(180deg, rgba(90, 55, 31, 0.94), rgba(47, 28, 16, 0.96));
  border: 1px solid rgba(255, 222, 165, 0.22);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.35);
}
/* 客流牌的尺寸跟着舞台缩：小舞台上它若保持原大，就会压到老板的头（实测 1024 下重叠 6px） */
.rs-flow-line { font-size: clamp(10px, 2.6cqh, 12px); font-weight: 700; color: #f4e6cb; white-space: nowrap; }
.rs-flow-dim { font-weight: 400; color: #d3bc93; }
/* 店里的人：沿地板站一排（`align-items: flex-end` ⇒ 脚都踩在同一条地线上，不会各飘各的）
   整摞高度 = 1.22u（菜图 + 立绘 + 接地影），`justify-content: flex-end` 让它贴着地线，
   多出来的空间留在头顶 —— 否则最上面那枚菜图会被舞台顶边裁掉。 */
.rs-room {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 4px;
  padding: 0 20px 9cqh;   /* 底边留 9%（= 446 台子上的 40px）：让脚踩在地板带上，而不是贴底边 */
}
.rs-person {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  height: calc(var(--u) * 1.22);
  justify-content: flex-end;
  /* 立绘是方图、人物只占中间 ≈37% 宽 ⇒ 负边距让相邻两人重叠，人挨得近才像一屋子人 */
  margin: 0 calc(var(--u) * -0.25);
}
.rs-owner { margin-right: calc(var(--u) * 0.08); }   /* 老板与第一位食客之间再让出一点空 */
.rs-guest { cursor: pointer; }
.rs-guest:hover .rs-pic, .rs-guest:hover .rs-emoji { transform: translateY(-3px); }
.rs-pic {
  width: var(--u);
  height: var(--u);
  object-fit: contain;
  object-position: center bottom;   /* 万一立绘不是正方的，也保证脚踩地线 */
  transition: transform 0.15s, filter 0.15s;
  /* ⚠️ 不要加 drop-shadow：立绘本身抠得很干净（白底/灰底实测无脏边），
     投影会在浅色房间里给人围一圈暗边，看着就像「没抠干净」。接地感交给下面的 .rs-ground。 */
}
.rs-emoji { font-size: calc(var(--u) * 0.3); line-height: 1.1; transition: transform 0.15s; }
/* 接地阴影：脚下一个小椭圆（人不再「飘」） */
.rs-ground {
  width: calc(var(--u) * 0.42);
  height: calc(var(--u) * 0.062);
  margin-top: calc(var(--u) * -0.05);
  border-radius: 50%;
  background-image: radial-gradient(ellipse at 50% 50%, rgba(0, 0, 0, 0.42), transparent 72%);
}
/* 头顶「要哪道菜」：菜图 + 一道耐心细条。**不描边、不白底**，压一层投影就够看清 */
.rs-order { display: flex; flex-direction: column; align-items: center; gap: 3px; margin-bottom: 2px; width: var(--u); }
.rs-order img { width: calc(var(--u) * 0.165); height: auto; object-fit: contain; filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.5)); }
.rs-order-vip { font-size: calc(var(--u) * 0.12); line-height: 1.1; filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.5)); }
.rs-patience {
  width: calc(var(--u) * 0.24);
  height: calc(var(--u) * 0.022);
  border-radius: 999px;
  overflow: hidden;
  background: rgba(20, 12, 6, 0.55);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}
.rs-patience i { display: block; height: 100%; background: linear-gradient(90deg, #8fd07a, #e8c34a 60%, #e0765a); }
/* 料理不够：菜图压暗一档（不再写一行「料理不足」的字） */
.rs-guest.is-broke .rs-order img { filter: grayscale(0.7) brightness(0.8) drop-shadow(0 2px 3px rgba(0, 0, 0, 0.5)); }
/* 交付成功：整个人亮一下（只提亮，不加光晕 —— 光晕同样会造成「脏边」的观感） */
.rs-guest.is-flash .rs-pic { filter: brightness(1.28) saturate(1.1); }
/* 门口等位：比在座的矮一档、站在最右（门口方向） */
.rs-wait { margin-left: calc(var(--u) * 0.05); opacity: 0.92; }
.rs-wait .rs-pic { width: calc(var(--u) * 0.9); height: calc(var(--u) * 0.9); }
.rs-float {
  position: absolute;
  top: 6px;
  left: 50%;
  font-size: calc(var(--u) * 0.055);
  font-weight: 800;
  color: #ffe6a8;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
  pointer-events: none;
  animation: rsFloat 1.2s ease-out forwards;
}
@keyframes rsFloat {
  from { transform: translate(-50%, 6px) scale(0.8); opacity: 1; }
  to { transform: translate(-50%, -34px) scale(1.12); opacity: 0; }
}
/* 窄屏：舞台定高（比例仍交给 `--u`，不再手改立绘尺寸）。
   ⚠️ 必须是 `height` 而不是 `min-height`：`container-type: size` 带 size containment，
   `height: auto` 时容器给查询用的高度是 0 ⇒ `cqh` 全变 0、人物直接缩成 0px（实测 900/640 下 0×0）。 */
@media (max-width: 900px) {
  .rs-stage { aspect-ratio: auto; height: 430px; background-size: cover; }
}
@media (max-width: 640px) {
  /* 一行排得下（`--u` 已按人数算过）⇒ 这里**不要** flex-wrap：换行后每行的人各自撑满高，
     第二行会被推出舞台外（实测过：接地影跑到台外 1207px）。 */
  .rs-room { gap: 2px; padding: 0 12px 34px; }
}
@media (prefers-reduced-motion: reduce) {
  .rs-float { animation: none; }
}
</style>

<!-- 主题相关的规则另起一个**非 scoped** 块（本项目既有做法）：
     scoped 块里的 `:global(html[data-theme='dark']) .rs-night` 会被编译成 `html[data-theme='dark'] {}`
     —— 后面的 .rs-night 被吃掉、规则静默失效（实测踩过）。 -->
<style>
html[data-theme='dark'] .rs-night { opacity: 1; }
</style>
