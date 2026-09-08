<script setup>
// 游戏商店（2026-09-07 v2）：九件商品全部真实生效——扣游戏币 → 发放/应用效果；一次性商品（称号/头像框/头像）防重复购买
import { ref, computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'

import { RARE_POOL, SEED_POOL, FOOD_POOL, SPICE_POOL, MINERAL_POOL, INGREDIENT_POOL } from '../game/data/gameShopPools.js'

const player = usePlayerStore()
const ui = useUiStore()
const coins = computed(() => player.gameCoins ?? 0)

/** 商店发货：优先入背包；背包满则直发仓库（仓库种类满才拒收），保证商品一定生效 */
function grantShopItem(id, qty) {
  if (player.gainItem(id, qty)) return true
  if (!(id in player.bank) && player.bankSlotsUsed >= player.bankCap) return false
  player.bank[id] = (player.bank[id] ?? 0) + qty
  return true
}
function rareBoxApply(min, max) {
  const n = min + Math.floor(Math.random() * (max - min + 1))
  const counts = {}
  for (let i = 0; i < n; i++) {
    const id = RARE_POOL[Math.floor(Math.random() * RARE_POOL.length)]
    counts[id] = (counts[id] ?? 0) + 1
  }
  let got = 0
  for (const [id, q] of Object.entries(counts)) if (grantShopItem(id, q)) got += q
  return got ? `稀有食材 ${got} 份（${Object.keys(counts).length} 种）` : '背包与仓库均满，未入库'
}
/** 通用礼包：先随机 3~8 种再分数量（种类集中不爆背包），背包满直发仓库 */
function poolBagApply(pool, count) {
  const kindN = 3 + Math.floor(Math.random() * 6)
  const kinds = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(kindN, pool.length))
  const counts = {}
  for (let i = 0; i < count; i++) {
    const id = kinds[Math.floor(Math.random() * kinds.length)]
    counts[id] = (counts[id] ?? 0) + 1
  }
  let got = 0
  for (const [id, q] of Object.entries(counts)) if (grantShopItem(id, q)) got += q
  return got ? `入库 ${got} 份（${Object.keys(counts).length} 种）` : '背包与仓库均满，未入库'
}
function seedBagApply(count) {
  return poolBagApply(SEED_POOL, count)
}
function ticketApply(qty) {
  player.mijian = player.mijian ?? { stats: { pulls: 0, spent: 0, gearRare: 0 }, pity: {}, history: [] }
  player.mijian.tickets = (player.mijian.tickets ?? 0) + qty
  return `抽卡券 +${qty}（觅珍页面显示 🎟️）`
}

const PRODUCTS = {
  gold: {
    cat: '💰 经济互通',
    icon: '💰', name: '金币兑换包', price: 100, repeat: true,
    desc: '100 游戏币 → 金币 ×1000（主货币互通）',
    apply() { player.gainGold(1000); return '金币 +1000' },
  },
  goldDeluxe: {
    cat: '💰 经济互通',
    icon: '💰', name: '豪华金币兑换包', price: 880, repeat: true,
    desc: '900 游戏币 → 金币 ×10000',
    apply() { player.gainGold(10000); return '金币 +10000' },
  },
  goldPremium: {
    cat: '💰 经济互通',
    icon: '💰', name: '至臻金币兑换包', price: 8500, repeat: true,
    desc: '9000 游戏币 → 金币 ×100000',
    apply() { player.gainGold(100000); return '金币 +100000' },
  },
  rareBox: {
    cat: '💰 经济互通',
    icon: '🎁', name: '稀有食材盲盒', price: 120, repeat: true,
    desc: '随机稀有食材 1~3 份（灵果/龙根/松露/灵芝池）',
    apply() { return rareBoxApply(1, 3) },
  },
  rareBoxDeluxe: {
    cat: '💰 经济互通',
    icon: '🎁', name: '豪华稀有食材盲盒', price: 1000, repeat: true,
    desc: '随机稀有食材 10~30 份（灵果/龙根/松露/灵芝池）',
    apply() { return rareBoxApply(10, 30) },
  },
  rareBoxPremium: {
    cat: '💰 经济互通',
    icon: '🎁', name: '至臻稀有食材盲盒', price: 9000, repeat: true,
    desc: '随机稀有食材 100~300 份（灵果/龙根/松露/灵芝池）',
    apply() { return rareBoxApply(100, 300) },
  },
  ingredientBag: {
    cat: '💰 经济互通',
    icon: '🐟', name: '鲜味食材礼包', price: 500, repeat: true,
    desc: '随机普通食材 30~80 份（蔬菜/鲜肉/水产等，不含稀有）',
    apply() { return poolBagApply(INGREDIENT_POOL, 30 + Math.floor(Math.random() * 51)) },
  },
  foodBag: {
    cat: '💰 经济互通',
    icon: '🥩', name: '珍馐料理礼包', price: 1500, repeat: true,
    desc: '随机成品料理 10~20 份（备菜快进，可回血/对决用）',
    apply() { return poolBagApply(FOOD_POOL, 10 + Math.floor(Math.random() * 11)) },
  },
  spiceBag: {
    cat: '💰 经济互通',
    icon: '🌶️', name: '精酿调料礼包', price: 400, repeat: true,
    desc: '随机调料 20~50 份（香料/酱料池）',
    apply() { return poolBagApply(SPICE_POOL, 20 + Math.floor(Math.random() * 31)) },
  },
  mineralBag: {
    cat: '💰 经济互通',
    icon: '⛏️', name: '锻造矿材礼包', price: 800, repeat: true,
    desc: '随机矿石/宝石 20~50 份（锻造原料池）',
    apply() { return poolBagApply(MINERAL_POOL, 20 + Math.floor(Math.random() * 31)) },
  },
  xpPotion: {
    cat: '⚡ 增益加速',
    icon: '🔥', name: '双倍挂机药剂', price: 80, repeat: true,
    desc: '采集/制作经验 ×2 · 持续 30 分钟（覆盖式刷新）',
    apply() { player.buffs.xpMult = { mult: 2, expiresAt: Date.now() + 30 * 60_000 }; return '经验 ×2（30 分钟）' },
  },
  seedBag: {
    cat: '⚡ 增益加速',
    icon: '🌱', name: '神秘种子袋', price: 60, repeat: true,
    desc: '随机 3 颗可种作物种子（含稀有，开出即赚）',
    apply() { return seedBagApply(3) },
  },
  seedBagDeluxe: {
    cat: '⚡ 增益加速',
    icon: '🌱', name: '豪华神秘种子袋', price: 500, repeat: true,
    desc: '随机 30 颗可种作物种子（含稀有，开出即赚）',
    apply() { return seedBagApply(30) },
  },
  seedBagPremium: {
    cat: '⚡ 增益加速',
    icon: '🌱', name: '至臻神秘种子袋', price: 4500, repeat: true,
    desc: '随机 300 颗可种作物种子（含稀有，开出即赚）',
    apply() { return seedBagApply(300) },
  },
  gachaTicket: {
    cat: '🧰 便捷用品',
    icon: '🎴', name: '觅珍抽卡券', price: 200, repeat: true,
    desc: '觅珍抽卡券 ×1（抽卡时优先抵扣，剩余金币补齐）',
    apply() { return ticketApply(1) },
  },
  gachaTicket10: {
    cat: '🧰 便捷用品',
    icon: '🎴', name: '觅珍抽卡券·十连', price: 1800, repeat: true,
    desc: '觅珍抽卡券 ×10（九折，抽卡优先抵扣）',
    apply() { return ticketApply(10) },
  },
  gachaTicket100: {
    cat: '🧰 便捷用品',
    icon: '🎴', name: '觅珍抽卡券·百连', price: 17000, repeat: true,
    desc: '觅珍抽卡券 ×100（九折，抽卡优先抵扣）',
    apply() { return ticketApply(100) },
  },
  craftBoost: {
    cat: '🧰 便捷用品',
    icon: '⏩', name: '制作加速器', price: 60, repeat: true,
    desc: '全部制作队列立即快进 10 分钟产量（材料不足自动暂停不浪费）',
    apply() { const n = player.boostCraftQueues(10); return `队列快进 10 分钟（完成 ${n} 份产物）` },
  },
  title: {
    cat: '👑 外观纪念',
    icon: '👑', name: '「大胃王」称号', price: 10000, repeat: false, slot: 'title', value: '大胃王',
    desc: '永久称号 · 购后可在已拥有外观间免费切换',
  },
  title2: {
    cat: '👑 外观纪念',
    icon: '👑', name: '「食神」称号', price: 12000, repeat: false, slot: 'title', value: '食神',
    desc: '永久称号 · 厨艺巅峰',
  },
  title3: {
    cat: '👑 外观纪念',
    icon: '🏅', name: '「千杯不醉」称号', price: 15000, repeat: false, slot: 'title', value: '千杯不醉',
    desc: '永久称号 · 酒仙风范',
  },
  title4: {
    cat: '👑 外观纪念',
    icon: '🔥', name: '「火候大师」称号', price: 11000, repeat: false, slot: 'title', value: '火候大师',
    desc: '永久称号 · 掌火如神',
  },
  title5: {
    cat: '👑 外观纪念',
    icon: '🔪', name: '「刀工宗师」称号', price: 13000, repeat: false, slot: 'title', value: '刀工宗师',
    desc: '永久称号 · 刀走龙蛇',
  },
  title6: {
    cat: '👑 外观纪念',
    icon: '👻', name: '「食灵之主」称号', price: 16000, repeat: false, slot: 'title', value: '食灵之主',
    desc: '永久称号 · 万灵归心',
  },
  title7: {
    cat: '👑 外观纪念',
    icon: '🍲', name: '「满汉全席」称号', price: 18000, repeat: false, slot: 'title', value: '满汉全席',
    desc: '永久称号 · 宴压天下',
  },
  frame: {
    cat: '👑 外观纪念',
    icon: '🖼️', name: '「神厨」金框', price: 12000, repeat: false, slot: 'avatarFrame', value: 'gold',
    desc: '永久金色头像框，头像描边发光',
  },
  frameJade: {
    cat: '👑 外观纪念',
    icon: '🖼️', name: '「翡翠」头像框', price: 10000, repeat: false, slot: 'avatarFrame', value: 'jade',
    desc: '永久翡翠绿头像框 · 翠玉质感光晕',
  },
  frameRoyal: {
    cat: '👑 外观纪念',
    icon: '🖼️', name: '「皇紫」头像框', price: 18000, repeat: false, slot: 'avatarFrame', value: 'royal',
    desc: '永久皇家紫头像框 · 尊贵光晕',
  },
  frameCopper: {
    cat: '👑 外观纪念',
    icon: '🖼️', name: '「赤铜」头像框', price: 8000, repeat: false, slot: 'avatarFrame', value: 'copper',
    desc: '永久赤铜头像框 · 暖铜光晕',
  },
  frameSilver: {
    cat: '👑 外观纪念',
    icon: '🖼️', name: '「白银」头像框', price: 10000, repeat: false, slot: 'avatarFrame', value: 'silver',
    desc: '永久白银头像框 · 冷银光晕',
  },
  frameLava: {
    cat: '👑 外观纪念',
    icon: '🖼️', name: '「熔岩」头像框', price: 14000, repeat: false, slot: 'avatarFrame', value: 'lava',
    desc: '永久熔岩头像框 · 炽热红光',
  },
  frameFrost: {
    cat: '👑 外观纪念',
    icon: '🖼️', name: '「霜蓝」头像框', price: 14000, repeat: false, slot: 'avatarFrame', value: 'frost',
    desc: '永久霜蓝头像框 · 冰晶蓝光',
  },
  frameRainbow: {
    cat: '👑 外观纪念',
    icon: '🖼️', name: '「彩虹」头像框', price: 20000, repeat: false, slot: 'avatarFrame', value: 'rainbow',
    desc: '永久彩虹头像框 · 三色光环',
  },
  frameStar: {
    cat: '👑 外观纪念',
    icon: '🖼️', name: '「星辉」头像框', price: 22000, repeat: false, slot: 'avatarFrame', value: 'star',
    desc: '永久星辉头像框 · 双层金色光晕',
  },
  frameDragon: {
    cat: '👑 外观纪念',
    icon: '🖼️', name: '「龙鳞」头像框', price: 26000, repeat: false, slot: 'avatarFrame', value: 'dragon',
    desc: '永久龙鳞头像框 · 金绿龙气',
  },
  avatar: {
    cat: '👑 外观纪念',
    icon: '🧸', name: '头像·食神盛宴', price: 6000, repeat: false, slot: 'avatar', value: 'images/items/food/食神盛宴.png',
    desc: '商店专属头像（食神盛宴图，购后免费切换）',
  },
  avatar2: {
    cat: '👑 外观纪念',
    icon: '🧸', name: '头像·满汉全席', price: 8000, repeat: false, slot: 'avatar', value: 'images/items/food/传说满汉全席.png',
    desc: '商店专属头像（传说满汉全席图）',
  },
  avatar3: {
    cat: '👑 外观纪念',
    icon: '🧸', name: '头像·龙息烤全龙', price: 9000, repeat: false, slot: 'avatar', value: 'images/items/food/龙息烤全龙.png',
    desc: '商店专属头像（龙息烤全龙图）',
  },
  avatar4: {
    cat: '👑 外观纪念',
    icon: '🧸', name: '头像·金龙鱼全宴', price: 7000, repeat: false, slot: 'avatar', value: 'images/items/food/金龙鱼全宴.png',
    desc: '商店专属头像（金龙鱼全宴图）',
  },
  nameGold: {
    cat: '👑 外观纪念',
    icon: '🥇', name: '名字·鎏金', price: 20000, repeat: false, slot: 'nameColor', value: 'gold',
    desc: '永久名字特效 · 鎏金',
  },
  nameSilver: {
    cat: '👑 外观纪念',
    icon: '🥈', name: '名字·银辉', price: 14000, repeat: false, slot: 'nameColor', value: 'silver',
    desc: '永久名字特效 · 银辉',
  },
  nameBamboo: {
    cat: '👑 外观纪念',
    icon: '🎋', name: '名字·青竹', price: 12000, repeat: false, slot: 'nameColor', value: 'bamboo',
    desc: '永久名字特效 · 青竹',
  },
  namePeach: {
    cat: '👑 外观纪念',
    icon: '🌸', name: '名字·桃夭', price: 12000, repeat: false, slot: 'nameColor', value: 'peach',
    desc: '永久名字特效 · 桃夭',
  },
  nameFlame: {
    cat: '👑 外观纪念',
    icon: '🔥', name: '名字·赤焰', price: 16000, repeat: false, slot: 'nameColor', value: 'flame',
    desc: '永久名字特效 · 赤焰',
  },
  nameWave: {
    cat: '👑 外观纪念',
    icon: '🌊', name: '名字·碧波', price: 16000, repeat: false, slot: 'nameColor', value: 'wave',
    desc: '永久名字特效 · 碧波',
  },
  nameThunder: {
    cat: '👑 外观纪念',
    icon: '⚡', name: '名字·紫电', price: 18000, repeat: false, slot: 'nameColor', value: 'thunder',
    desc: '永久名字特效 · 紫电',
  },
  nameMint: {
    cat: '👑 外观纪念',
    icon: '🍃', name: '名字·薄荷', price: 13000, repeat: false, slot: 'nameColor', value: 'mint',
    desc: '永久名字特效 · 薄荷',
  },
  nameEmber: {
    cat: '👑 外观纪念',
    icon: '🟠', name: '名字·琥珀', price: 15000, repeat: false, slot: 'nameColor', value: 'ember',
    desc: '永久名字特效 · 琥珀',
  },
}

// 外观佩戴状态：{ label, disabled, kind: 'buy'|'equip'|'equipped'|'owned' }
function btnState(id) {
  const p = PRODUCTS[id]
  const owned = !p.repeat && player.shopOwned?.[id]
  if (!owned) return { label: `🛒 购买（${p.price} 币）`, disabled: coins.value < p.price, kind: 'buy' }
  if (p.slot) {
    const equipped = player[p.slot] === p.value
    if (equipped) return { label: '✓ 佩戴中', disabled: true, kind: 'equipped' }
    return { label: '👗 佩戴', disabled: false, kind: 'equip' }
  }
  return { label: '✓ 已拥有', disabled: true, kind: 'owned' }
}

function buy(id) {
  const p = PRODUCTS[id]
  if (!p) return
  const st = btnState(id)
  if (st.kind === 'equipped' || st.kind === 'owned') return
  if (st.kind === 'equip') {
    player[p.slot] = p.value // 已拥有：免费切换佩戴
    ui.pushLog(`🛒 佩戴「${p.name}」`, 'gain')
    return
  }
  if (!player.spendGameCoins(p.price)) { ui.pushLog(`🛒 游戏币不足（需 ${p.price} 币）`, 'warn'); return }
  const res = p.apply ? p.apply() : (p.slot ? (player[p.slot] = p.value, `已佩戴「${p.name}」`) : '')
  if (!p.repeat) player.shopOwned = { ...(player.shopOwned ?? {}), [id]: true }
  ui.pushLog(`🛒 购买「${p.name}」：${res}`, 'gain')
}

const GROUPS = ['💰 经济互通', '⚡ 增益加速', '🧰 便捷用品', '👑 外观纪念']
const grouped = computed(() => GROUPS.map((cat) => ({ cat, items: Object.entries(PRODUCTS).filter(([, p]) => p.cat === cat) })))
</script>

<template>
  <div class="gs-page">
    <div class="gs-topbar">
      <span class="gs-chip"><img class="coin-ico" src="/images/icon-coin.png" alt=""> 余额 <b class="mono">{{ coins }}</b> 游戏币</span>
      <span class="gs-chip">🕹️ 七款小游戏奖励均为游戏币</span>
      <span class="gs-chip" style="margin-left: auto">🛒 购买即生效 · 一次性外观购后可在已拥有间免费佩戴切换</span>
    </div>

    <div v-for="g in grouped" :key="g.cat" class="gs-group">
      <div class="gs-group-title">{{ g.cat }}</div>
      <div class="gs-grid">
        <div v-for="[id, p] in g.items" :key="id" class="gs-card" :class="{ owned: !p.repeat && player.shopOwned?.[id] }">
          <div class="gs-card-head">
            <span class="gs-card-icon">{{ p.icon }}</span>
            <b class="gs-card-name">{{ p.name }}</b>
            <span class="gs-card-price"><img class="coin-ico" src="/images/icon-coin.png" alt="">{{ p.price }}</span>
          </div>
          <div class="gs-card-desc">{{ p.desc }}</div>
          <button
            class="gs-buy"
            :disabled="btnState(id).disabled"
            @click="buy(id)"
          >{{ btnState(id).label }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.gs-page { display: flex; flex-direction: column; gap: 14px; padding: 4px 0 12px; }
.gs-topbar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.gs-chip { padding: 5px 12px; border-radius: 999px; background: rgba(255, 252, 246, 0.8); border: 1px solid var(--border); font-size: 12px; font-weight: 700; }
.gs-group { display: flex; flex-direction: column; gap: 8px; }
.gs-group-title { font-size: 14px; font-weight: 800; color: var(--primary-strong); }
.gs-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 10px; }
.gs-card {
  display: flex; flex-direction: column; gap: 6px;
  background: rgba(255, 252, 246, 0.85);
  border: 1px solid rgba(150, 110, 70, 0.25);
  border-radius: 14px; padding: 12px;
}
.gs-card.owned { background: rgba(87, 168, 97, 0.08); border-color: rgba(87, 168, 97, 0.3); }
.gs-card-head { display: flex; align-items: center; gap: 8px; }
.gs-card-icon { font-size: 20px; }
.gs-card-name { flex: 1; font-size: 13.5px; }
.gs-card-price { display: inline-flex; align-items: center; gap: 3px; font-weight: 800; color: var(--warn-strong); font-size: 13px; }
.gs-card-desc { font-size: 12px; color: var(--muted); line-height: 1.5; }
.gs-buy {
  margin-top: auto; /* 按钮置底：卡片内描述下方沉底对齐 */
  width: 100%; padding: 8px 14px; border-radius: 999px; cursor: pointer;
  background: linear-gradient(135deg, #e8703f, #c9542e); border: none; color: #fff; font-weight: 700; font-size: 12.5px;
}
.gs-buy:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
