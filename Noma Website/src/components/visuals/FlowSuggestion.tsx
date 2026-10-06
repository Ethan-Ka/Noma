import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import DemoWorkflowChain, { type DemoChainStep } from './DemoWorkflowChain'
import { DEMO_HERO_CARD } from './demoSurfaces'
import { appProfiles } from '../../data/appProfiles'
import { SAVED_LABEL, ZONES } from '../../data/flowDemo'

/**
 * The suggestion Flow puts on Noma's Home page, clickable. Copy and order
 * follow Noma App's NomaMoment.tsx exactly (2026-10-06): "Noma noticed", the
 * occurrence sentence, the chain, "Turn this into one Glide action?",
 * Review steps → the exact steps in order → which zone → saved. Driven by
 * local state here; the real one is driven by the app's suggestion engine.
 * The workflow is the same one WorkflowDemo plays, so the page tells one
 * story: noticed while you work, decided here.
 */

const APP = 'Visual Studio Code'
const OCCURRENCES = 9

const CHAIN: DemoChainStep[] = [
  { kind: 'app', appId: 'vscode', label: 'VS Code' },
  { kind: 'shortcut', label: 'Screenshot' },
  { kind: 'app', appId: 'claude', label: 'Claude' },
  { kind: 'shortcut', label: 'Paste' },
  { kind: 'app', appId: 'github', label: 'GitHub' },
  { kind: 'shortcut', label: 'Commit' },
]

/** What the app's preview lists under "Exactly what this will do". */
const PREVIEW = [
  'Press Win + Shift + S in VS Code',
  'Switch to Claude',
  'Press Ctrl + V',
  'Switch to GitHub Desktop',
  'Press Ctrl + Enter',
]

type Stage = 'ask' | 'review' | 'saved' | 'dismissed'

export default function FlowSuggestion({ onSaved }: { onSaved: (slot: number | null) => void }) {
  const [stage, setStage] = useState<Stage>('ask')
  const [slot, setSlot] = useState<number | null>(null)
  const controls = appProfiles.vscode.controls

  const save = (index: number) => {
    setSlot(index)
    setStage('saved')
    onSaved(index)
  }
  const reset = () => {
    setSlot(null)
    setStage('ask')
    onSaved(null)
  }

  const fade = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -6 },
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
  }

  return (
    <div className={`${DEMO_HERO_CARD} p-6 sm:p-8`}>
      <AnimatePresence mode="wait" initial={false}>
        {stage === 'saved' && slot !== null ? (
          <motion.div key="saved" {...fade}>
            <p className="text-xs text-base-400">Saved</p>
            <p className="mt-1.5 font-display text-2xl font-semibold tracking-tight text-base-50">{SAVED_LABEL}</p>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-base-300">
              Now on the {ZONES[slot].toLowerCase()} Glide zone in {APP}. To run it, switch to {APP} and swipe in
              from the {ZONES[slot].toLowerCase()}.
            </p>
            <button type="button" onClick={reset} className="mt-5 text-xs text-base-400 transition-colors hover:text-base-100">
              Start over
            </button>
          </motion.div>
        ) : stage === 'dismissed' ? (
          <motion.div key="dismissed" {...fade}>
            <p className="text-sm text-base-300">Not now. Noma learns from that too.</p>
            <button type="button" onClick={reset} className="mt-4 text-xs text-accent-bright transition-colors hover:text-accent">
              Show it again
            </button>
          </motion.div>
        ) : (
          <motion.div key="ask" {...fade}>
            <div className="flex items-start justify-between gap-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-base-400">Noma noticed</p>
              <span className="shrink-0 text-xs text-base-500">Just now</span>
            </div>
            <p className="mt-2 font-display text-xl font-semibold leading-snug tracking-tight text-base-50 sm:text-2xl">
              You&rsquo;ve repeated this workflow {OCCURRENCES} times across your apps.
            </p>
            {/* The app's large chain on wider screens; its smaller one on
                phones, where three large nodes don't fit. */}
            <div className="mt-6 hidden sm:block">
              <DemoWorkflowChain steps={CHAIN} size="lg" />
            </div>
            <div className="mt-5 sm:hidden">
              <DemoWorkflowChain steps={CHAIN} size="md" />
            </div>

            {stage === 'ask' ? (
              <>
                <p className="mt-6 text-base text-base-100">Turn this into one Glide action?</p>
                <div className="mt-3 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setStage('review')}
                    className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-bright"
                  >
                    Review steps
                  </button>
                  <button type="button" onClick={() => setStage('dismissed')} className="text-sm text-base-400 hover:text-base-100">
                    Not now
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-5 border-t border-base-700 pt-4">
                <p className="mb-2 text-xs text-base-400">Exactly what this will do, in order:</p>
                <ol className="space-y-1 text-sm">
                  {PREVIEW.map((step, index) => (
                    <li key={step} className="flex gap-2.5">
                      <span className="w-4 shrink-0 text-right font-mono text-[11px] leading-5 text-base-500">{index + 1}</span>
                      <span className="text-base-100">{step}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-2 text-xs text-base-500">
                  It only runs when you swipe its zone, and stops at the first step that fails.
                </p>
                <p className="mb-2 mt-5 text-xs text-base-400">
                  Which Glide zone in {APP} should run it? It replaces what&rsquo;s there now.
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {ZONES.map((zone, index) => (
                    <button
                      key={zone}
                      type="button"
                      onClick={() => save(index)}
                      className="rounded-md border border-base-600 px-2 py-2 text-left text-xs transition-colors hover:border-accent/70"
                    >
                      <span className="block text-[10px] text-base-500">{zone}</span>
                      <span className="mt-0.5 block truncate text-base-100">{controls[index]}</span>
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => setStage('ask')} className="mt-3 text-xs text-base-400 hover:text-base-100">
                  Cancel
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
