export interface View {
  el: HTMLElement
  update(): void
  destroy?(): void
}
