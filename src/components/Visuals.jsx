import { useEffect, useRef } from 'react'

export function Aurora({ live }) {
  return (
    <div className={`aurora${live ? ' live' : ''}`} aria-hidden>
      <div className="blob b1" />
      <div className="blob b2" />
      <div className="blob b3" />
      <div className="vignette" />
      <div className="grain" />
    </div>
  )
}

/**
 * Mirrored bar waveform drawn from the analyser. When there is no analyser
 * (idle), it breathes gently. Writes the current loudness to `--lvl` on
 * `levelTarget` so the orb can pulse without React re-renders.
 */
export function Waveform({ analyserRef, active, levelTarget }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let raf
    let t = 0
    const BARS = 46
    const smooth = new Float32Array(BARS)
    let buf

    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (w < 40 || h < 4) {
        raf = requestAnimationFrame(draw)
        return
      }
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr
        canvas.height = h * dpr
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const an = analyserRef?.current
      let level = 0
      if (an && active) {
        if (!buf || buf.length !== an.frequencyBinCount) buf = new Uint8Array(an.frequencyBinCount)
        an.getByteFrequencyData(buf)
        // Voice lives in the lower bins; spread them across the bars.
        const usable = Math.floor(buf.length * 0.45)
        for (let i = 0; i < BARS; i++) {
          const mid = Math.abs(i - (BARS - 1) / 2) / ((BARS - 1) / 2) // 0 at centre, 1 at edges
          const bin = Math.floor(mid * usable)
          const v = buf[bin] / 255
          smooth[i] += (v * (1 - mid * 0.35) - smooth[i]) * 0.35
          level += smooth[i]
        }
        level /= BARS
      } else {
        t += 0.03
        for (let i = 0; i < BARS; i++) {
          const target = 0.06 + 0.05 * Math.sin(t + i * 0.35) * Math.sin(t * 0.6 + i * 0.12)
          smooth[i] += (target - smooth[i]) * 0.08
        }
      }

      if (levelTarget?.current) levelTarget.current.style.setProperty('--lvl', Math.min(1, level * 2.2).toFixed(3))

      const grad = ctx.createLinearGradient(0, 0, w, 0)
      grad.addColorStop(0, '#67e8f9')
      grad.addColorStop(0.5, '#a78bfa')
      grad.addColorStop(1, '#f0abfc')
      ctx.fillStyle = grad
      const gap = 3
      const bw = (w - gap * (BARS - 1)) / BARS
      for (let i = 0; i < BARS; i++) {
        const bh = Math.max(3, Math.min(h, smooth[i] * h * 1.6))
        const x = i * (bw + gap)
        const y = (h - bh) / 2
        ctx.globalAlpha = 0.45 + Math.min(0.55, smooth[i] * 1.4)
        ctx.beginPath()
        ctx.roundRect ? ctx.roundRect(x, y, bw, bh, Math.max(0, Math.min(bw, bh) / 2)) : ctx.rect(x, y, bw, bh)
        ctx.fill()
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [analyserRef, active, levelTarget])

  return <canvas ref={canvasRef} className="wave" aria-hidden />
}

/** Small canvas confetti burst. */
export function Confetti({ fire }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!fire) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const c = ref.current
    const ctx = c.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    c.width = innerWidth * dpr
    c.height = innerHeight * dpr
    ctx.scale(dpr, dpr)
    const colors = ['#67e8f9', '#a78bfa', '#f0abfc', '#fcd34d', '#6ee7b7']
    const parts = Array.from({ length: 140 }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 120,
      y: innerHeight * 0.45,
      vx: (Math.random() - 0.5) * 16,
      vy: -Math.random() * 15 - 5,
      r: Math.random() * 6 + 3,
      rot: Math.random() * 6,
      vr: (Math.random() - 0.5) * 0.4,
      c: colors[(Math.random() * colors.length) | 0],
      shape: Math.random() > 0.5,
    }))
    let raf
    let frames = 0
    const tick = () => {
      ctx.clearRect(0, 0, innerWidth, innerHeight)
      for (const p of parts) {
        p.vy += 0.38
        p.vx *= 0.985
        p.x += p.vx
        p.y += p.vy
        p.rot += p.vr
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.globalAlpha = Math.max(0, 1 - frames / 150)
        ctx.fillStyle = p.c
        if (p.shape) ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2)
        else {
          ctx.beginPath()
          ctx.arc(0, 0, p.r / 2.4, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      }
      if (++frames < 150) raf = requestAnimationFrame(tick)
      else ctx.clearRect(0, 0, innerWidth, innerHeight)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [fire])
  return <canvas ref={ref} className="confetti" aria-hidden />
}

export function SparkRing({ value, hue }) {
  const r = 16
  const c = 2 * Math.PI * r
  return (
    <div className="spark" title={`Spark score ${value}/100`}>
      <svg width="38" height="38" viewBox="0 0 38 38">
        <circle cx="19" cy="19" r={r} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="3" />
        <circle
          cx="19"
          cy="19"
          r={r}
          fill="none"
          stroke={`hsl(${hue} 95% 72%)`}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.34,1.56,.64,1)' }}
        />
      </svg>
      <span>{value}</span>
    </div>
  )
}
