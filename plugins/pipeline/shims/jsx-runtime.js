// react/jsx-runtime shim：受限环境没有 jsx-runtime，只有全局 React。
import React from 'react'
export const jsx = (type, props, key) => {
  if (key !== undefined && key !== null) return React.createElement(type, { ...props, key })
  return React.createElement(type, props)
}
export const jsxs = (type, props, key) => jsx(type, props, key)
export const Fragment = React.Fragment
