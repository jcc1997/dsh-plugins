// react shim：受限环境中 React 是 closure 注入的自由变量（非 require/import 可解析）
export default React
export const useState = React.useState
export const useEffect = React.useEffect
export const useRef = React.useRef
export const useCallback = React.useCallback
export const useMemo = React.useMemo
export const createElement = React.createElement
export const Fragment = React.Fragment
