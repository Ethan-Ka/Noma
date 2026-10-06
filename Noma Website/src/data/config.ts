// Waitlist form endpoint (Formspree).
//
// 1. Create a free account at https://formspree.io and add a new form.
// 2. Copy its endpoint — looks like https://formspree.io/f/xxxxxxxx
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
