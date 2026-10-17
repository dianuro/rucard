/**
 * 全合成音效引擎：没有任何音频文件，一切由 WebAudio 现场合成。
 * 目标音色 —— 空灵、金属、带混响，像在石造回廊里敲响某种东西。
 */

type Wave = OscillatorType

const MINOR = [0, 2, 3, 5, 7, 8, 10] // 自然小调
const PENTA = [0, 3, 5, 7, 10] // 小调五声

export class Sfx {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private wet: GainNode | null = null
  private droneNodes: { osc: OscillatorNode[]; gain: GainNode; lfo: OscillatorNode } | null = null
  private muted = false
  private lastAt = 0

  setMuted(m: boolean): void {
    this.muted = m
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.05)
    }
  }

  /** 必须在一次用户手势中调用 */
  unlock(): void {
    const ctx = this.ensure()
    if (ctx.state === 'suspended') void ctx.resume()
  }

  private ensure(): AudioContext {
    if (this.ctx) return this.ctx
    const Ctor: typeof AudioContext =
      (window as unknown as { AudioContext: typeof AudioContext }).AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctor()
    this.ctx = ctx

    const master = ctx.createGain()
    master.gain.value = this.muted ? 0 : 0.85
    master.connect(ctx.destination)
    this.master = master

    // 生成一段脉冲响应，做出石廊混响
    const len = Math.floor(ctx.sampleRate * 1.9)
    const ir = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch)
      for (let i = 0; i < len; i++) {
        const t = i / len
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.2) * (1 - t * 0.2)
      }
    }
    const conv = ctx.createConvolver()
    conv.buffer = ir
    const wet = ctx.createGain()
    wet.gain.value = 0.34
    wet.connect(conv)
    conv.connect(master)
    this.wet = wet

    return ctx
  }

  /* ─────────── 基元 ─────────── */

  private note(semi: number, base = 220): number {
    return base * Math.pow(2, semi / 12)
  }

  private tone(opts: {
    freq: number
    to?: number
    dur?: number
    gain?: number
    type?: Wave
    attack?: number
    send?: number
    detune?: number
    delay?: number
  }): void {
    const ctx = this.ensure()
    const t0 = ctx.currentTime + (opts.delay ?? 0)
    const dur = opts.dur ?? 0.28
    const osc = ctx.createOscillator()
    osc.type = opts.type ?? 'sine'
    osc.frequency.setValueAtTime(opts.freq, t0)
    if (opts.to !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t0 + dur)
    }
    if (opts.detune) osc.detune.value = opts.detune

    const g = ctx.createGain()
    const peak = opts.gain ?? 0.2
    const atk = opts.attack ?? 0.006
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(peak, t0 + atk)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)

    osc.connect(g)
    g.connect(this.master!)
    if (this.wet && opts.send !== 0) {
      const s = ctx.createGain()
      s.gain.value = opts.send ?? 0.5
      g.connect(s)
      s.connect(this.wet)
    }
    osc.start(t0)
    osc.stop(t0 + dur + 0.05)
  }

  /** FM 钟：金属撞击的核心音色 */
  private fm(opts: {
    carrier: number
    mod?: number
    index?: number
    dur?: number
    gain?: number
    send?: number
    delay?: number
    to?: number
  }): void {
    const ctx = this.ensure()
    const t0 = ctx.currentTime + (opts.delay ?? 0)
    const dur = opts.dur ?? 0.5
    const car = ctx.createOscillator()
    car.type = 'sine'
    car.frequency.setValueAtTime(opts.carrier, t0)
    if (opts.to) car.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur)

    const mod = ctx.createOscillator()
    mod.type = 'sine'
    mod.frequency.value = opts.mod ?? opts.carrier * 2.41
    const modGain = ctx.createGain()
    modGain.gain.setValueAtTime(opts.carrier * (opts.index ?? 3), t0)
    modGain.gain.exponentialRampToValueAtTime(opts.carrier * 0.02, t0 + dur * 0.7)
    mod.connect(modGain)
    modGain.connect(car.frequency)

    const g = ctx.createGain()
    const peak = opts.gain ?? 0.22
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)

    car.connect(g)
    g.connect(this.master!)
    if (this.wet) {
      const s = ctx.createGain()
      s.gain.value = opts.send ?? 0.6
      g.connect(s)
      s.connect(this.wet)
    }
    car.start(t0)
    mod.start(t0)
    car.stop(t0 + dur + 0.05)
    mod.stop(t0 + dur + 0.05)
  }

  private noise(opts: {
    dur?: number
    gain?: number
    type?: BiquadFilterType
    from?: number
    to?: number
    q?: number
    delay?: number
    send?: number
    attack?: number
  }): void {
    const ctx = this.ensure()
    const t0 = ctx.currentTime + (opts.delay ?? 0)
    const dur = opts.dur ?? 0.3
    const len = Math.ceil(ctx.sampleRate * dur)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buf

    const flt = ctx.createBiquadFilter()
    flt.type = opts.type ?? 'bandpass'
    flt.frequency.setValueAtTime(opts.from ?? 1200, t0)
    if (opts.to !== undefined) flt.frequency.exponentialRampToValueAtTime(Math.max(30, opts.to), t0 + dur)
    flt.Q.value = opts.q ?? 1.1

    const g = ctx.createGain()
    const peak = opts.gain ?? 0.18
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(peak, t0 + (opts.attack ?? 0.005))
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)

    src.connect(flt)
    flt.connect(g)
    g.connect(this.master!)
    if (this.wet && opts.send !== 0) {
      const s = ctx.createGain()
      s.gain.value = opts.send ?? 0.4
      g.connect(s)
      s.connect(this.wet)
    }
    src.start(t0)
    src.stop(t0 + dur + 0.05)
  }

  /** 音高从一个音阶里取，保证不刺耳 */
  private scale(i: number, scale: number[] = PENTA, base = 220): number {
    const oct = Math.floor(i / scale.length)
    const idx = ((i % scale.length) + scale.length) % scale.length
    return base * Math.pow(2, oct + scale[idx] / 12)
  }

  /* ─────────── 游戏音效 ─────────── */

  playCard(arch: string, syms: number): void {
    const base = arch === 'rift' ? 196 : arch === 'loop' ? 233 : arch === 'reso' ? 261 : 220
    this.noise({ dur: 0.22, gain: 0.07, type: 'highpass', from: 2600, to: 500, q: 0.7, send: 0.25 })
    for (let i = 0; i < Math.min(syms, 3); i++) {
      const n = this.note(PENTA[(i * 2) % PENTA.length], base)
      this.tone({ freq: n * 2, dur: 0.34, gain: 0.075, type: 'triangle', delay: i * 0.035, send: 0.5 })
    }
    this.tone({ freq: base, to: base * 0.5, dur: 0.3, gain: 0.06, type: 'sine', send: 0.4 })
  }

  clash(win: boolean, tie: boolean, power: number): void {
    const p = Math.min(Math.max(power, 1), 12)
    const semis = Math.round((p - 3) * 1.4)
    const f = this.scale(semis, MINOR, 180)
    this.fm({ carrier: f * 2, mod: f * 5.3, index: 4.5, dur: 0.55, gain: 0.2, send: 0.75 })
    this.noise({ dur: 0.16, gain: 0.16, type: 'bandpass', from: 3400 + p * 120, to: 420, q: 0.9 })
    if (win) {
      this.tone({ freq: f * 4, dur: 0.4, gain: 0.1, type: 'triangle', delay: 0.02, send: 0.7 })
      this.tone({ freq: f * 6, dur: 0.5, gain: 0.05, type: 'sine', delay: 0.06, send: 0.8 })
    } else if (tie) {
      this.tone({ freq: f * 3, to: f * 1.5, dur: 0.42, gain: 0.1, type: 'square', send: 0.6 })
    } else {
      this.tone({ freq: f * 1.5, to: f * 0.75, dur: 0.42, gain: 0.13, type: 'sawtooth', send: 0.5 })
      this.noise({ dur: 0.3, gain: 0.1, type: 'lowpass', from: 800, to: 160, q: 0.6 })
    }
  }

  hit(level = 1): void {
    const l = Math.min(Math.max(level, 0), 4)
    this.tone({ freq: 150 - l * 18, to: 46, dur: 0.3, gain: 0.26, type: 'sine', send: 0.35 })
    this.noise({ dur: 0.16, gain: 0.14, type: 'lowpass', from: 1400, to: 180, q: 0.8 })
  }

  block(): void {
    this.tone({ freq: 1200, to: 900, dur: 0.3, gain: 0.09, type: 'triangle', send: 0.7 })
    this.fm({ carrier: 700, mod: 1900, index: 1.4, dur: 0.42, gain: 0.1, send: 0.8 })
  }

  pierce(): void {
    this.noise({ dur: 0.2, gain: 0.15, type: 'highpass', from: 900, to: 5200, q: 0.8 })
    this.tone({ freq: 900, to: 2400, dur: 0.16, gain: 0.11, type: 'sawtooth', send: 0.5 })
  }

  echo(): void {
    const f = 520
    for (let i = 0; i < 3; i++) {
      this.tone({ freq: f, to: f * 1.5, dur: 0.26, gain: 0.1 - i * 0.025, type: 'triangle', delay: i * 0.11, send: 0.85 })
    }
  }

  cancel(): void {
    this.tone({ freq: 1500, to: 400, dur: 0.2, gain: 0.1, type: 'triangle', send: 0.5 })
  }

  stagger(): void {
    this.fm({ carrier: 110, mod: 87, index: 6, dur: 1.8, gain: 0.26, send: 0.9 })
    this.noise({ dur: 1.1, gain: 0.14, type: 'lowpass', from: 2200, to: 120, q: 0.6, send: 0.7 })
    for (let i = 0; i < 4; i++) {
      this.noise({ dur: 0.12, gain: 0.09, type: 'bandpass', from: 1800 + i * 900, to: 300, q: 2, delay: 0.05 + i * 0.07 })
    }
  }

  energy(): void {
    for (let i = 0; i < 3; i++) {
      this.tone({ freq: this.scale(i * 2, PENTA, 523), dur: 0.4, gain: 0.08, type: 'sine', delay: i * 0.05, send: 0.8 })
    }
  }

  heal(): void {
    for (let i = 0; i < 4; i++) {
      this.tone({ freq: this.scale(i, MINOR, 440), dur: 0.6, gain: 0.07, type: 'sine', delay: i * 0.07, send: 0.9 })
    }
  }

  draw(): void {
    this.noise({ dur: 0.13, gain: 0.06, type: 'highpass', from: 1800, to: 3000, q: 0.6, send: 0.25 })
  }

  ui(kind: 'hover' | 'click' | 'back' | 'travel' | 'shred'): void {
    const now = performance.now()
    if (kind === 'hover' && now - this.lastAt < 40) return
    this.lastAt = now
    switch (kind) {
      case 'hover':
        this.tone({ freq: 1180, dur: 0.07, gain: 0.028, type: 'sine', send: 0.4 })
        break
      case 'click':
        this.tone({ freq: 760, to: 1140, dur: 0.1, gain: 0.07, type: 'triangle', send: 0.5 })
        break
      case 'back':
        this.tone({ freq: 520, to: 300, dur: 0.16, gain: 0.07, type: 'triangle', send: 0.5 })
        break
      case 'travel':
        this.noise({ dur: 0.5, gain: 0.08, type: 'bandpass', from: 300, to: 2400, q: 1.4, send: 0.7 })
        this.tone({ freq: 220, to: 440, dur: 0.5, gain: 0.07, type: 'sine', send: 0.7 })
        break
      case 'shred':
        this.noise({ dur: 0.45, gain: 0.13, type: 'highpass', from: 3000, to: 500, q: 0.7, send: 0.5 })
        break
    }
  }

  deny(): void {
    this.tone({ freq: 190, to: 130, dur: 0.2, gain: 0.14, type: 'square', send: 0.3 })
  }

  cardGet(): void {
    ;[0, 2, 4].forEach((s, i) =>
      this.tone({ freq: this.scale(s, PENTA, 392), dur: 0.5, gain: 0.09, type: 'triangle', delay: i * 0.06, send: 0.8 }),
    )
  }

  relic(): void {
    ;[0, 4, 7, 12].forEach((s, i) =>
      this.fm({ carrier: this.note(s, 330), mod: this.note(s, 330) * 3.1, index: 2.2, dur: 0.9, gain: 0.11, delay: i * 0.09, send: 0.9 }),
    )
  }

  treasure(): void {
    this.noise({ dur: 0.7, gain: 0.12, type: 'bandpass', from: 600, to: 4200, q: 1.2, send: 0.8 })
    ;[0, 3, 7, 10, 12].forEach((s, i) =>
      this.tone({ freq: this.note(s, 440), dur: 0.7, gain: 0.085, type: 'sine', delay: i * 0.06, send: 0.9 }),
    )
  }

  purchase(): void {
    this.tone({ freq: 1400, dur: 0.12, gain: 0.08, type: 'triangle', send: 0.5 })
    this.tone({ freq: 2100, dur: 0.22, gain: 0.07, type: 'sine', delay: 0.07, send: 0.7 })
  }

  battleStart(): void {
    this.fm({ carrier: 82, mod: 123, index: 5, dur: 2.2, gain: 0.24, send: 0.9 })
    this.noise({ dur: 1.4, gain: 0.1, type: 'lowpass', from: 500, to: 2600, q: 0.8, send: 0.8 })
    for (let i = 0; i < 3; i++) {
      this.noise({ dur: 0.4, gain: 0.07, type: 'bandpass', from: 400 + i * 300, to: 2600, q: 2.4, delay: i * 0.14 })
    }
  }

  victory(): void {
    const seq = [0, 4, 7, 12, 16]
    seq.forEach((s, i) => {
      this.tone({ freq: this.note(s, 262), dur: 1.1, gain: 0.11, type: 'triangle', delay: i * 0.1, send: 0.9 })
      this.fm({ carrier: this.note(s, 524), mod: this.note(s, 524) * 2.8, index: 1.6, dur: 0.8, gain: 0.06, delay: i * 0.1, send: 0.85 })
    })
  }

  defeat(): void {
    const seq = [7, 3, 0, -5]
    seq.forEach((s, i) => {
      this.tone({ freq: this.note(s, 196), to: this.note(s, 196) * 0.97, dur: 1.3, gain: 0.13, type: 'sawtooth', delay: i * 0.22, send: 0.8 })
      this.tone({ freq: this.note(s, 98), dur: 1.4, gain: 0.12, type: 'sine', delay: i * 0.22, send: 0.6 })
    })
    this.noise({ dur: 1.6, gain: 0.09, type: 'lowpass', from: 900, to: 90, q: 0.7, delay: 0.2, send: 0.7 })
  }

  start(): void {
    ;[0, 7, 12].forEach((s, i) =>
      this.tone({ freq: this.note(s, 220), dur: 1.6, gain: 0.08, type: 'sine', delay: i * 0.12, send: 1 }),
    )
  }

  /* ─────────── 环境低鸣 ─────────── */

  droneOn(): void {
    if (this.droneNodes) return
    const ctx = this.ensure()
    const t0 = ctx.currentTime
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(0.05, t0 + 3.5)
    const flt = ctx.createBiquadFilter()
    flt.type = 'lowpass'
    flt.frequency.value = 420
    flt.Q.value = 3
    gain.connect(flt)
    flt.connect(this.master!)
    if (this.wet) {
      const s = ctx.createGain()
      s.gain.value = 0.8
      flt.connect(s)
      s.connect(this.wet)
    }

    const freqs = [55, 82.4, 110, 164.8]
    const oscs: OscillatorNode[] = []
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator()
      o.type = i % 2 === 0 ? 'sine' : 'triangle'
      o.frequency.value = f
      o.detune.value = (i - 1.5) * 7
      const og = ctx.createGain()
      og.gain.value = 0.5 / (i + 1)
      o.connect(og)
      og.connect(gain)
      o.start(t0)
      oscs.push(o)
    })

    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 0.06
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 190
    lfo.connect(lfoGain)
    lfoGain.connect(flt.frequency)
    lfo.start(t0)

    this.droneNodes = { osc: oscs, gain, lfo }
  }

  droneOff(): void {
    const d = this.droneNodes
    if (!d || !this.ctx) return
    this.droneNodes = null
    const t = this.ctx.currentTime
    d.gain.gain.cancelScheduledValues(t)
    d.gain.gain.setValueAtTime(Math.max(d.gain.gain.value, 0.0001), t)
    d.gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.1)
    setTimeout(() => {
      try {
        d.osc.forEach((o) => o.stop())
        d.lfo.stop()
      } catch {
        /* 已停 */
      }
    }, 1500)
  }
}

export const sfx = new Sfx()

let gestureBound = false
export function bindAudioGesture(): void {
  if (gestureBound) return
  gestureBound = true
  const once = () => {
    sfx.unlock()
  }
  window.addEventListener('pointerdown', once, { once: true })
  window.addEventListener('keydown', once, { once: true })
}
