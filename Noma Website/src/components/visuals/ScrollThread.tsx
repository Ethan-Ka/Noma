/**
 * A thread down the page (2026-10-06, replacing the stardust and then a dot
 * field; the user wanted something cool and intuitive, not tacky, and cheap).
 * A hairline track runs down the left margin beside the section panels, like
 * the step-to-step chains in Noma's own workflow cards. A short Noma Blue
 * light rides down it at screen height as you scroll, and each section's
 * node (rendered by Section.tsx) lights up as that section comes into view,
 * so you can always see where you are in the story.
 *
 * No JavaScript: the light is position: sticky inside the track, and the
 * nodes use a CSS view-timeline (static, unlit, where unsupported). Wide
 * screens only (1280px+), where there's margin beside the panels for it.
 * Styles in index.css (.thread-*).
 */
export default function ScrollThread() {
  return (
    <div aria-hidden className="thread-track">
      <div className="thread-light" />
    </div>
  )
}
