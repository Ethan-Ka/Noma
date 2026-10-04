import Section from '../layout/Section'
import Reveal from '../ui/Reveal'
import AppIcon from '../visuals/AppIcon'
import { appProfiles } from '../../data/appProfiles'

/**
 * Flow: what it records, and the pattern it finds in it.
 *
 * One section, not two. An earlier pass had the mechanism ("what it actually
 * sees") and the repetition ("Noma noticed what you keep doing") as separate
 * sections, which meant showing the same four-step workflow twice to make one
 * point. The log does both jobs at once, and better: the runs are marked in
 * it, so the reader finds the pattern a moment before the copy names it.
 *
 * Three things land here together, and the log is what lets them. How the
 * detection works. How little it takes. And what is *missing* from every row —
 * no text, no content, no window titles. Saying "we respect your privacy"
 * asks to be believed; showing the whole record does not.
 */

interface Entry {
  time: string
  app: string
  action: string
  /** Part of the sequence that keeps coming back. */
  run?: number
}

const LOG: Entry[] = [
  { time: '09:12:04', app: 'vscode', action: 'Ctrl + S' },
  { time: '09:12:31', app: 'chrome', action: 'Ctrl + T' },
  { time: '09:14:22', app: 'vscode', action: 'Win + Shift + S', run: 1 },
  { time: '09:14:26', app: 'claude', action: 'Switched here', run: 1 },
  { time: '09:14:28', app: 'claude', action: 'Ctrl + V', run: 1 },
  { time: '09:14:31', app: 'claude', action: 'Enter', run: 1 },
  { time: '09:18:47', app: 'chrome', action: 'Ctrl + W' },
  { time: '09:21:09', app: 'vscode', action: 'Win + Shift + S', run: 2 },
  { time: '09:21:13', app: 'claude', action: 'Switched here', run: 2 },
  { time: '09:21:15', app: 'claude', action: 'Ctrl + V', run: 2 },
  { time: '09:21:18', app: 'claude', action: 'Enter', run: 2 },
  { time: '09:26:02', app: 'spotify', action: 'Media Play' },
]

const NEVER = ['What you typed', 'What was on screen', 'Window titles', 'File names', 'Anything you can read']

export default function Flow() {
  return (
    <Section id="flow">
      <div className="max-w-2xl">
        <Reveal>
          <h2 className="text-balance font-display text-3xl font-semibold leading-[1.08] tracking-[-0.035em] text-base-50 sm:text-5xl">
            Noma noticed what you keep doing.
          </h2>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="mt-6 text-base leading-relaxed text-base-300">
            Flow watches which shortcut you press, in which application, in what order. Never what you type.
            That is the entire record, and it turns out to be enough to recognise how you work.
          </p>
        </Reveal>
      </div>

      <div className="mt-14 grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-12">
        <Reveal>
          <div className="overflow-hidden rounded-2xl border border-base-800 bg-base-900">
            <div className="flex items-center justify-between border-b border-base-800 px-5 py-3.5">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-base-500">Captured today</p>
              <p className="font-mono text-[11px] text-base-500">12 events</p>
            </div>

            <ul className="divide-y divide-base-800/70">
              {LOG.map((entry, index) => {
                const app = appProfiles[entry.app]
                const inRun = entry.run !== undefined
                return (
                  <li
                    key={index}
                    className={`relative flex items-center gap-3 px-5 py-2.5 sm:gap-4 ${
                      inRun ? 'bg-white/[0.015]' : ''
                    }`}
                  >
                    {inRun && <span aria-hidden className="absolute inset-y-0 left-0 w-px bg-accent/70" />}
                    <span className="w-[62px] shrink-0 font-mono text-[11px] text-base-500 sm:w-[68px] sm:text-xs">
                      {entry.time}
                    </span>
                    <AppIcon id={entry.app} color={app?.color} className="h-4 w-4 shrink-0" />
                    <span className="w-[76px] shrink-0 truncate text-xs text-base-300 sm:w-[92px] sm:text-sm">
                      {app?.shortName}
                    </span>
                    <span
                      className={`truncate font-mono text-[11px] sm:text-xs ${
                        inRun ? 'text-base-100' : 'text-base-400'
                      }`}
                    >
                      {entry.action}
                    </span>
                  </li>
                )
              })}
            </ul>

            <div className="border-t border-base-800 px-5 py-4">
              <p className="text-xs leading-relaxed text-base-400">
                <span className="text-accent">Two runs marked.</span> The same four steps, twice, forty minutes
                apart, with unrelated work in between. That gap is what makes it a habit rather than a burst.
                Two more and Noma will say something.
              </p>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="rounded-2xl border border-base-800 bg-base-900 p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-base-500">Never recorded</p>
            <ul className="mt-5 space-y-3.5">
              {NEVER.map((item) => (
                <li key={item} className="flex items-baseline gap-3 text-sm text-base-300">
                  <span aria-hidden className="mt-1.5 h-px w-3 shrink-0 bg-base-600" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-6 border-t border-base-800 pt-5 text-xs leading-relaxed text-base-400">
              Keystrokes without a modifier are never captured at all, so typing a password cannot produce a
              record even in principle.
            </p>
          </div>
        </Reveal>
      </div>
    </Section>
  )
}
