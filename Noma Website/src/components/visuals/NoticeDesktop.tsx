import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion'
import { SiApple } from 'react-icons/si'
import ProductNotice, { type ProductNoticeStep } from './ProductNotice'

/**
 * A real-looking Mac desktop with Noma's workflow notice arriving in the
 * corner, the way it actually does (spacefs.com-style: real windows drawn in
 * HTML, not an illustration). VS Code and a Terminal running Claude Code are
 * open; the notice slides in bottom-right without taking focus, stays about
 * as long as the app keeps it (6 s), leaves, and comes back.
 *
 * Drawn at a fixed 960x600 "screen" and scaled to fit, so it looks the same
 * at every width, like a screenshot would, while staying sharp.
 */

const SCREEN_W = 960
const SCREEN_H = 600
/** The app's own AUTO_DISMISS_MS. */
const SHOWN_MS = 6000
const HIDDEN_MS = 2600

const STEPS: ProductNoticeStep[] = [
  { kind: 'action', label: 'Screenshot' },
  { kind: 'app', label: 'Claude', appId: 'claude', color: '#d97757', action: 'Paste' },
  { kind: 'action', label: 'Enter' },
]

const MENU = ['Code', 'File', 'Edit', 'Selection', 'View', 'Go', 'Run', 'Terminal', 'Window', 'Help']

function TrafficLights() {
  return (
    <div className="flex items-center gap-[7px]">
      <span className="h-[11px] w-[11px] rounded-full bg-[#ff5f57]" />
      <span className="h-[11px] w-[11px] rounded-full bg-[#febc2e]" />
      <span className="h-[11px] w-[11px] rounded-full bg-[#28c840]" />
    </div>
  )
}

/** One line of syntax-coloured code. Each part is [text, colour]. */
type Token = [string, string]
const K = '#c586c0' // keyword
const F = '#dcdcaa' // function
const S = '#ce9178' // string
const V = '#9cdcfe' // variable
const T = '#4ec9b0' // type / component
const P = '#d4d4d4' // punctuation / plain
const C = '#6a9955' // comment
const CODE: Token[][] = [
  [['import', K], [' { ', P], ['useState', V], [' } ', P], ['from', K], [" 'react'", S]],
  [['import', K], [' { ', P], ['Toolbar', T], [' } ', P], ['from', K], [" './Toolbar'", S]],
  [],
  [['// Overflow on narrow windows, see screenshot', C]],
  [['export', K], [' ', P], ['function', K], [' ', P], ['Header', F], ['() {', P]],
  [['  ', P], ['const', K], [' [', P], ['open', V], [', ', P], ['setOpen', F], ['] = ', P], ['useState', F], ['(', P], ['false', K], [')', P]],
  [],
  [['  ', P], ['return', K], [' (', P]],
  [['    <', P], ['header', K], [' ', P], ['className', V], ['=', P], ['"flex items-center gap-4 px-6"', S], ['>', P]],
  [['      <', P], ['Toolbar', T], [' ', P], ['compact', V], ['={', P], ['open', V], ['} />', P]],
  [['      <', P], ['nav', K], [' ', P], ['className', V], ['=', P], ['"min-w-0 overflow-x-auto"', S], ['>', P]],
  [['        {', P], ['links', V], ['.', P], ['map', F], ['(', P], ['renderLink', F], [')}', P]],
  [['      </', P], ['nav', K], ['>', P]],
  [['    </', P], ['header', K], ['>', P]],
  [['  )', P]],
  [['}', P]],
]

function VSCodeWindow() {
  return (
    <div className="absolute left-[34px] top-[52px] flex h-[430px] w-[650px] flex-col overflow-hidden rounded-[10px] border border-white/10 bg-[#1e1e1e] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.75)]">
      <div className="relative flex h-[30px] shrink-0 items-center border-b border-black/40 bg-[#2b2b2b] px-3">
        <TrafficLights />
        <span className="absolute inset-x-0 text-center text-[11px] text-[#cccccc]">Header.tsx — web-app</span>
      </div>
      <div className="flex min-h-0 flex-1">
        {/* Activity bar */}
        <div className="flex w-[40px] shrink-0 flex-col items-center gap-[14px] bg-[#2c2c2c] pt-3">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`h-[18px] w-[18px] rounded-[3px] border-[1.5px] ${i === 0 ? 'border-[#d7d7d7]' : 'border-[#858585]'}`} />
          ))}
        </div>
        {/* Explorer */}
        <div className="w-[160px] shrink-0 bg-[#252526] px-2 py-2 text-[11px] text-[#cccccc]">
          <p className="mb-1.5 px-1 text-[10px] font-semibold tracking-wide text-[#bbbbbb]">EXPLORER</p>
          {[
            ['▾ src', 0],
            ['▾ components', 1],
            ['Header.tsx', 2, true],
            ['Toolbar.tsx', 2],
            ['Sidebar.tsx', 2],
            ['▸ pages', 1],
            ['App.tsx', 1],
            ['main.tsx', 1],
            ['package.json', 0],
          ].map(([name, depth, active]) => (
            <p
              key={name as string}
              className={`truncate rounded-sm py-[2px] ${active ? 'bg-[#37373d] text-white' : ''}`}
              style={{ paddingLeft: 4 + (depth as number) * 10 }}
            >
              {name}
            </p>
          ))}
        </div>
        {/* Editor */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-[28px] shrink-0 bg-[#252526] text-[11px]">
            <span className="flex items-center border-t border-[#0078d4] bg-[#1e1e1e] px-3 text-white">Header.tsx</span>
            <span className="flex items-center px-3 text-[#969696]">Toolbar.tsx</span>
          </div>
          <div className="flex-1 overflow-hidden py-2 font-mono text-[11px] leading-[19px]">
            {CODE.map((line, index) => (
              <div key={index} className={`flex ${index === 10 ? 'bg-white/[0.04]' : ''}`}>
                <span className="w-[38px] shrink-0 pr-3 text-right text-[#6e7681]">{index + 1}</span>
                <span className="whitespace-pre">
                  {line.map(([text, color], part) => (
                    <span key={part} style={{ color }}>
                      {text}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex h-[20px] shrink-0 items-center gap-4 bg-[#007acc] px-3 text-[10px] text-white">
        <span>main</span>
        <span>0 problems</span>
        <span className="ml-auto">TypeScript JSX</span>
      </div>
    </div>
  )
}

function TerminalWindow() {
  return (
    <div className="absolute left-[452px] top-[196px] flex h-[300px] w-[470px] flex-col overflow-hidden rounded-[10px] border border-white/10 bg-[#141414]/[0.97] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.85)]">
      <div className="relative flex h-[28px] shrink-0 items-center border-b border-black/50 bg-[#262626] px-3">
        <TrafficLights />
        <span className="absolute inset-x-0 text-center text-[11px] text-[#bdbdbd]">web-app — claude — 80×24</span>
      </div>
      <div className="flex-1 px-4 py-3 font-mono text-[11px] leading-[18px] text-[#d6d6d6]">
        <div className="rounded-md border border-[#d97757]/70 px-3 py-2">
          <p>
            <span className="text-[#d97757]">✻</span> Welcome to <span className="font-semibold text-white">Claude Code</span>
          </p>
          <p className="text-[#8a8a8a]">  cwd: ~/projects/web-app</p>
        </div>
        <p className="mt-3">
          <span className="text-[#8a8a8a]">&gt;</span> [Image #1] the nav overflows on narrow windows, fix it
        </p>
        <p className="mt-2">
          <span className="text-[#d97757]">⏺</span> Reading <span className="text-white">src/components/Header.tsx</span>
        </p>
        <p>
          <span className="text-[#d97757]">⏺</span> The nav needs <span className="text-[#9cdcfe]">min-w-0</span> so it can shrink
        </p>
        <p className="text-[#8a8a8a]">  inside the flex row. Updating Header.tsx…</p>
        <div className="mt-3 rounded-md border border-[#3a3a3a] px-2 py-1">
          <span className="text-[#8a8a8a]">&gt;</span> <span className="inline-block h-[13px] w-[7px] translate-y-[2px] bg-[#d6d6d6]" />
        </div>
        <p className="mt-1 text-[10px] text-[#6a6a6a]">  ? for shortcuts</p>
      </div>
    </div>
  )
}

export default function NoticeDesktop({ className = '' }: { className?: string }) {
  const frame = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)
  const reduceMotion = useReducedMotion()
  const inView = useInView(frame, { margin: '-15% 0px' })
  const [shown, setShown] = useState(false)

  useLayoutEffect(() => {
    const element = frame.current
    if (!element) return
    const update = () => setScale(element.clientWidth / SCREEN_W)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // Arrives a moment after the desktop scrolls into view, stays as long as
  // the real one does, leaves, and comes back while it's on screen.
  useEffect(() => {
    if (reduceMotion) return void setShown(true)
    if (!inView) return void setShown(false)
    let timer = setTimeout(function cycle() {
      setShown(true)
      timer = setTimeout(() => {
        setShown(false)
        timer = setTimeout(cycle, HIDDEN_MS)
      }, SHOWN_MS)
    }, 900)
    return () => clearTimeout(timer)
  }, [inView, reduceMotion])

  // On a phone the screen shrinks to about a third, which would leave the
  // notice's text a few pixels tall. There it is drawn at a readable size
  // instead, overlapping the shrunken desktop's corner.
  const compact = scale > 0 && scale < 0.6

  const notice = (
    <AnimatePresence>
      {shown && (
        <motion.div
          className={compact ? 'absolute -bottom-6 right-2 origin-bottom-right scale-[0.82]' : 'absolute bottom-[20px] right-[20px]'}
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          // The app's own enter/exit: 280 ms in, 200 ms out.
          transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
        >
          <ProductNotice steps={STEPS} occurrences={4} />
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <div
      ref={frame}
      className={`relative w-full ${className}`}
      style={{ height: SCREEN_H * scale, marginBottom: compact ? 24 : undefined }}
    >
      <div
        className="absolute left-0 top-0 overflow-hidden rounded-[14px] border border-white/10 shadow-[0_40px_100px_-40px_rgba(0,0,0,0.9)]"
        style={{
          width: SCREEN_W,
          height: SCREEN_H,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          visibility: scale ? 'visible' : 'hidden',
          background:
            'radial-gradient(ellipse 80% 70% at 70% 20%, #1c2742 0%, transparent 60%), radial-gradient(ellipse 70% 60% at 15% 90%, #1a1630 0%, transparent 60%), #0c0e14',
        }}
      >
        {/* macOS menu bar */}
        <div className="flex h-[26px] items-center gap-[18px] bg-black/35 px-4 text-[12px] text-white/90 backdrop-blur-xl">
          <SiApple className="h-[13px] w-[13px]" />
          {MENU.map((item, index) => (
            <span key={item} className={index === 0 ? 'font-semibold' : 'text-white/85'}>
              {item}
            </span>
          ))}
          <span className="ml-auto text-white/85">Mon 9:21 AM</span>
        </div>

        <VSCodeWindow />
        <TerminalWindow />

        {!compact && notice}
      </div>
      {compact && notice}
    </div>
  )
}
