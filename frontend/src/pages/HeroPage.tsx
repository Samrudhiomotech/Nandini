import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'

const NAV_LINKS = ['Gallery', 'Styles', 'API', 'Pricing', 'Blog']
const VIDEO_SRC =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260511_080827_a9e5ad52-b6ee-4e79-b393-d936f179cfd7.mp4'

function LogoMark() {
  return (
    <svg width="44" height="26" viewBox="0 0 44 26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0"  y="3" width="14" height="20" rx="3" fill="#A5672C" />
      <rect x="16" y="3" width="12" height="20" rx="3" fill="#F4EFE2" />
      <rect x="30" y="3" width="14" height="20" rx="3" fill="#2B6459" />
    </svg>
  )
}

export default function HeroPage() {
  const [mounted, setMounted] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const videoBgRef = useRef<HTMLDivElement>(null)
  const displayCanvasRef = useRef<HTMLCanvasElement>(null)
  const [framesReady, setFramesReady] = useState(false)
  const framesRef = useRef<HTMLCanvasElement[]>([])

  // Mount fade-in
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80)
    return () => clearTimeout(t)
  }, [])

  // ── Effect 1: Frame capture (boomerang setup) ─────────────────────────
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let capturing = true
    let lastTime = -1
    const MAX_WIDTH = 960
    const frames: HTMLCanvasElement[] = []
    let rafId = 0

    function captureFrame() {
      if (!capturing) return
      if (video!.readyState < 2) {
        rafId = requestAnimationFrame(captureFrame)
        return
      }
      if (video!.currentTime === lastTime) {
        rafId = requestAnimationFrame(captureFrame)
        return
      }
      lastTime = video!.currentTime
      const scale = Math.min(1, MAX_WIDTH / video!.videoWidth)
      const w = Math.floor(video!.videoWidth * scale)
      const h = Math.floor(video!.videoHeight * scale)
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      c.getContext('2d')!.drawImage(video!, 0, 0, w, h)
      frames.push(c)

      if ((video as any).requestVideoFrameCallback) {
        ;(video as any).requestVideoFrameCallback(captureFrame)
      } else {
        rafId = requestAnimationFrame(captureFrame)
      }
    }

    function onEnded() {
      capturing = false
      framesRef.current = frames
      setFramesReady(true)
    }

    function onLoaded() {
      video!.play().catch(() => {})
      if ((video as any).requestVideoFrameCallback) {
        ;(video as any).requestVideoFrameCallback(captureFrame)
      } else {
        rafId = requestAnimationFrame(captureFrame)
      }
    }

    video.addEventListener('ended', onEnded)
    video.addEventListener('loadedmetadata', onLoaded)

    if (video.readyState >= 1) onLoaded()

    return () => {
      capturing = false
      cancelAnimationFrame(rafId)
      video.removeEventListener('ended', onEnded)
      video.removeEventListener('loadedmetadata', onLoaded)
    }
  }, [])

  // ── Effect 2: Boomerang render ────────────────────────────────────────
  useEffect(() => {
    if (!framesReady) return
    const frames = framesRef.current
    if (!frames.length) return
    const canvas = displayCanvasRef.current
    if (!canvas) return
    canvas.width = frames[0].width
    canvas.height = frames[0].height
    const ctx = canvas.getContext('2d')!

    let index = 0
    let direction = 1
    let last = performance.now()
    const interval = 1000 / 30
    let rafId = 0

    function render(now: number) {
      rafId = requestAnimationFrame(render)
      if (now - last < interval) return
      last = now
      ctx.drawImage(frames[index], 0, 0)
      index += direction
      if (index >= frames.length - 1) { index = frames.length - 1; direction = -1 }
      if (index <= 0) { index = 0; direction = 1 }
    }

    rafId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(rafId)
  }, [framesReady])

  // ── Effect 3: Parallax mouse tracking ────────────────────────────────
  useEffect(() => {
    const strength = 20
    let targetX = 0, targetY = 0
    let currentX = 0, currentY = 0
    let rafId = 0

    function onMove(e: MouseEvent) {
      const cx = window.innerWidth / 2
      const cy = window.innerHeight / 2
      targetX = ((e.clientX - cx) / cx) * strength
      targetY = ((e.clientY - cy) / cy) * strength
    }

    function tick() {
      rafId = requestAnimationFrame(tick)
      currentX += (targetX - currentX) * 0.06
      currentY += (targetY - currentY) * 0.06
      if (videoBgRef.current) {
        gsap.set(videoBgRef.current, { x: currentX, y: currentY })
      }
    }

    window.addEventListener('mousemove', onMove)
    rafId = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(rafId)
    }
  }, [])

  return (
    <div className="min-h-screen bg-ink text-paper font-body overflow-x-hidden">
      {/* ── Video background ───────────────────────────────────────── */}
      <div
        ref={videoBgRef}
        className="fixed top-0 left-0 w-full h-full z-0 scale-[1.08] origin-center"
      >
        <video
          ref={videoRef}
          src={VIDEO_SRC}
          muted
          playsInline
          preload="auto"
          crossOrigin="anonymous"
          className="w-full h-full object-cover"
          style={{ display: framesReady ? 'none' : 'block' }}
        />
        <canvas
          ref={displayCanvasRef}
          className="w-full h-full object-cover"
          style={{ display: framesReady ? 'block' : 'none' }}
        />
      </div>

      {/* ── Dark overlay ──────────────────────────────────────────── */}
      <div className="fixed inset-0 z-0 bg-black/45" />

      {/* ── Hero title ────────────────────────────────────────────── */}
      <div
        className={`fixed left-0 right-0 z-20 w-full px-4 transition-all duration-1000 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
        style={{ top: '126px' }}
      >
        <h1 className="hero-title select-none">ACA Platform</h1>
      </div>

      {/* ── Nav ───────────────────────────────────────────────────── */}
      <nav className="fixed top-5 left-1/2 -translate-x-1/2 z-50 whitespace-nowrap">
        <div className="liquid-glass flex items-center gap-6 rounded-full px-5 py-3">
          <LogoMark />
          <div className="flex items-center gap-5">
            {NAV_LINKS.map(link => (
              <a
                key={link}
                href="#"
                className="text-base font-body font-medium text-ink-70 transition-colors duration-200"
              >
                {link}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3 ml-4">
            <a
              href="#"
              className="text-base font-body font-medium text-ink-70 transition-colors duration-200"
            >
              Sign in
            </a>
            <a
              href="/experiment"
              className="liquid-glass-strong text-base font-body font-semibold rounded-full px-5 py-2 transition-all duration-200 hover:scale-[1.04] active:scale-[0.97]"
            >
              Try it free
            </a>
          </div>
        </div>
      </nav>

      {/* ── Bottom row ────────────────────────────────────────────── */}
      <div
        className={`fixed bottom-12 left-0 right-0 px-10 flex items-end justify-between z-20 transition-all duration-1000 delay-300 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
      >
        {/* Left */}
        <p className="text-base font-body font-normal text-paper-80 max-w-[240px] leading-relaxed">
          Predicts your optimal choice-set size using behavioral decision science.
        </p>

        {/* Center */}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-0 flex items-center gap-3">
          <a
            href="/experiment"
            className="cta-brass group relative text-base font-body font-semibold rounded-full px-7 py-3.5 overflow-hidden active:scale-[0.97] transition-all duration-200 shadow-[0_4px_20px_rgba(165,103,44,0.35)] hover:scale-[1.03]"
          >
            <span className="relative z-10">Start experiment</span>
          </a>
          <a
            href="/admin"
            className="liquid-glass group text-base font-body font-semibold rounded-full px-7 py-3.5 active:scale-[0.97] transition-all duration-200 hover:scale-[1.03]"
          >
            Admin dashboard
          </a>
        </div>

        {/* Right */}
        <p className="text-base font-body font-normal text-paper-80 max-w-[240px] leading-relaxed text-right">
          Describe what you see in your head — get images that actually match.
        </p>
      </div>
    </div>
  )
}
