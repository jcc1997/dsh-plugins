import { build } from 'esbuild'
const res = await build({
  entryPoints: ['/tmp/esb-entry.tsx'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  jsx: 'automatic',
  external: ['react', 'react/jsx-runtime', 'react-dom', '@deepseek-ai/*'],
  write: false,
  absWorkingDir: '/Users/jinchao.chen/Desktop/agent/dsh-plugins/plugins/kanban',
  metafile: true,
}).catch(e => { console.log('BUILD ERROR:', JSON.stringify(e.errors?.slice(0, 3).map(x => x.text))); process.exit(1) })
const js = res.outputFiles.find(f => f.path.endsWith('.js')).text
console.log('close defs:', (js.match(/IconCloseOutline16\s*=/g) || []).length, 'refs:', (js.match(/IconCloseOutline16/g) || []).length)
console.log('vendor trash path in bundle:', js.includes('M14.4782 4.84067'))
const inputs = Object.keys(res.metafile.inputs)
console.log('inputs:', inputs.length, '| vendor icons input:', inputs.filter(k => k.includes('icons')).join(','))
