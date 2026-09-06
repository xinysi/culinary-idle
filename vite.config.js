import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  // 相对 base：构建产物用 ./assets/… 引用——
  // ① GitHub Pages 子路径（/culinary-idle/）直接可用；
  // ② Electron file:// 加载不再依赖 fix_paths 改写（保留兼容）。
  base: './',
  server: {
    port: 5173,
    host: true,
  },
})
