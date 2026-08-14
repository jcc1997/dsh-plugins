// git 插件客户端半（M2 最小）：无 UI；M3 将在此注册 sync 按钮到 kanban 槽位
function makePlugin() {
  return {
    name: 'git',
    apply() {
      /* M3：ctx.slots.inject('kanban.card.actions', ...) 注册同步按钮 */
    },
  }
}
export default makePlugin()
