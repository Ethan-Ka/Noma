import Hero from '../components/sections/Hero'
import Demo from '../components/sections/Demo'
import Problem from '../components/sections/Problem'
import Flow from '../components/sections/Flow'
import HowItWorks from '../components/sections/HowItWorks'
import Holo from '../components/sections/Holo'
import Adaptive from '../components/sections/Adaptive'
import Device from '../components/sections/Device'
import Beta from '../components/sections/Beta'

/**
 * 2026-10-06 redesign: what is Noma, how does it work, why is it useful, in
 * that order, with the product shown working right under the hero.
 *
 *   Hero        the claim, with the adaptive controls under it
 *   Demo        Noma noticing a real workflow while someone works
 *   Problem     you shouldn't have to work around your computer
 *   Flow        stop repeating yourself: the real suggestion, clickable
 *   HowItWorks  four steps, short
 *   Holo        Glide: the controls on the trackpad (id "glide")
 *   Adaptive    it gets better as you use it; the larger idea
 *   Device      the hardware, honestly (details on /device)
 *   Beta        the invitation
 *
 * Built from the existing visuals (AdaptiveSurface, the desktop notice scene,
 * ProductNotice, HoloDemo) rather than rebuilt. Cut: NotStatic, Notice and
 * Product, whose jobs moved into Problem, Demo and Flow. Recoverable from git.
 */
export default function Home() {
  return (
    <>
      <Hero />
      <Demo />
      <Problem />
      <Flow />
      <HowItWorks />
      <Holo />
      <Adaptive />
      <Device />
      <Beta />
    </>
  )
}
