import nomaMark from '../../assets/noma-mark.png'
import nomaWordmark from '../../assets/noma-wordmark.png'
import WorkflowSteps, { type WorkflowStep } from './WorkflowSteps'

/**
 * Noma Notice, as it actually appears: the small glass card that shows up in
 * the corner of the screen when Flow recognises something, while Noma itself
 * is nowhere to be seen.
 *
 * Built to match the shipping component rather than to look good in a
 * screenshot — same lockup, same "New workflow detected", same single
 * "Review" action, same restraint. It is one of the few things a visitor will
 * see on their own desktop, so it is part of the brand whether or not it is
 * treated as one.
 */

interface NoticeCardProps {
  steps: WorkflowStep[]
  /** Shown as the repeat count, the way the real notice does. */
  occurrences?: number
  className?: string
}

export default function NoticeCard({ steps, occurrences = 6, className = '' }: NoticeCardProps) {
  return (
    <div
      className={`w-full max-w-[330px] rounded-2xl border border-white/10 bg-base-950/85 p-3.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.09),0_28px_70px_-24px_rgba(0,0,0,0.95)] backdrop-blur-2xl backdrop-saturate-150 ${className}`}
    >
      <div className="flex items-center gap-1.5">
        <img src={nomaMark} alt="" className="h-[18px] w-auto opacity-90" />
        <img src={nomaWordmark} alt="Noma" className="h-[9px] w-auto opacity-70" />
        <span className="ml-auto font-mono text-[10px] text-base-500">{occurrences}x</span>
        <span
          aria-hidden
          className="ml-1 flex h-4 w-4 items-center justify-center rounded text-[13px] leading-none text-base-500"
        >
          ×
        </span>
      </div>

      <p className="mt-2.5 text-[13px] font-medium tracking-tight text-base-50">New workflow detected</p>

      <WorkflowSteps steps={steps} size="sm" animate={false} className="mt-3" />

      <p className="mt-3 text-[11px] font-medium text-accent">Review</p>
    </div>
  )
}
