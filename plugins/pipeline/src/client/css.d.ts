// CSS 文本导入声明（esbuild loader: { '.css': 'text' }，产物为字符串）
declare module '*.css' {
  const content: string
  export default content
}
