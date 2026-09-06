<script setup>
// 配方导航树节点（递归，2026-09-06）
import { getItem } from '../game/data/items.js'
import { itemSources } from '../game/data/itemSources.js'
import { itemNavs, navText } from '../game/data/itemNav.js'
const props = defineProps({ node: Object, player: Object })
defineEmits(['jump'])
</script>

<template>
  <li class="rt-node">
    <div class="rt-row" :style="{ '--d': node.depth }">
      <!-- 第一行：名称 / 数量 / 持有 -->
      <div class="rt-line1">
        <span class="rt-name">{{ getItem(node.itemId)?.name ?? node.itemId }}</span>
        <span class="mono rt-qty">×{{ node.qty }}</span>
        <span class="mono dim">持有 {{ player.inventory[node.itemId] ?? 0 }}</span>
      </div>
      <!-- 第二行：来源 / 跳转按钮 -->
      <div class="rt-line2">
        <span v-if="node.recipe" class="rt-src rt-src-craft">🌳 配方：{{ node.recipe.name }}</span>
        <!-- 根节点（就是当前打开的配方）不做自身跳转；其余产物节点可跳去制作 -->
        <button
          v-if="node.recipe && !node.recipe.isSelf"
          class="btn btn-sm"
          @click="$emit('jump', { type: 'craft', skillId: node.recipe.skillId, recipeId: node.recipe.recipeId, reqLevel: node.recipe.reqLevel })"
          :title="`跳转到「${node.recipe.name}」所在技能`"
        >去做</button>
        <template v-if="!node.recipe">
          <span v-for="(s, i) in itemSources(node.itemId).slice(0, 3)" :key="'s' + i" class="rt-src">{{ s }}</span>
          <template v-for="nav in itemNavs(node.itemId).slice(0, 2)" :key="'n' + nav.type + (nav.skillId ?? '')">
            <button class="btn btn-sm" @click="$emit('jump', nav)" :title="nav.label">{{ navText(nav) }}</button>
          </template>
        </template>
      </div>
    </div>
    <ul v-if="node.children?.length" class="rt-children">
      <RecipeTreeNode
        v-for="(c, i) in node.children"
        :key="c.itemId + '-' + i"
        :node="c"
        :player="player"
        @jump="$emit('jump', $event)"
      />
    </ul>
  </li>
</template>
