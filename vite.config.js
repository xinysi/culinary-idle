import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  // 相对 base：构建产物用 ./assets/… 引用——
  // ① GitHub Pages 子路径（/culinary-idle/）直接可用；
  // ② Electron file:// 加载不再依赖 fix_paths 改写（保留兼容）。
  base: './',
  build: {
    // ⚠️⚠️ CSS 交给压缩器就会**被改写**：2026-09-17 用户报「线上版与 exe 的窗口透明度跟本地完全不一样」。
    // 根因链（逐一实测确认，别再走弯路）：
    //   ① Vite 8（rolldown 版）的 CSS 压缩器是 **lightningcss**（esbuild 已不再随 vite 提供，
    //      `cssMinify: 'esbuild'` 会直接报 "Cannot find package 'esbuild'"；`cssTarget` 怎么设都没用）；
    //   ② lightningcss 遇到**同时写了标准与前缀**的规则会去重，并且**留下 `-webkit-` 版、删掉标准版**
    //      （实测任何 targets 都如此：{} / chrome110 / safari18 / 只给 safari16.4 结果一致）；
    //   ③ 而新版 Chromium **不认 `-webkit-backdrop-filter`**（实测 Chromium 151 下算出 `none`）⇒
    //      `.card` / 顶栏 / 侧栏 / 弹窗这些**主毛玻璃面的模糊在构建产物里全部消失**（dev 正常，所以只有线上与 exe 现形）；
    //      `mask` 的标准写法同理被删（流光效果）。
    // 结论：**关掉 CSS 压缩**，原样输出作者写的 CSS（源码里需要 Safari 兼容处本来就手写了 `-webkit-` 版本）。
    // 代价（实测）：主样式表 gzip 22.6KB → 45.7KB（全部 CSS 原始 388KB → 507KB），可接受；
    // 换来的是「写什么就上线什么」，不会再被工具悄悄改写。守卫见 `scripts/ci/css_output_audit.mjs`（CI 在 build 后跑）。
    cssMinify: false,
  },
  server: {
    port: 5173,
    host: true,
  },
})
