# Noma v0.1 beta: testing guide

Thanks for trying Noma. This takes about five minutes to set up.

## What you need

- **Windows 10 or 11 laptop with a precision touchpad.** Check: Settings >
  Bluetooth & devices > Touchpad. If it says "Your PC has a precision
  touchpad", Glide can work. If not, Glide can't run on your laptop (Noma
  will tell you); Flow and the rest still work.
- Tested so far on **one** laptop: ASUS ROG Zephyrus G14 (ASUS Precision
  Touchpad). Every other model is untested, which is exactly what this beta
  is for. Please tell us your laptop model.
- macOS: Glide is not available. Not part of this beta.

## Install

1. Download `Noma-Setup-0.1.x.exe` from the link you were sent.
2. Run it. It installs for your user only (no admin prompt). Windows
   SmartScreen may warn because the installer isn't code-signed yet: choose
   "More info" > "Run anyway".
3. Noma opens and walks you through four short screens.

## What to try

1. **Glide.** Rest a fingertip on the palm rest *beside* the trackpad and
   flick it onto the trackpad. Left or right side, upper or lower half,
   picks one of four actions. While Noma's own window is in front, swipes
   are practice only. Then switch to Chrome (or VS Code / Spotify) and swipe
   for real.
2. **Change a zone.** Glide page > pick an app > click a zone > choose a
   shortcut. Try it in an app you use a lot ("Set up" any app Noma has seen).
3. **Flow.** Turn it on, then work normally. When you repeat the same
   shortcut sequence about three times (for example Ctrl+D then Ctrl+W in
   Chrome), a suggestion appears. Click "Review steps", check what it will
   do, and save it to a zone. Then swipe that zone.
4. **Turn it off.** Glide can be switched off from the Glide page, Settings,
   or the tray icon (right-click the Noma icon by the clock).

## Known limitations

- Glide's thresholds were tuned on one touchpad. Missed swipes or
  accidental ones on your laptop are the most useful thing you can report.
  Glide page > Touch check gives you numbers to include.
- A quick inward flick from the very edge during normal use can still fire
  (about 1 in 40 touches in our own test).
- Swipes right after typing are ignored on purpose (about 0.6 s).
- Flow only sees shortcuts that hold Ctrl, Alt or Win, plus app switches.
  It never sees typing, so "type then press Enter" workflows can't be
  learned.
- A saved workflow that clicks a button by position (apps without named
  buttons) can miss if the window looks different. The review screen warns
  about these steps.
- A workflow stops at the first step that fails and tells you which. You can
  stop one mid-way from the bar at the top of Noma or from the tray menu;
  steps already done are not undone.
- Closing the window hides Noma to the tray; quit from the tray menu.

## What Noma stores, and where

Everything stays in `%APPDATA%\noma` on your laptop: settings, your zones,
saved workflows, and (if Flow is on) which app was in front, which modifier
shortcuts you pressed, and when. Never what you type, screenshots, or the
clipboard. Settings > "Clear learning data" or "Delete all data" removes it.
The only network request Noma makes is checking GitHub for updates.

## Reporting a problem

Settings > **Report a problem**:

1. "Open the issue page" opens an empty GitHub issue in your browser.
2. Describe what you did, what you expected, and what happened. Include your
   laptop model.
3. Optional: "Show technical details" shows a short summary (Noma version,
   Windows version, Glide and Flow settings, touchpad count, recent success
   or failure lines). Read it, then "Copy" and paste it if you're happy to.
   It never contains what you typed, your shortcuts, app or workflow names,
   or screenshots, and Noma never sends it on its own.

## Uninstall

Quit Noma from the tray, then Settings > Apps > Installed apps > Noma >
Uninstall. Noma doesn't start with Windows, so nothing keeps running. Your
data folder (`%APPDATA%\noma`) is kept in case you reinstall; delete it to
remove everything.
