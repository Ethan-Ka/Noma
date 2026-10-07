// Waitlist form endpoint (Formspree).
//
// 1. Create a free account at https://formspree.io and add a new form.
// 2. Copy its endpoint. Looks like https://formspree.io/f/xxxxxxxx
// 3. Paste it below. That's it; no other code changes needed.
//
// Until this is set, the waitlist form renders normally but shows a small
// "not connected yet" notice instead of submitting.
export const WAITLIST_ENDPOINT = 'https://formspree.io/f/xljedono'

// Issue reports from /feedback. Shares the waitlist's Formspree form for now;
// each report's subject starts "Noma issue report" so they're easy to tell
// apart. To keep them separate, add a second form in Formspree and paste its
// endpoint here instead.
export const FEEDBACK_ENDPOINT = WAITLIST_ENDPOINT

// Public contact address, and a mailto: link to it (optionally with a subject).
export const CONTACT_EMAIL = 'hello@nomashift.com'
export const MAILTO = (subject?: string) =>
  `mailto:${CONTACT_EMAIL}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`

// Inline text-link style shared by the prose pages.
export const LINK_CLASS = 'text-accent-bright transition-colors hover:text-accent'
