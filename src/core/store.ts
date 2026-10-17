export type Unsub = () => void

/**
 * 极简状态容器。状态允许原地修改，依靠显式 emit 触发视图刷新。
 * 视图不会整棵重建，只更新自己关心的节点，因此动画不会被重渲染打断。
 */
export function createStore<T>(initial: T) {
  let state = initial
  const listeners = new Set<(s: T) => void>()
  let queued = false

  function emit() {
    if (queued) return
    queued = true
    queueMicrotask(() => {
      queued = false
      for (const l of [...listeners]) l(state)
    })
  }

  return {
    get(): T {
      return state
    },
    /** 原地修改后自动广播 */
    act(fn: (s: T) => void): void {
      fn(state)
      emit()
    },
    /** 直接替换根对象 */
    replace(next: T): void {
      state = next
      emit()
    },
    emit,
    subscribe(fn: (s: T) => void): Unsub {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
  }
}
