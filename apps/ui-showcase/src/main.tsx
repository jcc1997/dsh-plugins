// src/main.tsx — showcase 入口:注入宿主 tokens + 组件样式,渲染组件库画廊
import React from 'react'
import { createRoot } from 'react-dom/client'
import tokensCss from '../../../packages/ui/host/design-platform.css?raw'
import { composerCss } from '@dsh-plugins/ui'
import { mdrCss } from '../../../plugins/markdown-review/src/client/styles'
import { plpCss, xyflowThemeCss } from '../../../plugins/pipeline/src/client/styles'
import xyflowRaw from '../../../plugins/pipeline/node_modules/@xyflow/react/dist/style.css?raw'
import { Showcase } from './Showcase'
import { showcaseCss } from './showcase-styles'

const style = document.createElement('style')
style.textContent = tokensCss + mdrCss + composerCss + plpCss + xyflowRaw + xyflowThemeCss + showcaseCss
document.head.appendChild(style)

createRoot(document.getElementById('root')!).render(<Showcase />)
