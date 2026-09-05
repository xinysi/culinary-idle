// tilt.js — 卡片随光标倾斜指令（3D 引力感）
// 以卡片自身中心为原点，把鼠标坐标归一化到 [-1, 1]，
// 映射为 rotateX / rotateY（最大 ±10deg），通过 CSS 变量 --tilt-x / --tilt-y 驱动，
// 配合 CSS transition 平滑缓动；鼠标离开后还原到 0。
// 每个元素独立监听 / 独立写自己的变量，多卡片互不干扰。

const MAX_ANGLE = 10 // 最大倾斜角（±10°），`v-tilt:small` 时减半为 ±5°

function bindTilt(el, max = MAX_ANGLE) {
  const onMove = (e) => {
    const rect = el.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    // 归一化到 [-1, 1]，原点为卡片中心
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1
    // 光标靠上(ny=-1)→顶部抬起(rotateX 为负)；光标靠右(nx=1)→右倾(rotateY 为正)
    el.style.setProperty('--tilt-x', `${(ny * max).toFixed(2)}deg`)
    el.style.setProperty('--tilt-y', `${(nx * max).toFixed(2)}deg`)
  }
  const onLeave = () => {
    el.style.setProperty('--tilt-x', '0deg')
    el.style.setProperty('--tilt-y', '0deg')
  }
  el.addEventListener('mousemove', onMove)
  el.addEventListener('mouseleave', onLeave)
  el.__tiltHandlers = { onMove, onLeave }
}

function unbindTilt(el) {
  const h = el.__tiltHandlers
  if (h) {
    el.removeEventListener('mousemove', h.onMove)
    el.removeEventListener('mouseleave', h.onLeave)
    delete el.__tiltHandlers
  }
}

export default {
  mounted(el, binding) {
    const max = binding.arg === 'small' ? 3 : MAX_ANGLE
    bindTilt(el, max)
  },
  unmounted(el) {
    unbindTilt(el)
  },
}
