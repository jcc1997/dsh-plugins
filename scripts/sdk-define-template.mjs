// Code Mode SDK 定义模板：从磁盘读取编译产物 → cordis_define → cordis_run
// 用法：在 run_code 程序里粘贴本模板（替换 base/pluginId/name 等）
// 收益：产物代码（几十 KB）完全不经过模型上下文
const base = '/Users/jinchao.chen/Desktop/agent/dsh-plugins/plugins/kanban/dist'
async function readBundled(file) {
  const r = await tools.bash({
    command: `python3 -c "import json;print(json.dumps(open('${file}').read()))" | fold -w 1000`,
    description: 'Read file escaped and folded',
  })
  if (r.exitCode !== 0) throw new Error('bash failed: ' + (r.stderr && r.stderr.text))
  if (r.stdout.truncated) throw new Error('output truncated!')
  return JSON.parse(r.stdout.text.split('\n').join(''))
}
const client = await readBundled(base + '/client.js')
const host = await readBundled(base + '/host.js')
const def = await tools.cordis_define({
  plugin: { kind: 'new', idPrefix: 'kbnb' }, // 已有插件用 { kind: 'existing', pluginId }
  name: 'kanban-sdk',
  purpose: '…',
  code: { client, host },
})
const run = await tools.cordis_run({ pluginId: def.pluginId, packageId: def.packageId, mode: 'run' })
return { def, run }
