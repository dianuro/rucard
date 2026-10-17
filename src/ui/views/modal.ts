import { h } from '../dom'

/** 通用弹层：牌堆查看、规则说明等 */
export function openModal(title: string, sub: string, body: HTMLElement, onClose?: () => void): void {
  const close = (): void => {
    bg.remove()
    onClose?.()
  }
  const btn = h('button', { class: 'btn sm violet', text: '关闭' })
  btn.addEventListener('click', close)
  const head = h('div', { class: 'head' }, h('h2', { text: title }), h('div', { class: 'sub', text: sub }))
  head.append(h('div', { style: { flex: '1' } }), btn)
  const sheet = h('div', { class: 'panel sheet' }, head, body)
  const bg = h('div', { class: 'modal-bg' }, sheet)
  bg.addEventListener('click', (ev) => {
    if (ev.target === bg) close()
  })
  const onKey = (ev: KeyboardEvent): void => {
    if (ev.key === 'Escape') {
      window.removeEventListener('keydown', onKey)
      close()
    }
  }
  window.addEventListener('keydown', onKey)
  document.body.append(bg)
}
