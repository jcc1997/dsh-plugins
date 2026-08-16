#!/usr/bin/env node
/**
 * sync-host-tokens.mjs — 从 vendor/deepseek-harness submodule 同步 tokens 快照
 *
 * 用法: node scripts/sync-host-tokens.mjs [--dry-run]
 *
 * 唯一来源: vendor/deepseek-harness/packages/client/ui-theme/src/styles/design-platform.css
 * (宿主 deepseek-harness 开源仓库, submodule 引入, 版本由 submodule pin 决定)
 * 输出: packages/ui/dsh/design-platform.css(头部写入来源版本, 勿手改)
 *
 * 宿主升级流程: git -C vendor/deepseek-harness fetch && git submodule update --init --recursive
 *               → node scripts/sync-host-tokens.mjs → 核对 docs/ui-design/tokens.md 差异
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')

const SRC = join(REPO_ROOT, 'vendor/deepseek-harness/packages/client/ui-theme/src/styles/design-platform.css')
const PKG_JSON = join(REPO_ROOT, 'vendor/deepseek-harness/packages/client/ui-theme/package.json')
const TARGET = join(REPO_ROOT, 'packages/ui/host/design-platform.css')
const dryRun = process.argv.includes('--dry-run')

if (!existsSync(SRC)) {
  console.error('未找到宿主 tokens 源文件: ' + SRC)
  console.error('请先初始化 submodule: git submodule update --init --recursive')
  process.exit(1)
}

const source = readFileSync(SRC, 'utf8')
let version = 'unknown'
try {
  version = JSON.parse(readFileSync(PKG_JSON, 'utf8')).version ?? version
} catch {}

const header = [
  '/* 官方 DSH 设计平台 tokens(浅色 + 深色 data-ds-dark-theme)',
  ' * 来源: @deepseek-ai/dsh-client-ui-theme@' + version + ' (vendor/deepseek-harness submodule)',
  ' * 仓库: github.com/deepseek-ai/deepseek-harness (packages/client/ui-theme, MIT)',
  ' * 用途: 插件样式与宿主规范统一的权威色板;运行时宿主已注入同名变量,直接使用',
  ' * 同步: node scripts/sync-host-tokens.mjs(宿主升级后重跑本脚本)',
  ' * 警告: 本文件由脚本生成,勿手改;改动请改宿主或追加到 docs/ui-design/ 规范',
  ' */',
  '',
].join('\n')

const body = source.startsWith('/*') ? source.slice(source.indexOf('*/') + 2).replace(/^\s*\n/, '') : source
const output = header + body
const tokenCount = (output.match(/-dsw-[a-z0-9-]+/g) || []).length

if (dryRun) {
  console.log('来源: ' + SRC)
  console.log('版本: ' + version + ' | tokens: ' + tokenCount + ' | 行数: ' + output.split('\n').length)
  process.exit(0)
}

writeFileSync(TARGET, output)
console.log('已同步 ' + TARGET)
console.log('来源: ' + SRC)
console.log('版本: ' + version + ' | tokens: ' + tokenCount + ' | 行数: ' + output.split('\n').length)
