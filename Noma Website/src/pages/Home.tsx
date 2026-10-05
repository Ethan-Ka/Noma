import Hero from '../components/sections/Hero'
import Context from '../components/sections/Context'
import NotStatic from '../components/sections/NotStatic'
import Flow from '../components/sections/Flow'
import Notice from '../components/sections/Notice'
import Product from '../components/sections/Product'
import Holo from '../components/sections/Holo'
import Device from '../components/sections/Device'
import Beta from '../components/sections/Beta'

/**
 * 2026-09-24 rebuild. The page is now one argument in order, not a tour of
 * features:
 *
 *   Hero        the claim, proved by the visual before a word is read
 *   Context     the flagship: the visitor drives the adaptation themselves
 *   NotStatic   the problem and the "why not just buy a macro pad" objection
 *   Flow        the second half — what it records, and the pattern in it
 *   Notice      how it tells you, and how little it asks
 *   Product     the actual application, clickable
 *   Holo        the pillar that needs nothing but the laptop
 *   Device      the pillar that is still being built, said plainly
 *   Beta        the ask
 *
 * Ten sections, down from twelve. `StaticMachine` and `Detection` were cut as
 * duplicates — each made a point its neighbour already made, with a weaker
 * visual, and a page that says a thing twice is asking to be skimmed. See
 * `NotStatic` and `Flow` for what absorbed them.
 *
 * Every section is built around one reusable object — `AdaptiveSurface` — so
 * the site makes its point with the product rather than with illustration.
 * The board itself appears once, in `Device`, running the same application
 * cycle as everything above it — hardware is a real pillar here, but it is
 * shown as the thing the software drives rather than as the story. The old
 * hardware-led sections (KeyboardCloseup, the modular-module visuals) stay
 * removed, recoverable from git history, the same convention every prior
 * trim on this site has used.
 */
export default function Home() {
  return (
    <>
      <Hero />
      <Context />
      <NotStatic />
      <Flow />
      <Notice />
      <Product />
      <Holo />
      <Device />
      <Beta />
    </>
  )
}
