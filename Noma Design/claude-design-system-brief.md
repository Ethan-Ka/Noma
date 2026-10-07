# Brief for Claude Design: revamp the Noma design system

Pairs with `claude-design-font-brief.md`. Do the type decision and this together, since the type scale is part of the system.

## What I need

A revamped, coherent design system for the Noma desktop app: tokens, a small set of components, and rules for when to use each. I want two or three genuinely different directions, shown on real screens, with a recommendation. The output must be implementable in our stack (Tailwind config + a handful of shared class constants), and it should replace ad hoc styling with named decisions.

## The product

Noma is an Electron app (Windows first, macOS too). It gives every app four actions you run by sliding a finger from the palm rest onto the trackpad (Glide), and notices shortcut sequences you repeat so you can save one to a zone (Flow). Users are students who give it a few minutes to prove itself. Feel: calm, precise, a little tactile, like good hardware. Not a SaaS dashboard, not "AI".

## What exists today (please critique before replacing)

Current direction is called "restrained graphite hardware" (v4, 2026-09-17). Full spec in `Noma App/DESIGN.md` (307 lines); tokens in `Noma App/tailwind.config.js`; surface recipes in `Noma App/src/renderer/src/lib/surfaces.ts`.

- **Color:** solid graphite surface ramp `base` 950 to 600 (#08090a canvas, #111214 card, #15171a elevated, #24262a border, #30333a strong border), a text ramp `neutral` 50 to 950, one blue accent (#4c7eff, muted #2f4f9e, 12% tint), plus success, error, a gold used only for real hardware contact, and a violet token that is defined but deliberately unused. Dark only.
- **Surfaces:** `CARD` (solid, rounded-2xl, 1px border, soft shadow), `GLASS_PANEL` (misnamed: it is a solid elevated modal panel), `DEVICE_GLASS_CARD` (the one real glass surface), `KEYCAP_SHADOW` (top-lit gradient for control tiles), a hero card for suggestions, and a modal scrim.
- **Type:** Sora for display, Inter for UI, JetBrains Mono for shortcuts (see the font brief).
- **Motion:** recently added: 150 to 320ms fades, rises and scales, short exits, one 6px rise, reduced-motion respected. No shared motion tokens beyond two easing variables.
- **Components:** sidebar nav, cards, modals, toggle switch, buttons, form fields, empty states, control tiles (keycaps), a workflow chain diagram of app icons, status text, toasts.

## Problems I can see (tell me which are real and add any I missed)

- Several unnamed one-off values: text sizes like 10px, 11px and 13px written inline; four radii (md, lg, xl, 2xl) with no rule for which goes where; spacing between sections picked per page (mb-8, mb-10, mb-12, mb-14).
- Page headers drifted: titles are 20px on some pages and 24 to 30px on others, with different container widths and paddings (max-w-2xl, 3xl, 4xl) and different top padding.
- Tracked, uppercase, 10px labels are used for many different jobs (field label, card eyebrow, zone name, stat label). They all look the same, so none of them carries hierarchy.
- Three button looks and several one-off ones (accent fill, bordered ghost, plain text link) with no clear rule for primary versus secondary versus quiet.
- Icons are inconsistent: a mix of hand-drawn stroke icons, real app icons at varying sizes, and text glyphs that were only recently replaced.
- Accent blue carries too many meanings: active nav, primary buttons, links, selected state, "Flow suggestion". Meaning is overloaded.
- The glass-versus-solid rule is easy to break. A modal panel called "glass" is solid.
- Empty states, loading states and error states have no shared pattern.
- The marketing website shares the same tokens but has drifted a few of them (10 token differences).

## Scope: please define

1. **Foundations:** color roles (surface, border, text, accent, status, hardware) with the contrast ratios measured for every text and background pair; a type scale (sizes, weights, tracking, line heights) by role; spacing scale; radius scale with a rule for each; elevation and shadow levels; icon sizes and stroke; motion tokens (durations, easings, enter and exit patterns).
2. **Page frame:** one page header pattern (title, optional subtitle, optional right-side action), one container width rule, one section rhythm. Decide whether pages have a subtitle at all.
3. **Components, each with states (default, hover, focus-visible, active, disabled, loading, error):** button (primary, secondary, quiet, destructive), text input, select, toggle, checkbox, card, modal, tag or badge, tooltip, toast, list row, empty state, control tile (the keycap), workflow chain, nav item.
4. **Rules:** a short do and don't list, plus a rule for what the accent color is allowed to mean.

## Constraints

- Desktop app, dark theme is the primary one. Say whether a light theme belongs in this system and, if so, what it costs.
- Implementable with Tailwind utility classes plus a few shared class-string constants and CSS variables; no component library, no runtime theme engine. The renderer is React 19.
- Every color pair must pass WCAG AA (4.5:1 body, 3:1 large text and non-text UI). Show the measured ratios.
- Keep what is working: solid surfaces over glass, a single accent, real application icons, information over decoration. Replace what is not.
- The accent must not be indigo, violet or purple, and no purple-to-blue gradients, glassmorphism or colored glows. Amber-cream and emerald are also overused; justify any choice from something real (a material, a photo, the hardware).
- Everything must respect prefers-reduced-motion.
- The hardware relationship matters: control labels are 12 characters or fewer because they also appear on a tiny physical display, and there are four zones, so the system should treat "four things" as a first-class layout.

## Deliverables

1. A short critique of the current system using the problems above.
2. Two or three directions, each with: a one-sentence idea and its reference (what real thing it comes from), the full token set, and why it suits Noma.
3. Each direction rendered on four screens: Home (greeting, suggestion card, four control tiles), Glide (zone map and a settings card), Workflows (list of saved workflows), and a modal (editing a control).
4. A recommendation.
5. For the chosen direction, drop-in code: the `tailwind.config.js` theme extension, CSS variables if used, the shared class constants (replacing `lib/surfaces.ts`), and a one-page usage guide that can replace `DESIGN.md`.

## Attach when you give this to Claude Design

`claude-design-font-brief.md`, `Noma App/DESIGN.md`, `Noma App/tailwind.config.js`, `Noma App/src/renderer/src/lib/surfaces.ts`, and screenshots of Home, Glide, Workflows and a modal.

---

# Appendix: the existing design system, as code

These are the real files, copied verbatim, so you can see exactly what you are replacing. Paths are relative to the repo root (`Noma App/...`). Where a file's comments are long, they explain past decisions (v3 glass to v4 graphite); keep what they say about why, not just what.

### Tailwind theme: color tokens, fonts, and everything else

`tailwind.config.js`

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      // 2026-09-17 visual system (v4, "restrained graphite hardware"):
      // supersedes v3's liquid-glass-everywhere direction — real user
      // feedback was that v3 had drifted into "generic AI SaaS" (glowing
      // borders, blue-to-violet gradients, glass on every card). The fix
      // is a palette change, not a rewrite: solid graphite surfaces
      // (`base.700`/`600` are now real hex borders, not translucent white
      // overlays), one blue accent used sparingly, and violet retired from
      // every actual UI surface (the `violet` token below is now dead
      // — kept defined, referenced nowhere, in case a future rebrand wants
      // it back, but no component should reach for it). Glass survives
      // only where lib/surfaces.ts's own doc comment now scopes it to:
      // navigation, device surfaces (Holo, the Noma Device card), and
      // Noma Notice — never as a blanket "every card is glass" default.
      // Intelligence is communicated through information — real counts,
      // plain language, real application icons — never decoration: no
      // sparkle, no rainbow gradients, no colored glow "because it's AI."
      // Same token NAMES as the prior system so every existing
      // `bg-base-900`/`text-neutral-100`/etc. class across the app
      // repaints automatically — only the values changed.
      colors: {
        // `base` is the surface ramp: 950 is the page canvas (true
        // near-black), 900 a hair lighter for a secondary flat panel, 850
        // is "Card" (the new default solid-card fill — see
        // lib/surfaces.ts), 800 is "Elevated" (an input, a hover state, a
        // step brighter than Card), and 700/600 are now real solid
        // graphite hex borders ("Border"/"Strong border") — not
        // translucent white overlays the way v3 had them, so a card's
        // edge reads as a material seam, not a light catching glass.
        base: {
          950: '#08090a',
          900: '#0d0f11',
          850: '#111214',
          800: '#15171a',
          700: '#24262a',
          600: '#30333a'
        },
        accent: {
          DEFAULT: '#4c7eff',
          muted: '#2f4f9e',
          // The active-nav-item / "part of the adaptive loop" wash — a
          // translucent accent tint over dark glass, not a light color.
          subtle: 'rgba(76,126,255,0.12)'
        },
        // Flow's own voice, used sparingly (v0.1): only to mark a Flow
        // suggestion ("Noma noticed" labels, the approve button of a
        // suggestion). Never on general UI, never as a glow or gradient.
        violet: {
          DEFAULT: '#8b6cff',
          muted: 'rgba(139,108,255,0.16)'
        },
        success: {
          DEFAULT: '#4cbf82',
          muted: 'rgba(76,191,130,0.16)'
        },
        error: {
          DEFAULT: '#e0685f',
          muted: 'rgba(224,104,95,0.16)'
        },
        // Real hardware dock contact only (HardwareStatusPill, DeviceLogRow)
        // — never a general brand color, and never used for "Noma learned
        // something" (that's communicated through typography and real
        // information now, not a color).
        gold: {
          DEFAULT: '#c9a45f',
          muted: 'rgba(201,164,95,0.18)'
        },
        // `neutral` is the text ramp: 100 is primary reading text (near-
        // white, #F5F5F7), climbing toward 950 which lands on the same
        // near-black as `base`'s own 950 — text at the bottom of this
        // scale is for a surface, never a glyph.
        neutral: {
          50: '#ffffff',
          100: '#f5f5f7',
          200: '#d5d6db',
          300: '#adaeb8',
          // 400 ("Secondary text") and 600 ("Muted") are the two tiers
          // named explicitly in the new restrained palette; 500/700 are
          // interpolated between them, unchanged from before.
          400: '#96999f',
          500: '#75767e',
          600: '#656970',
          700: '#45474e',
          800: '#15171a',
          900: '#0d0f11',
          950: '#08090a'
        },
        // Holo keeps its own small token group — "a piece of Noma hardware
        // translated into software" (see Holo.tsx) needs to read as a
        // literal inset physical device face, deliberately a touch deeper/
        // more contrasted than the app's own now-dark canvas around it —
        // never reference `base`/`neutral` inside Holo's own components.
        holo: {
          bg: '#050506',
          surface: 'rgba(255,255,255,0.05)',
          border: 'rgba(255,255,255,0.1)',
          text: '#f5f5f7',
          muted: '#83858d'
        }
      },
      fontFamily: {
        // Shared with the Noma Website (src/index.css's --font-display/
        // --font-sans/--font-mono tokens there) — same three fonts, same
        // roles: Sora for page/section titles (echoes the "noma" wordmark's
        // rounded-geometric letterforms), Inter for body text, JetBrains
        // Mono for technical/log labels. Fonts are loaded via @fontsource
        // imports in styles/globals.css.
        display: ['"Sora Variable"', 'Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SFMono-Regular"', 'Consolas', '"Liberation Mono"', 'monospace']
      }
    }
  },
  plugins: []
}
```

### Shared surface and field class strings

`src/renderer/src/lib/surfaces.ts`

```ts
/**
 * Shared surface class strings (v4, restrained graphite — 2026-09-17).
 * Supersedes v3's "glass everywhere" system — real feedback was that a
 * translucent-white-on-black card with a colored glow read as generic
 * "AI SaaS," not a premium hardware product (think Apple / Teenage
 * Engineering / Linear, not a neon AI dashboard). The default surface is
 * now solid graphite: a real `base-850` fill, a real `base-700` hex
 * border, a plain dark ambient shadow — no backdrop-blur, no colored glow,
 * no gradient background. Depth comes from the material (fill + border +
 * a soft shadow), not from translucency.
 *
 * Genuine glass survives in exactly the three places called out
 * explicitly: navigation (AppShell's sidebar, built inline, not from
 * these constants), a device surface (Holo's own token group; see
 * `DEVICE_GLASS_CARD` below for HomeSidePanel's Noma Device card), and
 * Noma Notice (`HERO_CARD`) — every other surface in the app should reach
 * for `CARD`, not invent a new translucent recipe.
 */

/** The scrim behind a modal — a soft, mostly-transparent dark wash over
 *  real page content, not a full black-out. */
export const MODAL_SCRIM = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px] noma-fade-in'

/**
 * The default solid surface — Card fill, real border, a plain shadow.
 * This is what "everything else" (Settings, Learning, Demo panels, modal
 * panels, the onboarding hardware picker, the Noma loop card) should use;
 * don't invent a second flat-card recipe per page.
 */
export const CARD =
  'rounded-2xl border border-base-700 bg-base-850 shadow-[0_10px_28px_-16px_rgba(0,0,0,0.55)]'

/** A modal panel — same solid Card material as everything else, just a
 *  touch more elevated (Elevated fill, a slightly heavier shadow) so it
 *  visibly lifts off the page behind the scrim. Callers still supply their
 *  own `max-w-*`/`p-*`. */
export const GLASS_PANEL =
  'rounded-2xl border border-base-700 bg-base-800 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.65)] noma-scale-in'

/**
 * The one deliberate glass surface outside Holo/Noma Notice: HomeSidePanel's
 * Noma Device card, since that one specifically represents the physical
 * device — a light translucency reads as "a piece of hardware's own
 * surface," not decoration. Restrained on purpose: no color tint, modest
 * blur, no glow.
 */
export const DEVICE_GLASS_CARD =
  'rounded-2xl border border-white/[0.08] bg-white/[0.035] backdrop-blur-md shadow-[0_10px_28px_-16px_rgba(0,0,0,0.55)]'

/**
 * The physical "keycap" material shared by ControlTile (read-only) and
 * VirtualControlButton (pressable) — a control should read as a small,
 * tactile piece of Noma hardware, not a dashboard tile. A subtle internal
 * light gradient (top-lit, like a real keycap catching ambient light) —
 * brightness only, never a color — plus the same soft ambient shadow every
 * elevated surface gets.
 */
export const KEYCAP_SHADOW =
  'bg-gradient-to-b from-white/[0.05] to-white/[0.015] shadow-[0_6px_18px_-10px_rgba(0,0,0,0.55)]'

/**
 * Noma Notice's own surface — the one card allowed a touch of real glass,
 * per the product brief, but restrained: a solid-leaning fill (not the
 * heavy 6.5%-opacity/28px-blur v3 had), a plain border, a plain shadow.
 * No colored glow layer — a past version of this card had one
 * (`HERO_CARD_GLOW`, blue+violet radial gradients bleeding in from the
 * corners); real feedback was that it read as "glowing because it's AI,"
 * exactly the effect this whole system now avoids. The workflow inside the
 * card (see `WorkflowChain`'s real application icons) is what's supposed
 * to provide the visual interest here, not the card's own background.
 */
export const HERO_CARD =
  'relative overflow-hidden rounded-2xl border border-base-700 bg-white/[0.025] backdrop-blur-md shadow-[0_20px_48px_-20px_rgba(0,0,0,0.6)]'

/**
 * Noma Notice's floating surface — the fourth, and last, place real glass
 * belongs.
 *
 * It earns it for a reason none of the in-app cards could: this one
 * genuinely does sit on the user's desktop, over their actual work, in its
 * own transparent window. Translucency here is representational rather than
 * decorative — it is what tells you the thing is *on top of* your screen
 * rather than part of an application. That was exactly the argument this
 * file's own history rejected for ordinary cards, and it holds here.
 *
 * Restrained to the same rules as everything else: a graphite tint rather
 * than translucent white, one real border, one plain ambient shadow. No
 * glow, no gradient, no accent-coloured background. The workflow's real
 * application icons inside are the only thing with any visual weight.
 *
 * `backdrop-blur` is included and is honest about what it does: over a
 * transparent window it has no desktop content to sample, so it frosts
 * nothing today and costs nothing. It is there so the card looks right
 * anywhere it is rendered over real content — a preview inside the app, a
 * future acrylic-backed window (see notificationWindow.ts). The tint,
 * border and shadow are what carry the material in the meantime.
 */
export const NOTICE_GLASS =
  'rounded-2xl border border-white/[0.09] bg-[rgba(17,18,20,0.82)] backdrop-blur-xl shadow-[0_24px_64px_-24px_rgba(0,0,0,0.8)]'


/** Form field recipes shared by the modals and the macro editor. */
export const FIELD_INPUT =
  'w-full rounded-md border border-white/10 bg-base-950 px-3 py-2 text-sm text-neutral-100'
export const FIELD_INPUT_MONO = `${FIELD_INPUT} font-mono`
/** Compact select used inside per-function cards (ModuleConfigModal). */
export const FIELD_INPUT_SM =
  'w-full rounded-md border border-white/10 bg-base-950 px-3 py-1.5 text-xs text-neutral-200'
export const FIELD_LABEL = 'mb-1.5 block text-[10px] uppercase tracking-widest text-neutral-500'
```

### Global CSS: font imports, base styles, keyframes, motion utilities

`src/renderer/src/styles/globals.css`

```css
@import '@fontsource-variable/sora/wght.css';
@import '@fontsource/inter/400.css';
@import '@fontsource/inter/500.css';
@import '@fontsource/inter/600.css';
@import '@fontsource/jetbrains-mono/400.css';
@import '@fontsource/jetbrains-mono/500.css';

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: light;
}

/* The app is dark, so its native scrollbars, selects and menus should be
   too. Set on #root, not the document root: on the root it would also give
   the transparent Noma Notice window an opaque dark canvas. */
#root {
  color-scheme: dark;
}

html,
body,
#root {
  height: 100%;
}

body {
  @apply bg-base-950 text-neutral-200 antialiased;
  font-feature-settings:
    'cv11',
    'ss01';
}

/* A single, purposeful entrance — used for the moment a workflow actually
   becomes an action (NomaMoment's success state). Physical and precise (a
   small rise + fade), never a flashy/AI-style reveal. */
@keyframes noma-settle {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* The same physical fade + rise as noma-settle, structurally, but shorter
   and meant to be applied per-element with an increasing `animation-delay`
   (see WorkflowChain.tsx) — a workflow's icon nodes reveal themselves in
   order, "a system being revealed," not everything dumped on screen at
   once. Kept as its own keyframe (identical values would be fine to share,
   but the two are conceptually different animations — one whole-card
   settle vs. one per-node stagger — and coupling them would make changing
   either one's timing independently a landmine later). */
@keyframes noma-node-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@layer base {
  /*
   * One visible-focus rule for every interactive element in the app,
   * rather than each button/input/select/modal re-styling its own focus
   * ring (or, more often, not doing so at all) — a single accessibility
   * fix at the root instead of a hundred individual ones. Keyed off
   * :focus-visible specifically, so a mouse click never shows a ring —
   * only real keyboard/switch-device navigation does.
   */
  button:focus-visible,
  a:focus-visible,
  input:focus-visible,
  select:focus-visible,
  textarea:focus-visible,
  [role='button']:focus-visible,
  [tabindex]:focus-visible {
    outline: 2px solid theme('colors.accent.DEFAULT');
    outline-offset: 2px;
  }
}

/* Noma Notice lives in a transparent, frameless window, so its document
   must not paint the app's page canvas — otherwise the "glass" card would
   sit on an opaque black rectangle the size of the whole window. Set as a
   class on <html> by renderer/src/main.tsx when it renders the notice
   surface, rather than globally, because the same bundle also renders the
   ordinary app window, which does want its canvas. */
html.noma-notice-surface,
html.noma-notice-surface body,
html.noma-notice-surface #root {
  background: transparent;
  overflow: hidden;
}

/* Enters from below, like a surface sliding into place rather than a
   notification popping. Deliberately undramatic: no scale, no bounce, no
   overshoot — the point is that you notice it in peripheral vision and are
   not pulled away from what you were doing. Reduced motion drops the
   movement entirely and keeps only the fade (see usePrefersReducedMotion). */
@keyframes noma-notice-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Leaves the way it came, a little shorter and a little less far — an exit
   should be quieter than an entrance. */
@keyframes noma-notice-out {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(8px);
  }
}


/* Glide's gesture demonstration (GlideGestureDemo.tsx): a fingertip resting
   on the palm rest slides onto the trackpad, first on the left, then on the
   right, and the zone it lands in lights up. Plain transforms and opacity;
   reduced motion shows the still frame instead. */
@keyframes glide-finger-left {
  0%, 8% { transform: translateX(0); opacity: 0; }
  14% { transform: translateX(0); opacity: 1; }
  30% { transform: translateX(46px); opacity: 1; }
  38%, 100% { transform: translateX(46px); opacity: 0; }
}
@keyframes glide-finger-right {
  0%, 50% { transform: translateX(0); opacity: 0; }
  56% { transform: translateX(0); opacity: 1; }
  72% { transform: translateX(-46px); opacity: 1; }
  80%, 100% { transform: translateX(-46px); opacity: 0; }
}
@keyframes glide-zone-left {
  0%, 26% { opacity: 0; }
  30%, 40% { opacity: 1; }
  50%, 100% { opacity: 0; }
}
@keyframes glide-zone-right {
  0%, 68% { opacity: 0; }
  72%, 82% { opacity: 1; }
  92%, 100% { opacity: 0; }
}
.glide-finger-left { animation: glide-finger-left 4.2s ease-in-out infinite; }
.glide-finger-right { animation: glide-finger-right 4.2s ease-in-out infinite; }
.glide-zone-left { animation: glide-zone-left 4.2s ease-in-out infinite; }
.glide-zone-right { animation: glide-zone-right 4.2s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .glide-finger-left, .glide-finger-right, .glide-zone-left, .glide-zone-right { animation: none; }
}

/* Shared motion primitives. Transform/opacity only, ease-out, no looping. */
:root {
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);
}
@keyframes noma-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes noma-rise-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes noma-scale-in { from { opacity: 0; transform: translateY(8px) scale(0.97); } to { opacity: 1; transform: none; } }
.noma-fade-in { animation: noma-fade-in 180ms var(--ease-out-quart) both; }
.noma-rise-in { animation: noma-rise-in 220ms var(--ease-out-expo) both; }
.noma-scale-in { animation: noma-scale-in 240ms var(--ease-out-expo) both; }
.noma-page-in { animation: noma-rise-in 220ms var(--ease-out-expo) both; }
/* Exits: shorter than the matching enter, ease-in so they leave quickly. */
@keyframes noma-fade-out { from { opacity: 1; } to { opacity: 0; } }
@keyframes noma-scale-out { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(6px) scale(0.98); } }
@keyframes noma-drop-out { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(4px); } }
.noma-fade-out { animation: noma-fade-out 160ms ease-in both; }
.noma-scale-out { animation: noma-scale-out 160ms cubic-bezier(0.4, 0, 1, 1) both; }
.noma-page-out { animation: noma-drop-out 120ms ease-in both; pointer-events: none; }
/* Collapse a dismissed block: wrap content in an overflow-hidden child. */
.noma-collapse { display: grid; grid-template-rows: 1fr; transition: grid-template-rows 180ms ease-in, opacity 150ms ease-in; }
.noma-collapse[data-closing='true'] { grid-template-rows: 0fr; opacity: 0; pointer-events: none; }
.noma-press { transition: transform 150ms var(--ease-out-quart), background-color 150ms, border-color 150ms, color 150ms, opacity 150ms; }
.noma-press:active:not(:disabled) { transform: scale(0.98); }
/* Stagger helper: style={{ animationDelay: `${i * 40}ms` }} with noma-rise-in. */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition-duration: 0.01ms !important; }
  .mc-lift, .mc-lift:hover, .mc-lift:active { transform: none; }
}
```

### Content motion classes

`src/renderer/src/styles/motion-content.css`

```css
/* Content motion (mc-*): transform/opacity only, plays once on mount. */
:root { --mc-ease: var(--ease-out-expo); }

@keyframes mc-bar { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@keyframes mc-check { from { stroke-dashoffset: 24; } to { stroke-dashoffset: 0; } }
@keyframes mc-pop { from { opacity: 0; transform: scale(0.6); } to { opacity: 1; transform: none; } }

.mc-rise { animation: noma-rise-in 320ms var(--mc-ease) backwards; animation-delay: var(--mc-delay, 0ms); }
.mc-fade { animation: noma-fade-in 300ms ease-out backwards; animation-delay: var(--mc-delay, 0ms); }

.mc-stagger > * { animation: noma-rise-in 320ms var(--mc-ease) backwards; }
.mc-stagger > :nth-child(2) { animation-delay: 40ms; }
.mc-stagger > :nth-child(3) { animation-delay: 80ms; }
.mc-stagger > :nth-child(4) { animation-delay: 120ms; }
.mc-stagger > :nth-child(5) { animation-delay: 160ms; }
.mc-stagger > :nth-child(6) { animation-delay: 200ms; }
.mc-stagger > :nth-child(7) { animation-delay: 240ms; }
.mc-stagger > :nth-child(n+8) { animation-delay: 280ms; }

.mc-bar { transform-origin: bottom; animation: mc-bar 420ms var(--mc-ease) backwards; animation-delay: var(--mc-delay, 0ms); }
.mc-check path { stroke-dasharray: 24; animation: mc-check 260ms ease-out backwards; }
.mc-pop { animation: mc-pop 220ms var(--mc-ease) backwards; }

.mc-lift { transition: transform 180ms var(--mc-ease), border-color 150ms ease-out; }
.mc-lift:hover { transform: translateY(-2px); }
.mc-lift:active { transform: translateY(0) scale(0.995); }
```

### Buttons

`src/renderer/src/components/Button.tsx`

```tsx
import type { ReactNode } from 'react'

interface ButtonProps {
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}

/** Low-emphasis text button (Cancel / Discard). */
export function GhostButton({ onClick, children }: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-300"
    >
      {children}
    </button>
  )
}

const PRIMARY =
  'rounded-md border border-accent-muted bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition-transform duration-150 hover:bg-accent/20 active:scale-[0.97]'
const PRIMARY_DIM = 'disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100'

/** Accent-outlined confirm button (Save / Create). `dimDisabled={false}` keeps the disabled state unstyled. */
export function PrimaryButton({
  onClick,
  disabled,
  dimDisabled = true,
  children
}: ButtonProps & { dimDisabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={dimDisabled ? `${PRIMARY} ${PRIMARY_DIM}` : PRIMARY}
    >
      {children}
    </button>
  )
}
```

### Modal shell

`src/renderer/src/components/Modal.tsx`

```tsx
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { GLASS_PANEL, MODAL_SCRIM } from '../lib/surfaces'
import { useBackdropDismiss } from '../lib/useBackdropDismiss'

interface ModalProps {
  onClose: () => void
  /** id of the heading inside; becomes aria-labelledby. */
  titleId?: string
  size?: 'md' | 'lg'
  /** Cap the panel at 90vh and scroll its content. */
  scroll?: boolean
  className?: string
  /** Rendered inside the scrim after the panel (e.g. a nested modal). */
  overlay?: ReactNode
  children: ReactNode
}

const EXIT_MS = 160
const EXIT_FALLBACK_MS = 250

const ModalCloseContext = createContext<(() => void) | null>(null)

/** Close the enclosing Modal with its exit animation. Falls back to `fallback` outside a Modal. */
export function useModalClose(fallback?: () => void): () => void {
  const ctx = useContext(ModalCloseContext)
  return ctx ?? fallback ?? (() => {})
}

/** Open modals, topmost last, so Escape only closes the front one. */
const openModals: symbol[] = []

/** Scrim + glass panel with backdrop-click and Escape dismissal, and an exit animation. The panel must stay the scrim's first child. */
export function Modal({ onClose, titleId, size = 'md', scroll = false, className, overlay, children }: ModalProps) {
  const [closing, setClosing] = useState(false)
  const closingRef = useRef(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const finish = useCallback((): void => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    onCloseRef.current()
  }, [])

  const requestClose = useCallback((): void => {
    if (closingRef.current) return
    closingRef.current = true
    setClosing(true)
    timer.current = setTimeout(finish, EXIT_FALLBACK_MS)
  }, [finish])

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])

  useEffect(() => {
    const id = Symbol('modal')
    openModals.push(id)
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && openModals[openModals.length - 1] === id) requestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      openModals.splice(openModals.indexOf(id), 1)
    }
  }, [requestClose])

  const backdrop = useBackdropDismiss(requestClose)
  const panel = [
    scroll ? 'max-h-[90vh] overflow-y-auto' : '',
    size === 'lg' ? 'w-full max-w-lg p-6' : 'w-full max-w-md p-6',
    GLASS_PANEL,
    closing ? 'noma-scale-out' : '',
    className ?? ''
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <ModalCloseContext.Provider value={requestClose}>
      <div
        className={`${MODAL_SCRIM}${closing ? ' noma-fade-out' : ''}`}
        style={closing ? { pointerEvents: 'none' } : undefined}
        // The scrim's own fade-out ends the exit; nested modals' events bubble with another target.
        onAnimationEnd={(event) => {
          if (closing && event.target === event.currentTarget && event.animationName === 'noma-fade-out') finish()
        }}
        {...backdrop}
      >
        <div role="dialog" aria-modal="true" aria-labelledby={titleId} className={panel}>
          {children}
        </div>
        {overlay}
      </div>
    </ModalCloseContext.Provider>
  )
}

/** A button that closes the enclosing Modal with its exit animation. */
export function ModalCloseButton({
  children,
  className,
  autoFocus
}: {
  children: ReactNode
  className?: string
  autoFocus?: boolean
}) {
  const close = useModalClose()
  return (
    <button type="button" autoFocus={autoFocus} onClick={close} className={className}>
      {children}
    </button>
  )
}
```

### Toggle switch

`src/renderer/src/components/ToggleSwitch.tsx`

```tsx
interface ToggleSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}

/**
 * The knob starts at the left edge of the track's content box and slides by
 * a transform so the move animates. Travel is the content width (44px track
 * minus 2px border and 4px padding = 38px) minus the 16px knob = 22px.
 */
export function ToggleSwitch({ checked, onChange, label }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`flex h-6 w-11 shrink-0 items-center rounded-full border p-0.5 transition-colors duration-200 ${
        checked ? 'justify-start border-accent-muted bg-accent/30' : 'justify-start border-white/15 bg-base-800'
      }`}
    >
      <span
        className={`h-4 w-4 rounded-full transition-[transform,background-color] duration-200 ease-out ${checked ? 'translate-x-[22px] bg-accent' : 'translate-x-0 bg-neutral-500'}`}
      />
    </button>
  )
}
```

### Empty state

`src/renderer/src/components/EmptyState.tsx`

```tsx
/**
 * The shared "nothing here yet" treatment; reused everywhere Noma hasn't
 * learned something yet. Optimistic, not clinical: no data isn't a bug,
 * it's an honest starting state. Plain text, no icon, no dashed box.
 * Whitespace alone marks it as a quiet moment on the page.
 */
export function EmptyState({ title, hint }: { title?: string; hint: string }) {
  return (
    <div className="py-2">
      {title && <p className="text-base font-medium text-neutral-100">{title}</p>}
      <p className={`${title ? 'mt-1.5 ' : ''}max-w-md text-sm leading-relaxed text-neutral-600`}>{hint}</p>
    </div>
  )
}
```

### Control tile (the keycap)

`src/renderer/src/components/ControlTile.tsx`

```tsx
import type { Application, Control } from '@shared/types'
import { actionCaption, actionGlyph } from '../lib/describeAction'
import { KEYCAP_SHADOW } from '../lib/surfaces'
import { AppIcon } from './AppIcon'
import { GLIDE_ZONE_LABELS, glideZoneForSlot } from '@shared/constants'
import { useGlideStore } from '../stores/glideStore'

interface ControlTileProps {
  slot: number
  control: Control | undefined
  /** The application this control's profile belongs to; every tile in a
   *  grid shares the same one, so its `AppIcon` is what gives the whole
   *  grid an immediate visual identity (see product brief section 11).
   *  Optional: callers outside an application-scoped grid (none today)
   *  simply omit it and get the tile's plain layout. */
  application?: Application | null
}

/**
 * A single physical control, read-only; the Home/Controls page's "what
 * does this button do" view. Deliberately tactile rather than a dashboard
 * tile: a small, bordered rectangle referencing the real hardware key, the
 * control's name as the one confident statement on it, and its real
 * shortcut (never an invented description) set in mono underneath. Solid
 * graphite material (Card fill + a real border), not translucent glass.
 * An earlier version had a colored blue glow on hover, which read as an
 * "AI-related" decoration rather than a physical control; the hover
 * feedback now is exactly what a real keycap gives: it lifts slightly, its
 * edge brightens a touch, nothing more. An empty slot stays flat, since
 * there's nothing to press yet. See VirtualControlButton for the
 * interactive twin used on the Virtual Keyboard page.
 */
export function ControlTile({ slot, control, application }: ControlTileProps) {
  const caption = actionCaption(control?.action)
  const glyph = actionGlyph(control?.action)
  const zoneCount = useGlideStore((state) => state.state?.zoneCount ?? 4)
  const zone = glideZoneForSlot(slot, zoneCount)

  return (
    <div
      className={`flex aspect-[4/3] flex-col justify-between rounded-2xl border border-base-700 bg-base-850 p-4 transition-all duration-150 ${KEYCAP_SHADOW} ${
        control
          ? 'hover:-translate-y-0.5 hover:border-base-600 active:translate-y-0 active:scale-[0.98]'
          : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-neutral-500">
          {zone ? GLIDE_ZONE_LABELS[zoneCount][zone] : `Control ${slot}`}
        </span>
        {glyph && <span className="text-sm text-neutral-500">{glyph}</span>}
      </div>
      {application && (
        <AppIcon applicationId={application.id} name={application.name} size={32} variant="tile" />
      )}
      <div>
        <div className="truncate text-sm font-medium tracking-wide text-neutral-100">
          {control?.label ?? <span className="text-neutral-500">–</span>}
        </div>
        {caption && <div className="mt-1 truncate font-mono text-xs text-neutral-500">{caption}</div>}
      </div>
    </div>
  )
}
```

### Sidebar nav row (extracted from AppShell.tsx)

`src/renderer/src/components/AppShell.tsx`

```tsx
function NavRow({ label, page, Icon, isActive, onClick }: NavItem & { isActive: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-[color,background-color,border-color,transform] duration-150 ease-out active:scale-[0.98] ${
        isActive
          ? 'border border-accent/25 bg-accent/[0.12] font-medium text-accent'
          : 'border border-transparent text-neutral-400 hover:text-neutral-100'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  )
}
```

### Patterns that exist only as repeated class strings (no shared component yet)

These are the ones I would expect a revamp to turn into named components or tokens:

```
Page title:        font-display text-2xl font-semibold text-neutral-100        (some pages: text-xl; Home: text-3xl)
Section heading:   font-display text-lg font-semibold text-neutral-100
Card eyebrow:      text-xs uppercase tracking-widest text-neutral-500           (also text-[10px] and text-[11px] variants)
Body text:         text-sm text-neutral-400
Hint / caption:    text-xs text-neutral-500 / text-neutral-600
Page container:    mx-auto max-w-2xl|3xl|4xl px-10|12 py-10|16
Section spacing:   mb-8 | mb-10 | mb-12 | mb-14  (varies by page)
Text link:         text-xs text-accent hover:opacity-80
Segmented rows:    flex items-baseline justify-between gap-3 text-sm
```
