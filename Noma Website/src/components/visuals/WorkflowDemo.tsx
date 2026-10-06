import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion'
import { SiApple } from 'react-icons/si'
import ProductNotice, { type ProductNoticeStep } from './ProductNotice'
import AppIcon from './AppIcon'
import { appProfiles } from '../../data/appProfiles'

/**
 * Flow, demonstrated on a real-looking desktop (2026-10-06 redesign; grew out
 * of the earlier NoticeDesktop). Someone fixes a bug the way they always do:
 * screenshot it in VS Code, paste it into Claude, commit in GitHub Desktop.
 * The window in front and the keys pressed are shown as they happen (a
 * keycast, the usual screen-recording convention, not Noma UI). On the third
 * run, Noma's notice arrives in the corner, drawn exactly as the app draws it
 * (ProductNotice.tsx) and at the app's own threshold of three.
 *
 * Every step is one Flow really records: a shortcut with Ctrl, Alt or the
 * Windows key, or an app switch. A bare Enter is never recorded, which is
 * why the commit is Ctrl+Enter (GitHub Desktop's own commit shortcut).
 *
 * Drawn at a fixed 960x600 "screen" and scaled to fit, so it looks the same
 * at every width, like a screenshot would, while staying sharp.
 */

const SCREEN_W = 960
const SCREEN_H = 600

type WindowId = 'code' | 'terminal' | 'github'

const STEPS: { window: WindowId; appId: string; menu: string; keys: string; label: string }[] = [
  { window: 'code', appId: 'vscode', menu: 'Code', keys: 'Win + Shift + S', label: 'Screenshot' },
  { window: 'terminal', appId: 'claude', menu: 'Terminal', keys: 'Ctrl + V', label: 'Paste' },
  { window: 'github', appId: 'github', menu: 'GitHub Desktop', keys: 'Ctrl + Enter', label: 'Commit' },
]

const NOTICE_STEPS: ProductNoticeStep[] = [
  { kind: 'action', label: 'Screenshot' },
  { kind: 'app', label: 'Claude', appId: 'claude', color: '#d97757', action: 'Paste' },
  { kind: 'app', label: 'GitHub', appId: 'github', color: '#f0f0f0', action: 'Commit' },
]

/** The app's own WORKFLOW_NOTIFICATION_THRESHOLD. */
const RUNS = 3

interface Frame {
  run: number
  step: number | null
  notice: boolean
  ms: number
}

/** The whole loop: three runs (the first slower, so it can be read), then
 *  the notice for about as long as the app keeps it up. */
const TIMELINE: Frame[] = (() => {
  const frames: Frame[] = [{ run: 0, step: null, notice: false, ms: 700 }]
  for (let run = 1; run <= RUNS; run++) {
    STEPS.forEach((_, step) => frames.push({ run, step, notice: false, ms: run === 1 ? 1300 : 750 }))
    frames.push({ run, step: null, notice: false, ms: run === RUNS ? 350 : 600 })
  }
  frames.push({ run: RUNS, step: null, notice: true, ms: 6000 })
  return frames
})()

const FINAL: Frame = { run: RUNS, step: null, notice: true, ms: 0 }

function TrafficLights() {
  return (
    <div className="flex items-center gap-[7px]">
      <span className="h-[11px] w-[11px] rounded-full bg-[#ff5f57]" />
      <span className="h-[11px] w-[11px] rounded-full bg-[#febc2e]" />
      <span className="h-[11px] w-[11px] rounded-full bg-[#28c840]" />
    </div>
  )
}

/** A window that dims when it isn't the one in front. */
function Win({ focused, z, className, children }: { focused: boolean; z: number; className: string; children: ReactNode }) {
  return (
    <div
      className={`absolute flex flex-col overflow-hidden rounded-[10px] border border-white/10 transition-[filter] duration-300 ${className}`}
      style={{ zIndex: focused ? 30 : z, filter: focused ? 'none' : 'brightness(0.62)' }}
    >
      {children}
    </div>
  )
}

/** One line of syntax-coloured code. Each part is [text, colour]. */
type Token = [string, string]
const K = '#c586c0'
const F = '#dcdcaa'
const S = '#ce9178'
const V = '#9cdcfe'
const T = '#4ec9b0'
const P = '#d4d4d4'
const C = '#6a9955'
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

function VSCodeWindow({ focused }: { focused: boolean }) {
  return (
    <Win focused={focused} z={10} className="left-[34px] top-[52px] h-[430px] w-[650px] bg-[#1e1e1e] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.75)]">
      <div className="relative flex h-[30px] shrink-0 items-center border-b border-black/40 bg-[#2b2b2b] px-3">
        <TrafficLights />
        <span className="absolute inset-x-0 text-center text-[11px] text-[#cccccc]">Header.tsx · web-app</span>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="flex w-[40px] shrink-0 flex-col items-center gap-[14px] bg-[#2c2c2c] pt-3">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`h-[18px] w-[18px] rounded-[3px] border-[1.5px] ${i === 0 ? 'border-[#d7d7d7]' : 'border-[#858585]'}`} />
          ))}
        </div>
        <div className="w-[160px] shrink-0 bg-[#252526] px-2 py-2 text-[11px] text-[#cccccc]">
          <p className="mb-1.5 px-1 text-[10px] font-semibold tracking-wide text-[#bbbbbb]">EXPLORER</p>
          {(
            [
              ['▾ src', 0],
              ['▾ components', 1],
              ['Header.tsx', 2, true],
              ['Toolbar.tsx', 2],
              ['Sidebar.tsx', 2],
              ['▸ pages', 1],
              ['App.tsx', 1],
              ['main.tsx', 1],
              ['package.json', 0],
            ] as [string, number, boolean?][]
          ).map(([name, depth, active]) => (
            <p key={name} className={`truncate rounded-sm py-[2px] ${active ? 'bg-[#37373d] text-white' : ''}`} style={{ paddingLeft: 4 + depth * 10 }}>
              {name}
            </p>
          ))}
        </div>
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
    </Win>
  )
}

function TerminalWindow({ focused }: { focused: boolean }) {
  return (
    <Win focused={focused} z={12} className="left-[430px] top-[226px] h-[300px] w-[470px] bg-[#141414] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.85)]">
      <div className="relative flex h-[28px] shrink-0 items-center border-b border-black/50 bg-[#262626] px-3">
        <TrafficLights />
        <span className="absolute inset-x-0 text-center text-[11px] text-[#bdbdbd]">web-app · claude · 80×24</span>
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
        <p className="text-[#8a8a8a]">  inside the flex row. Updated Header.tsx.</p>
        <div className="mt-3 rounded-md border border-[#3a3a3a] px-2 py-1">
          <span className="text-[#8a8a8a]">&gt;</span> <span className="inline-block h-[13px] w-[7px] translate-y-[2px] bg-[#d6d6d6]" />
        </div>
      </div>
    </Win>
  )
}

function GitHubWindow({ focused }: { focused: boolean }) {
  return (
    <Win focused={focused} z={11} className="left-[560px] top-[70px] h-[270px] w-[370px] bg-[#24292f] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.8)]">
      <div className="relative flex h-[28px] shrink-0 items-center border-b border-black/50 bg-[#1f2328] px-3">
        <TrafficLights />
        <span className="absolute inset-x-0 text-center text-[11px] text-[#c9d1d9]">GitHub Desktop</span>
      </div>
      <div className="flex h-[34px] shrink-0 items-center gap-4 border-b border-black/40 bg-[#24292f] px-3 text-[10px] text-[#8b949e]">
        <span>
          Current repository <span className="ml-1 font-semibold text-[#f0f6fc]">web-app</span>
        </span>
        <span>
          Branch <span className="ml-1 font-semibold text-[#f0f6fc]">main</span>
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col bg-[#0d1117] text-[11px] text-[#c9d1d9]">
        <div className="flex border-b border-[#30363d] text-[10px]">
          <span className="border-b-2 border-[#f78166] px-3 py-1.5 font-semibold text-[#f0f6fc]">Changes 1</span>
          <span className="px-3 py-1.5 text-[#8b949e]">History</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2">
          <span className="flex h-[12px] w-[12px] items-center justify-center rounded-[3px] bg-[#2f81f7] text-[8px] text-white">✓</span>
          <span className="truncate">src/components/Header.tsx</span>
          <span className="ml-auto h-[10px] w-[10px] rounded-[2px] border border-[#d29922]" />
        </div>
        <div className="mt-auto border-t border-[#30363d] p-3">
          <div className="rounded-md border border-[#30363d] bg-[#010409] px-2 py-1.5 text-[#f0f6fc]">Fix nav overflow on narrow windows</div>
          <div className="mt-2 rounded-md bg-[#2f81f7] py-1.5 text-center text-[11px] font-semibold text-white">Commit to main</div>
        </div>
      </div>
    </Win>
  )
}

/** The keys being pressed, the way a screen recording shows them. */
function Keycast({ frame }: { frame: Frame }) {
  const step = frame.step === null ? null : STEPS[frame.step]
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/70 px-3 py-2 backdrop-blur-md">
      <AnimatePresence mode="wait" initial={false}>
        {step ? (
          <motion.div
            key={`${frame.run}-${frame.step}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="flex items-center gap-2.5"
          >
            <AppIcon id={step.appId} color={appProfiles[step.appId]?.color} className="h-[15px] w-[15px]" />
            <span className="rounded-md border border-white/15 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px] text-white">{step.keys}</span>
            <span className="text-[12px] text-white/70">{step.label}</span>
          </motion.div>
        ) : (
          <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[12px] text-white/45">
            {frame.notice ? 'Noma noticed' : 'Working…'}
          </motion.span>
        )}
      </AnimatePresence>
      <span className="ml-1 border-l border-white/10 pl-3 font-mono text-[11px] text-white/50">
        {frame.run > 0 ? `${frame.run}×` : '0×'}
      </span>
    </div>
  )
}

export default function WorkflowDemo({ className = '' }: { className?: string }) {
  const stage = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)
  const reduceMotion = useReducedMotion()
  const inView = useInView(stage, { margin: '-10% 0px' })
  const [index, setIndex] = useState(0)

  useLayoutEffect(() => {
    const element = stage.current
    if (!element) return
    const update = () => setScale(element.clientWidth / SCREEN_W)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // Plays while on screen; starts over each time it comes back into view.
  useEffect(() => {
    if (reduceMotion || !inView) return
    let current = 0
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      setIndex(current)
      timer = setTimeout(() => {
        current = (current + 1) % TIMELINE.length
        tick()
      }, TIMELINE[current].ms)
    }
    tick()
    return () => clearTimeout(timer)
  }, [inView, reduceMotion])

  const frame = reduceMotion ? FINAL : TIMELINE[index]
  const focusedWindow: WindowId = frame.step === null ? (frame.run === 0 ? 'code' : 'github') : STEPS[frame.step].window
  const menu = STEPS.find((step) => step.window === focusedWindow)?.menu ?? 'Code'

  // On a phone the screen shrinks to about a third, which would leave the
  // keycast and the notice a few pixels tall. There they're drawn at a
  // readable size below the screen instead.
  const compact = scale > 0 && scale < 0.6

  const notice = (
    <AnimatePresence>
      {frame.notice && (
        <motion.div
          className={compact ? 'flex justify-center' : 'absolute bottom-[20px] right-[20px] z-40'}
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          // The app's own enter/exit: 280 ms in, 200 ms out.
          transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
        >
          <ProductNotice steps={NOTICE_STEPS} occurrences={RUNS} />
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <div className={className}>
      <div ref={stage} className="relative w-full" style={{ height: SCREEN_H * scale }}>
        <div
          className="absolute left-0 top-0 overflow-hidden rounded-[14px] border border-white/10 shadow-[0_40px_100px_-40px_rgba(0,0,0,0.9)]"
          style={{
            width: SCREEN_W,
            height: SCREEN_H,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            visibility: scale ? 'visible' : 'hidden',
            background:
              'radial-gradient(ellipse 80% 70% at 70% 20%, #1a2236 0%, transparent 60%), radial-gradient(ellipse 70% 60% at 15% 90%, #17151f 0%, transparent 60%), #0c0e14',
          }}
        >
          <div className="relative z-50 flex h-[26px] items-center gap-[18px] bg-black/35 px-4 text-[12px] text-white/90 backdrop-blur-xl">
            <SiApple className="h-[13px] w-[13px]" />
            <span className="font-semibold">{menu}</span>
            {['File', 'Edit', 'View', 'Window', 'Help'].map((item) => (
              <span key={item} className="text-white/85">
                {item}
              </span>
            ))}
            <span className="ml-auto text-white/85">Mon 9:21 AM</span>
          </div>

          <VSCodeWindow focused={focusedWindow === 'code'} />
          <GitHubWindow focused={focusedWindow === 'github'} />
          <TerminalWindow focused={focusedWindow === 'terminal'} />

          {!compact && (
            <div className="absolute bottom-[20px] left-[20px] z-40">
              <Keycast frame={frame} />
            </div>
          )}
          {!compact && notice}
        </div>
      </div>

      {compact && (
        <div className="mt-4 flex flex-col items-center gap-3">
          <Keycast frame={frame} />
          <div className="min-h-[150px]">{notice}</div>
        </div>
      )}
    </div>
  )
}
