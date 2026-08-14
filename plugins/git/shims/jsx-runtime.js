// react/jsx-runtime shim：受限环境没有 jsx-runtime，只有全局 React。
// esbuild 通过 alias 把 'react/jsx-runtime' 解析到这里；
// 这里只用 external 的 'react'（构建后引用受限环境注入的 React 全局）。
import React from 'react'

export const jsx = (type, props, key) => {
  if (key !== undefined && key !== null) {
    return React.createElement(type, { ...props, key })
  }
  return React.createElement(type, props)
}

export const jsxs = (type, props, key) => jsx(type, props, key)

export const Fragment = React.Fragment
