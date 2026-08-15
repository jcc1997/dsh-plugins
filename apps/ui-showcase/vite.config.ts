import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { transformWithEsbuild } from 'vite'

// vendor/deepseek-harness 是 sparse submodule: 其 tsconfig references 链不完整,
// vite 内置 esbuild 转换会自动向上解析 tsconfig 而 ENOENT。
// 此处对 vendor 的 .tsx 手动 esbuild 转换(显式 tsconfigRaw), 返回 JS 后不再触发 tsconfig 解析。
function vendorTsx() {
  return {
    name: 'vendor-tsx-esbuild',
    enforce: 'pre',
    async transform(code, id) {
      if (!id.includes('vendor/deepseek-harness/') || !id.endsWith('.tsx')) return null
      const result = await transformWithEsbuild(code, id, {
        loader: 'tsx',
        jsx: 'automatic',
        tsconfigRaw: { compilerOptions: { jsx: 'automatic' } },
      })
      return { code: result.code, map: result.map }
    },
  }
}

export default defineConfig({
  plugins: [vendorTsx(), react()],
  server: { host: '127.0.0.1', port: 5173, strictPort: false },
})
