# Brief for Claude Design: choose a better typeface for Noma

## What I need

Pick a better type system for the Noma desktop app. I'm not happy with the current fonts. Give me three distinct directions, each shown on the real screens described below (not on specimen text), with a one-line reason for every face and a recommendation for which direction to ship.

## The product

Noma is an Electron desktop app (Windows first, macOS too). It gives every app four actions you run by sliding a finger from the palm rest onto a laptop trackpad (Glide), and it notices shortcut sequences you repeat so you can save one to a zone (Flow). Users are students who live in a few apps and give it a few minutes to prove itself. The interface should feel calm, precise and a little tactile, like good hardware, not like a SaaS dashboard.

## Current fonts

- Display: Sora (variable). Used for page titles, section headings, the big greeting.
- Body and UI: Inter, weights 400, 500, 600.
- Technical: JetBrains Mono, weights 400, 500. Used for keyboard shortcuts (Ctrl+F5) and log labels.

Inter is the default every AI-built interface reaches for, so it makes the app read as generic. Sora's wide, geometric display shapes also feel generic at heading sizes. Tell me honestly what is working and what is not before proposing replacements.

## Where type has to work

The UI is dark (near-black background, neutral grey text) and dense. Real sizes and roles:

- Page title: about 24 to 30px, semibold. Example: "Glide is ready."
- Section heading: about 18px, semibold. Examples: "What each zone does", "Your workflows", "Suggestions".
- Body and descriptions: 14px, regular, mid grey on near-black. Example: "Flick in quickly."
- Small text: 12px. Example: "Last used 4m ago".
- Tracked uppercase labels: 10 to 11px, wide letter-spacing. Examples: "GLIDE ZONES", "NOMA DEVICE", "UPPER LEFT". These are the hardest case; the face must stay legible small, tracked and uppercase.
- Control labels on tiles, all caps and short (12 characters max, because they also appear on a tiny physical display): RUN, DEBUG, TERMINAL, PLAY / PAUSE, MUTE.
- Shortcut captions in mono: Ctrl+F5, Meta+Shift+F, F5.
- Numbers: "Used 13 times", "0 steps", clock times. Tabular figures help.
- Buttons and tabs: 12 to 14px, medium weight. Examples: "Switch window", "Save", "+ New Macro".

## Hard constraints

- Free to use and bundle (SIL OFL or similar). The app is installed offline, so the font is self-hosted and shipped inside the app (we use Fontsource packages). Tell me the package name or source for each pick.
- Renders well on both Windows (ClearType) and macOS at 10 to 14px. Flag any face that is poor at small sizes on Windows.
- A variable font is preferred; otherwise name the exact static weights needed. Keep the total shipped weight small.
- Latin coverage including punctuation and arrows (→) is enough for now.
- No more than two families for UI text, plus a monospace for shortcuts if it earns its place. For each family, say in one sentence what it is doing in this app.

## Avoid

- Inter, Roboto, Space Grotesk, Poppins and other faces that signal a default choice. If one of them is genuinely the right call, say why in a sentence.
- Pairing a decorative display face with a neutral sans just to create contrast.
- Any face that only looks good at 48px. Most of this app is 12 to 14px.

## What to deliver

1. A short critique of the current Sora, Inter and JetBrains Mono setup on these screens.
2. Three directions, for example one humanist, one grotesque or neo-grotesque, and one with a distinctive technical personality. For each: the families, weights, sizes and tracking for each role above, and the reasoning.
3. The same three screens rendered in each direction: the Home page (greeting, a suggestion card, four control tiles with a mono shortcut caption), the Glide zones panel (four zone rows with uppercase labels), and a settings card (heading, small description, toggle, buttons).
4. A recommendation, and the exact Fontsource packages and CSS font-family stacks to use, including fallbacks.
