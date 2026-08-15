// node-shims.d.ts — 本插件 host 半直接用 node 内建模块(读本地文件),为 tsc 声明最小类型面
declare module 'node:fs' {
  export function readFileSync(path: string): Buffer
export function readFileSync(path: string, encoding: 'utf8'): string
  export function statSync(path: string): { isFile(): boolean; size: number }
  export function existsSync(path: string): boolean
  export function mkdirSync(path: string, opts?: { recursive?: boolean }): void
  export function writeFileSync(path: string, data: string): void
}
declare module 'node:os' {
  export function homedir(): string
}
declare module 'node:path' {
  export function join(...parts: string[]): string
  export function resolve(...parts: string[]): string
  export function basename(p: string): string
}
declare module 'node:crypto' {
  export function createHash(algo: string): { update(data: string): { digest(enc: 'hex'): string } }
}declare module 'node:url' {
  export function fileURLToPath(url: URL | string): string
}
