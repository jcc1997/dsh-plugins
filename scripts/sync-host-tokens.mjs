#!/usr/bin/env node
/**
 * sync-host-tokens.mjs — 从 DSH 宿主同步全量 design-platform.css tokens 快照
 *
 * 用法:
 *   node scripts/sync-host-tokens.mjs                 # 自动在 pnpm dlx 缓存中定位宿主包
 *   node scripts/sync-host-tokens.mjs --src <path>    # 显式指定宿主 design-platform.css
 *   node scripts/sync-host-tokens.mjs --dry-run       # 只打印将写入的头注释与差异统计
 *
 * 行为:
 *   - 全量拷贝宿主 lib/styles/design-platform.css → packages/ui/dsh/design-platform.css
 *   - 头部写入来源元信息(包名/版本/仓库/源路径),版本变化时提示
 *   - 宿主(deepseek-harness)升级后重跑本脚本即完成同步
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const TARGET = join(REPO_ROOT, 'packages/ui/dsh/design-platform.css')
const PKG_NAME = '@deepseek-ai/dsh-client-ui-theme' // node_modules 下的真实包名
const PKG_DIR_NAME = PKG_NAME.replace('/', '+') // .pnpm 目录里的转义包名
const PKG_DIR = 'packages/client/ui-theme'
const REPO_URL = 'github.com/deepseek-ai/deepseek-harness'

const args = process.argv.slice(2)
const srcArg = args.find((a) => a.startsWith('--src='))?.slice(6)
const dryRun = args.includes('--dry-run')

/** 定位宿主 design-platform.css:
 *  1) vendor/deepseek-harness submodule(源码,首选,pin 版本)
 *  2) pnpm dlx 缓存(构建产物,fallback,多个版本取 semver 最高) */
function locateHostSource() {
  const vendorSrc = join(REPO_ROOT, 'vendor/deepseek-harness/packages/client/ui-theme/src/styles/design-platform.css')
  if (existsSync(vendorSrc)) return { css: vendorSrc, version: 'submodule' }
  const dlxRoot = join(homedir(), 'Library/Caches/pnpm/dlx')
  if (!existsSync(dlxRoot)) return null
  const hits = []
  // 缓存结构: <hash>/<sub>/node_modules/.pnpm/... 递归下探最多 3 层
  const walk = (dir, depth) => {
    if (depth > 3) return
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const sub = join(dir, entry.name)
        if (entry.name === '.pnpm') {
          for (const pkg of readdirSync(sub)) {
            if (!pkg.startsWith(PKG_DIR_NAME + '@')) continue
            const css = join(sub, pkg, 'node_modules', PKG_NAME, 'lib/styles/design-platform.css')
            if (existsSync(css)) {
              hits.push({ css, version: pkg.split('@')[2]?.split('_')[0] ?? 'unknown' })
            }
          }
        } else {
          walk(sub, depth + 1)
        }
      }
    }
  }
  walk(dlxRoot, 0)
  if (!hits.length) return null
  // semver 排序取最高
  hits.sort((a, b) => {
    const pa = a.version.split('.').map((n) => parseInt(n, 10) || 0)
    const pb = b.version.split('.').map((n) => parseInt(n, 10) || 0)
    for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pb[i] ?? 0) - (pa[i] ?? 0)
    return 0
  })
  return hits[0]
}

const hit = srcArg ? { css: srcArg, version: 'manual' } : locateHostSource()
if (!hit) {
  console.error('未找到宿主包,请用 --src=<path> 显式指定 design-platform.css')
  process.exit(1)
}
if (!existsSync(hit.css)) {
  console.error('源文件不存在: ' + hit.css)
  process.exit(1)
}

const source = readFileSync(hit.css, 'utf8')
const existing = existsSync(TARGET) ? readFileSync(TARGET, 'utf8') : null

// 提取宿主包版本:submodule 用 ui-theme/package.json;缓存产物用 lib/package.json
let version = hit.version
try {
  const pkgJsonPath =
    version === 'submodule'
      ? join(REPO_ROOT, 'vendor/deepseek-harness/packages/client/ui-theme/package.json')
      : join(dirname(hit.css), '../../..', 'package.json')
  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'))
  version = pkgJson.version ?? version
} catch {}

const header = [
  '/* 官方 DSH 设计平台 tokens(浅色 + 深色 data-ds-dark-theme)',
  ' * 来源: ' + PKG_NAME + '@' + version + ' lib/styles/design-platform.css',
  ' * 仓库: ' + REPO_URL + ' (' + PKG_DIR + ', MIT)',
  ' * 用途: 插件样式与宿主规范统一的权威色板;运行时宿主已注入同名变量,直接使用',
  ' * 同步: node scripts/sync-host-tokens.mjs(宿主升级后重跑本脚本)',
  ' * 警告: 本文件由脚本生成,勿手改;改动请改宿主或追加到 docs/ui-design/ 规范',
  ' */',
  '',
].join('\n')

const body = source.startsWith('/*') ? source.slice(source.indexOf('*/') + 2).replace(/^\s*\n/, '') : source
const output = header + body

if (dryRun) {
  console.log('dry-run: 将写入 ' + TARGET)
  console.log('来源: ' + hit.css)
  console.log('版本: ' + version + ' | 源行数: ' + source.split('\n').length + ' | 输出行数: ' + output.split('\n').length)
  process.exit(0)
}

const tokenCount = (output.match(/-dsw-[a-z0-9-]+/g) || []).length
writeFileSync(TARGET, output)
console.log('已同步 ' + TARGET)
console.log('来源: ' + hit.css)
console.log('版本: ' + version + ' | tokens: ' + tokenCount + ' | 行数: ' + output.split('\n').length)
