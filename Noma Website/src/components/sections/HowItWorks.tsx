import Section from '../layout/Section'
import SectionIntro from '../ui/SectionIntro'
import Reveal from '../ui/Reveal'

const STEPS = [
  { title: 'Work normally', body: 'Use your computer the way you already do.' },
  { title: 'Noma notices', body: 'Which shortcuts, in which app, in what order. Never what you type.' },
  { title: 'Make it yours', body: 'Turn a repeated workflow into one press, on the zone you choose.' },
  { title: 'Keep moving', body: 'Your controls follow you from app to app, and change as you do.' },
]

export default function HowItWorks() {
  return (
    <Section id="how">
      <SectionIntro title="How it works." />
      <div className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
        {STEPS.map((step, index) => (
          <Reveal key={step.title} delay={index * 0.08} className="border-t border-base-700 pt-6">
            <div>
              <span className="font-mono text-xs text-accent-bright">{String(index + 1).padStart(2, '0')}</span>
              <h3 className="mt-4 font-display text-xl font-semibold tracking-tight text-base-50">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-base-400">{step.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}
