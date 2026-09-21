import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/** 本次构建是否把开发者面板打进去：默认只认 dev（`vite build` 下 import.meta.env.DEV 为 false） */
const devPanelEnabled = process.env.VITE_DEV_PANEL === '1'

/**
 * 开发者面板的**构建期隔离**（2026-09-18 立）
 *
 * 背景：`App.vue` 里写的是 `DEV_PANEL_ENABLED ? defineAsyncComponent(() => import('DevEntry.vue')) : null`。
 * 生产构建下这个条件会被静态折叠成 `false`，**入口 chunk 里就不会引用它**（实测主包确实没有 DevEntry 字样）——
 * 但打包器**仍然会把那个动态 import 的异步 chunk 生成出来**（一个没人引用的孤立 chunk），
 * 里面有面板代码与**口令哈希**。文件照样发布出去 ⇒ 玩家可以按 URL 把 JS 拉下来读。
 *
 * 所以这里在产物写完后把它清掉，且**删之前先断言入口没引用它**：
 * 一旦入口引用了（说明隔离失效、开关被打开了），直接让构建失败，而不是悄悄删掉一个还要用的文件。
 */
function stripDevPanelChunks() {
  let outDir = 'dist'
  return {
    name: 'strip-dev-panel-chunks',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir
    },
    closeBundle() {
      if (devPanelEnabled) return // 明确要带面板的构建：不动
      const assets = path.resolve(outDir, 'assets')
      if (!fs.existsSync(assets)) return
      const orphans = fs.readdirSync(assets).filter((f) => /^(DevEntry|DevPanel)-.*\.js$/.test(f))
      if (!orphans.length) return
      const entries = fs.readdirSync(assets).filter((f) => f.endsWith('.js') && !orphans.includes(f))
      const entryText = entries.map((f) => fs.readFileSync(path.join(assets, f), 'utf8')).join('\n')
      for (const f of orphans) {
        const base = f.replace(/\.js$/, '')
        if (entryText.includes(base)) {
          throw new Error(`[dev-panel] 入口 chunk 引用了 ${f}，但它不该在本次构建里出现（VITE_DEV_PANEL=${process.env.VITE_DEV_PANEL ?? '未设置'}）——请检查 App.vue 的门控条件`)
        }
        fs.rmSync(path.join(assets, f))
        console.log(`[dev-panel] 已移除开发者面板的孤立 chunk：assets/${f}`)
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), stripDevPanelChunks()],
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
