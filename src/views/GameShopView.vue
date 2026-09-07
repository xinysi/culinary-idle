<script setup>
// 游戏商店（2026-09-07 新增）：小游戏奖励「游戏币」的唯一消费口；货架内容待定，当前展示候选商品建议
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'

const player = usePlayerStore()
const coins = computed(() => player.gameCoins ?? 0)

// 候选商品建议（2026-09-07 用户要求先提供建议，选定后上架；价格均为建议值）
const SUGGESTIONS = [
  {
    cat: '💰 经济互通',
    items: [
      { icon: '💰', name: '金币兑换包', price: 100, desc: '100 游戏币 → 金币 ×1000（主货币互通）' },
      { icon: '🎁', name: '稀有食材盲盒', price: 120, desc: '随机稀有食材 1~3 份（松露/灵果/龙根等池）' },
    ],
  },
  {
    cat: '⚡ 增益加速',
    items: [
      { icon: '🔥', name: '双倍挂机药剂', price: 80, desc: '采集/制作经验 ×2 · 持续 30 分钟' },
      { icon: '🍪', name: '离线饼干礼包', price: 50, desc: '能量饼干 ×3（提升离线收益上限）' },
    ],
  },
  {
    cat: '🧰 便捷用品',
    items: [
      { icon: '🎴', name: '觅珍抽卡券', price: 200, desc: '觅珍单抽券 ×1（普通/限时池通用）' },
      { icon: '⏩', name: '制作加速器', price: 60, desc: '制作队列立即完成 10 分钟产量' },
    ],
  },
  {
    cat: '👑 外观纪念',
    items: [
      { icon: '👑', name: '「大胃王」称号', price: 500, desc: '永久称号，头像旁展示' },
      { icon: '🖼️', name: '「神厨」头像框', price: 1000, desc: '永久头像框，名字高亮展示' },
      { icon: '🧸', name: '限定头像·像素厨神', price: 800, desc: '商店专属头像（可设为主头像）' },
    ],
  },
]
</script>

<template>
  <div class="gs-page">
    <div class="gs-topbar">
      <span class="gs-chip"><img class="coin-ico" src="/images/icon-coin.png" alt=""> 余额 <b class="mono">{{ coins }}</b> 游戏币</span>
      <span class="gs-chip">🕹️ 七款小游戏奖励均为游戏币</span>
      <span class="gs-chip" style="margin-left: auto">🛒 货架筹备中 · 以下为候选建议</span>
    </div>

    <div class="gs-note">
      🧾 老板还没定进货单——先摆出「候选商品建议」，选定后上架即可购买。每一类都列了价目和效果，欢迎挑挑拣拣！
    </div>

    <div v-for="g in SUGGESTIONS" :key="g.cat" class="gs-group">
      <div class="gs-group-title">{{ g.cat }}</div>
      <div class="gs-grid">
        <div v-for="it in g.items" :key="it.name" class="gs-card">
          <div class="gs-card-head">
            <span class="gs-card-icon">{{ it.icon }}</span>
            <b class="gs-card-name">{{ it.name }}</b>
            <span class="gs-card-price"><img class="coin-ico" src="/images/icon-coin.png" alt="">{{ it.price }}</span>
          </div>
          <div class="gs-card-desc">{{ it.desc }}</div>
          <span class="gs-badge">待定价</span>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.gs-page { display: flex; flex-direction: column; gap: 14px; padding: 4px 0 12px; }
.gs-topbar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.gs-chip { padding: 5px 12px; border-radius: 999px; background: rgba(255, 252, 246, 0.8); border: 1px solid var(--border); font-size: 12px; font-weight: 700; }
.gs-note { padding: 10px 14px; border-radius: 12px; background: rgba(255, 244, 214, 0.75); border: 1px dashed rgba(217, 138, 43, 0.45); font-size: 13px; color: var(--text); }
.gs-group { display: flex; flex-direction: column; gap: 8px; }
.gs-group-title { font-size: 14px; font-weight: 800; color: var(--primary-strong); }
.gs-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 10px; }
.gs-card {
  display: flex; flex-direction: column; gap: 6px;
  background: rgba(255, 252, 246, 0.85);
  border: 1px solid rgba(150, 110, 70, 0.25);
  border-radius: 14px; padding: 12px;
}
.gs-card-head { display: flex; align-items: center; gap: 8px; }
.gs-card-icon { font-size: 20px; }
.gs-card-name { flex: 1; font-size: 13.5px; }
.gs-card-price { display: inline-flex; align-items: center; gap: 3px; font-weight: 800; color: var(--warn-strong); font-size: 13px; }
.gs-card-desc { font-size: 12px; color: var(--muted); line-height: 1.5; }
.gs-badge { align-self: flex-start; font-size: 11px; padding: 2px 8px; border-radius: 999px; background: rgba(150, 110, 70, 0.12); color: var(--muted); font-weight: 700; }
</style>
