// src/main.tsx — showcase 入口:注入宿主 tokens + 组件样式,渲染组件库画廊
import React from 'react'
import { createRoot } from 'react-dom/client'
import tokensCss from '../../../packages/ui/dsh/design-platform.css?raw'
import { composerCss } from '@dsh-plugins/ui'
import { mdrCss } from '../../../plugins/markdown-review/src/client/styles'
import { Showcase } from './Showcase'
import { showcaseCss } from './showcase-styles'

const style = document.createElement('style')
style.textContent = tokensCss + mdrCss + composerCss + showcaseCss
document.head.appendChild(style)

createRoot(document.getElementById('root')!).render(<Showcase />)
