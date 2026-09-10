<script setup>
// 荣誉殿堂（2026-09-10 新增）— 把既有的 76 个称号从「纯展示」变成「有被动」：
// 佩戴的称号给一条 2% 被动，按累计拥有称号数升「荣誉等级」（每级四条通道各 +1%）。
// 纯读取层：称号数据本身（名称/来源）未被改动。
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { ALL_TITLES, HONOR_STATS, HONOR_MAX_LEVEL, HONOR_PER_LEVEL, TITLE_PERK_VALUE, perkOf, honorLevelOf } from '../game/data/honor.js'
import ProgressBar from '../components/ProgressBar.vue'

const player = usePlayerStore()
const ui = useUiStore()

const ownedNames = computed(() => new Set(player.ownedTitles()))
const state = computed(() => player.honorState())
const prog = computed(() => player.honorProgress())
const perks = computed(() => state.value.perks)

// 佩戴中：切到别的称号（称号墙点选）
function equip(name) {
  if (!ownedNames.value.has(name)) return
  if (player.title === name) {
    player.title = null
    ui.pushLog(`已卸下称号「${name}」`, 'info')
  } else {
    player.title = name
    const p = perkOf(name)
    ui.pushLog(`佩戴称号「${name}」（${p.label}）`, 'info')
  }
}

// 称号墙：已拥有排前，未拥有标灰
const rows = computed(() =>
  ALL_TITLES.map((t) => {
    const owned = ownedNames.value.has(t.name)
    return { ...t, owned, perk: perkOf(t.name), equipped: player.title === t.name }
  }).sort((a, b) => (b.owned ? 1 : 0) - (a.owned ? 1 : 0) || a.name.localeCompare(b.name, 'zh'))
)
const onlyOwned = ref(false)
const shown = computed(() => (onlyOwned.value ? rows.value.filter((r) => r.owned) : rows.value))

// 各通道汇总（用于顶部四张小卡）
const channels = computed(() =>
  Object.values(HONOR_STATS).map((s) => ({
    ...s,
    value: perks.value[s.id] ?? 0,
    fromLevel: state.value.level,
    fromTitle: state.value.perTitle?.stat === s.id ? state.value.perTitle.value : 0,
  }))
)

// 按来源统计
const byFrom = computed(() => {
  const m = {}
  for (const r of rows.value) {
    const k = r.from
    if (!m[k]) m[k] = { total: 0, owned: 0 }
    m[k].total++
    if (r.owned) m[k].owned++
  }
  return Object.entries(m).map(([k, v]) => ({ from: k, ...v }))
})

function perkChipClass(stat) {
  return 'perk-chip perk-' + stat
}
import RelatedPages from '../components/RelatedPages.vue'
// 相关页面（2026-09-10 补）
const RELATED = [{ view: 'codexExchange', label: '📖 图鉴兑换' }, { view: 'milestones', label: '🗺 里程碑' }, { view: 'log', label: '📖 图鉴/称号' }]
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🎖 荣誉殿堂</h2>
        <p class="dim">
          称号不再只是好看：<b>佩戴</b>的称号给一条 <b>{{ TITLE_PERK_VALUE }}%</b> 被动（按称号关键词归入四条通道之一）；
          每拥有 <b>{{ HONOR_PER_LEVEL }}</b> 个称号升 1 级<b>荣誉等级</b>（封顶 {{ HONOR_MAX_LEVEL }} 级），每级四条通道各 <b>+1%</b>。
          称号来源：成就解锁 {{ rows.filter((r) => r.from === '成就').length }} 个 + 游戏商店 {{ rows.filter((r) => r.from === '商店').length }} 个，共 <b>{{ rows.length }}</b> 个。
        </p>
      </div>
    </header>

    <!-- 荣誉等级总览 -->
    <div class="card honor-hero">
      <div class="honor-hero-left">
        <div class="honor-level">
          <span class="honor-level-num">{{ prog.level }}</span>
          <span class="dim honor-level-max">/ {{ HONOR_MAX_LEVEL }}</span>
        </div>
        <div class="dim">荣誉等级</div>
      </div>
      <div class="honor-hero-right">
        <div class="rev-bar-label">
          <span class="dim">
            已拥有称号 <b class="mono">{{ prog.have + prog.level * HONOR_PER_LEVEL }}</b> / {{ prog.total }}
          </span>
          <span class="mono">{{ prog.next == null ? '已满级' : `再 ${prog.next} 个升 ${prog.level + 1} 级` }}</span>
        </div>
        <ProgressBar :progress="prog.pct" />
        <div class="honor-equipped">
          <span class="dim">当前佩戴：</span>
          <span v-if="state.equipped" class="honor-eq-name">{{ state.equipped }}</span>
          <span v-else class="dim">未佩戴（点下方称号墙佩戴）</span>
          <span v-if="state.perTitle" :class="perkChipClass(state.perTitle.stat)">{{ state.perTitle.label }}</span>
          <span v-else-if="state.equipped" class="dim">（该称号未在已拥有列表中）</span>
        </div>
      </div>
    </div>

    <!-- 四条通道 -->
    <div class="honor-channels">
      <div v-for="c in channels" :key="c.id" class="card honor-ch" :class="'honor-ch-' + c.id">
        <div class="honor-ch-head">
          <span class="honor-ch-icon">{{ c.icon }}</span>
          <strong>{{ c.name }}</strong>
          <span class="honor-ch-val mono">+{{ c.value }}%</span>
        </div>
        <div class="dim honor-ch-desc">{{ c.desc }}</div>
        <div class="dim honor-ch-from">
          荣誉等级 +{{ c.fromLevel }}%<template v-if="c.fromTitle"> · 佩戴称号 +{{ c.fromTitle }}%</template>
        </div>
      </div>
    </div>

    <!-- 称号墙 -->
    <div class="card">
      <div class="honor-wall-head">
        <span class="honor-h">🏅 称号墙（{{ ownedNames.size }} / {{ rows.length }} 已拥有）</span>
        <button class="btn btn-sm" @click="onlyOwned = !onlyOwned">
          {{ onlyOwned ? '显示全部' : '只看已拥有' }}
        </button>
      </div>

      <div class="honor-sources">
        <span v-for="s in byFrom" :key="s.from" class="honor-src-chip">
          {{ s.from }}：<b class="mono">{{ s.owned }}</b> / {{ s.total }}
        </span>
      </div>

      <div class="honor-wall">
        <button
          v-for="r in shown"
          :key="r.id"
          class="honor-tile"
          :class="{ owned: r.owned, equipped: r.equipped }"
          :disabled="!r.owned"
          :title="r.owned ? `${r.name} — ${r.perk.label}（点击${r.equipped ? '卸下' : '佩戴'}）` : `未拥有：${r.from === '成就' ? `成就「${r.achName}」` : r.desc}`"
          @click="equip(r.name)"
        >
          <span class="honor-tile-name">{{ r.name }}</span>
          <span class="honor-tile-perk" :class="perkChipClass(r.perk.stat)">{{ r.perk.label }}</span>
          <span class="dim honor-tile-from">{{ r.from }}</span>
        </button>
      </div>

      <p class="dim honor-tip">
        未点亮的称号显示为灰色，鼠标悬停可看到获取条件。称号被动按名称关键词归类（采/渔/矿…→采集产量，厨/刀/火…→制作成功率，商/财/酒…→经营收入，其余→全技能经验）。
      </p>
    </div>
    <RelatedPages :links="RELATED" />
</div>
</template>

<style scoped>
.honor-hero {
  margin-top: 12px;
  padding: 14px 16px;
  display: flex;
  gap: 18px;
  align-items: center;
  flex-wrap: wrap;
}
.honor-hero-left {
  text-align: center;
  min-width: 96px;
}
.honor-level {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
}
.honor-level-num {
  font-size: 40px;
  font-weight: 700;
  line-height: 1;
  color: var(--accent, #d95a38);
}
.honor-level-max {
  font-size: 13px;
}
.honor-hero-right {
  flex: 1;
  min-width: 240px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rev-bar-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
}
.honor-equipped {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 12px;
}
.honor-eq-name {
  font-weight: 600;
}
.honor-channels {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.honor-ch {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.honor-ch-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.honor-ch-icon {
  font-size: 18px;
}
.honor-ch-val {
  margin-left: auto;
  color: var(--good, #57a861);
}
.honor-ch-desc {
  font-size: 12px;
  line-height: 1.5;
}
.honor-ch-from {
  font-size: 11px;
}
.honor-wall-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.honor-h {
  font-weight: 600;
}
.honor-sources {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 8px 0;
}
.honor-src-chip {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--bg-soft);
  border: 1px dashed var(--border);
}
.honor-wall {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px;
  margin-top: 6px;
}
.honor-tile {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 8px 10px;
  text-align: left;
  cursor: pointer;
  border-radius: 8px;
  border: 1px dashed var(--border);
  background: var(--bg-soft);
  color: inherit;
  opacity: 0.55;
}
.honor-tile.owned {
  opacity: 1;
  border-style: solid;
}
.honor-tile.equipped {
  border-color: var(--accent, #d95a38);
  box-shadow: 0 0 12px var(--gold-glow, rgba(232, 180, 95, 0.12));
}
.honor-tile:disabled {
  cursor: default;
}
.honor-tile-name {
  font-weight: 600;
  font-size: 13px;
}
.honor-tile-perk,
.honor-tile-from {
  font-size: 11px;
}
.honor-tile-perk {
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(127, 127, 127, 0.14);
}
.perk-xpPct { color: var(--info, #3b8bb8); }
.perk-gatherPct { color: var(--good, #57a861); }
.perk-craftPct { color: var(--warn, #e08c0e); }
.perk-goldPct { color: var(--gold, #a8780b); }
.honor-tip {
  font-size: 12px;
  margin-top: 10px;
  line-height: 1.6;
}
</style>
