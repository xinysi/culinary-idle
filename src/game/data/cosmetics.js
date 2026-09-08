// 商店外观配色表（2026-09-09）：名字特效颜色（Sidebar 渲染用）
// 头像框样式在 src/styles/main.css（.avatar-frame-<key>）
export const NAME_COLORS = {
  gold: '#eab04a', // 鎏金
  silver: '#b8c4cc', // 银辉
  bamboo: '#7fbf6a', // 青竹
  peach: '#f2a0b5', // 桃夭
  flame: '#e8703f', // 赤焰
  wave: '#4fa8d8', // 碧波
  thunder: '#9a7ae0', // 紫电
  mint: '#5fd6b8', // 薄荷
  ember: '#d98a2b', // 琥珀
}

export function nameColorOf(key) {
  return key ? (NAME_COLORS[key] ?? null) : null
}
