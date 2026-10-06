import Section from '../layout/Section'
import SectionIntro from '../ui/SectionIntro'
import Reveal from '../ui/Reveal'

/**
 * The problem, said plainly: the same small actions, over and over, in the
 * same apps. Typography only; the counts are an ordinary day, illustrative.
 */
const REPEATS = [
  { what: 'The same shortcut', detail: 'Ctrl + Shift + P', count: '41' },
  { what: 'The same button', detail: 'Export', count: '12' },
  { what: 'The same two apps', detail: 'VS Code, Claude', count: '63' },
  { what: 'The same five steps', detail: 'Screenshot to commit', count: '9' },
]

export default function Problem() {
  return (
    <Section id="problem">
      <SectionIntro title="You shouldn’t have to work" quiet="around your computer." />

      <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-20">
        <Reveal delay={0.06}>
          <p className="max-w-md text-base leading-relaxed text-base-300 sm:text-lg">
            Every app has its own shortcuts, its own buttons, its own steps. You learn them, then repeat them all
            day.
          </p>
          <p className="mt-5 max-w-md text-base leading-relaxed text-base-50 sm:text-lg">Noma adapts the interface instead.</p>
        </Reveal>

        <Reveal delay={0.08}>
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-base-500">An ordinary day</p>
          <ul className="border-t border-base-800">
            {REPEATS.map((row) => (
              <li key={row.what} className="flex items-baseline gap-4 border-b border-base-800 py-4">
                <span className="text-base text-base-100 sm:text-lg">{row.what}</span>
                <span className="hidden truncate font-mono text-xs text-base-500 sm:inline">{row.detail}</span>
                <span className="ml-auto font-display text-2xl font-semibold tabular-nums tracking-tight text-base-50 sm:text-3xl">
                  {row.count}
                  <span className="ml-0.5 text-base text-base-500">×</span>
                </span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </Section>
  )
}
