/**
 * 2026-10-05: the buttons (GLASS_ACCENT, toggles) were toned down at the
 * user's request ("slight glass, not overpowering", the glow read as
 * tacky): no white sheen, no colored outer glow. GLASS, the top nav bar,
 * was then restored to its full look by request: "the only thing that
 * looked good in the glass". Keep the buttons quiet; leave GLASS alone.
 *
 * Shared "liquid glass" material, reused across the site's chrome: the
 * floating pill nav and every real button (CTAs, toggle pills). Brought
 * back by explicit user request even within the 2026 brand-identity pass,
 * which otherwise avoids decoration for its own sake — kept deliberately
 * restrained (one dark base, one accent tint, no rainbow/purple gradients)
 * so it reads as "the one Noma material," not "AI SaaS glassmorphism."
 *
 * The fill is a near-opaque dark base, not a light tint: a light tint over
 * this dark page barely darkens what's behind it (real prior feedback was a
 * section headline visibly ghosting through the old pill while scrolling
 * past it). A thin white gradient sheen on top plus inset highlight/lowlight
 * edges make it read as a lit, curved material instead of a flat translucent
 * rectangle.
 */
export const GLASS =
  'border border-white/10 bg-base-950/85 bg-gradient-to-b from-white/[0.07] to-transparent shadow-[inset_0_1px_0_0_rgba(255,255,255,0.13),inset_0_-1px_0_0_rgba(255,255,255,0.03),0_12px_36px_-10px_rgba(0,0,0,0.55)] backdrop-blur-2xl backdrop-saturate-150'

/**
 * Same glass family, tinted with the signature accent blue instead of near-
 * black — for the site's primary "Join the Waitlist" call-to-action and any
 * other button that needs to read as the one thing to click, without
 * breaking from the glass material everything else on the bar uses.
 */
export const GLASS_ACCENT =
  'border border-accent/30 bg-accent/[0.14] text-base-50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)] backdrop-blur-md transition-colors hover:border-accent/45 hover:bg-accent/[0.2]'

/** The inactive state of a glass toggle pill (`KeyboardCloseup`'s preset
 *  buttons, the Context section's tabs) — the same neutral glass as
 *  `GLASS`, just lighter (`backdrop-blur-lg`, no saturation boost) since
 *  these are small repeated controls, not the one nav bar on the page. */
export const GLASS_TOGGLE =
  'border border-white/[0.08] bg-base-950/40 text-base-400 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] backdrop-blur-lg transition-all duration-150 hover:text-base-100 hover:border-white/20 active:scale-95'

/** The active state of the same toggle pill — accent-tinted glass, dimmer
 *  than `GLASS_ACCENT` since several of these can be visible at once and
 *  only one should read as "selected," not "the page's main CTA." */
export const GLASS_TOGGLE_ACTIVE =
  'border border-accent/35 bg-accent/[0.12] text-accent-bright shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)] backdrop-blur-lg transition-all duration-150 active:scale-95'

/** The primary button on the light Try the beta panel (`.feature-panel`):
 *  solid near-black, since a blue tint reads pale on the off-white. */
export const SOLID_ON_LIGHT =
  'border border-[#0b0b0e] bg-[#0b0b0e] text-white transition-colors hover:border-[#26262c] hover:bg-[#26262c]'
