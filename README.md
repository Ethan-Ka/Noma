<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./noma%20logo%20transparent.png">
  <img src="./noma%20logo%20transparent%20black.png" alt="Noma" width="96">
</picture>

# Noma

**Four actions per app, one swipe away.**<br>
Noma notices the shortcuts you keep repeating and puts them on your trackpad.

[![Status: beta](https://img.shields.io/badge/status-beta-4c7eff?style=flat-square)](https://nomashift.com/#beta)
[![Version 0.1.11](https://img.shields.io/badge/version-0.1.11-2a2d33?style=flat-square)](https://nomashift.com/#beta)
[![Windows and macOS](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-2a2d33?style=flat-square)](https://nomashift.com/#beta)

[**Download the beta**](https://nomashift.com/#beta) &nbsp;·&nbsp;
[Website](https://nomashift.com) &nbsp;·&nbsp;
[Report an issue](https://nomashift.com/feedback) &nbsp;·&nbsp;
[Docs](./Noma%20App/docs)

</div>

---

## What it is

Noma is a desktop app with two parts that work together:

- **Glide.** Slide a finger from the palm rest onto your laptop's trackpad and run an action in the app you are using. Every app gets its own four, one per zone (upper and lower half of each side), so a swipe in Chrome does something different from a swipe in Visual Studio Code. No extra hardware needed.
- **Flow.** Noma watches for shortcut sequences you repeat. After about three repeats it suggests turning that sequence into a single action. You see the exact steps, choose which Glide zone should run it, and only then is anything saved. Nothing runs without you.

The loop is simple: you are in an app, you swipe in from a side, and the action for that zone runs in that app. When Flow notices something you keep doing, you check its steps and put it on a zone.

## Download

Get the installer from **[nomashift.com](https://nomashift.com/#beta)**.

| | |
|---|---|
| **Windows** | `Noma-Setup.exe`, for computers with a precision touchpad |
| **macOS** | `Noma-arm64.dmg` for Apple silicon, `Noma-x64.dmg` for Intel |

The beta is not code-signed yet, so your computer asks once. On Windows choose **More info**, then **Run anyway**. On a Mac open **System Settings, Privacy & Security**, then **Open Anyway**.

Installed copies check [downloads.nomashift.com](https://downloads.nomashift.com) for updates at launch and every few hours. Windows installs them when Noma quits. An unsigned Mac build shows a notification that opens the download page instead.

> Glide on macOS is newer and has had less testing than on Windows. If a swipe from the right edge opens Notification Center, the Glide page offers to turn off that macOS gesture.

## Privacy

Flow records only which application was in front and which shortcuts you pressed that hold Control, Alt or the Windows key (Control, Option or Command on a Mac), and in what order. It never records what you type, and never takes screenshots. Everything stays in a local database on your computer. The details, and the rule any future capture has to keep, are in [`privacy-and-legal.md`](./Noma%20App/docs/privacy-and-legal.md).

## What's in this repo

| Folder | What it is |
|---|---|
| [`Noma App`](./Noma%20App) | The product. An Electron desktop app: application detection, Glide, Flow's pattern detection and suggestions, saved workflows, Macro Studio, and the real action executor. **Start here.** |
| [`Noma Website`](./Noma%20Website) | The public site at [nomashift.com](https://nomashift.com). React, Vite and Tailwind, pre-rendered. Its own codebase; nothing is shared with the app. |
| [`Noma Design`](./Noma%20Design) | The design system. A page documenting the current one, the briefs used to replace it, and the v5 proposals (see below). |
| [`Noma Virtual Device`](./Noma%20Virtual%20Device) | A small always-on-top window that acts as the eventual physical module (a screen and four buttons), for testing against the app before any hardware exists. |
| [`Noma Device Firmware`](./Noma%20Device%20Firmware) | An ESP32 sketch for the same module, with a parts list and wiring guide. Written against the documented protocol; not yet flashed or checked on real hardware. |
| [`Noma Software Prototype`](./Noma%20Software%20Prototype) | A separate, deliberately fake pre-hardware build used to test the idea with people. Standalone. |

No package is shared between these projects. Where something has to match across two of them (a color token, a protocol constant), it is copied by hand and noted where it is used.

### The physical device

A dedicated device is the long-term plan: a small display and buttons that change because Flow noticed something, not because someone configured a profile. Version 0.1 does not depend on it, and its UI stays behind developer tools. The software side (a hardware protocol, a simulator and a real serial transport) exists; the firmware is the next step to verify. See [`hardware-protocol.md`](./Noma%20App/docs/hardware-protocol.md).

## Development

```bash
# The app
cd "Noma App"
npm install
npm run dev          # opens the Electron app
npm test             # unit and component tests
npm run typecheck

# Package it
npm run dist:mac     # or dist:win

# The website
cd "Noma Website"
npm install
npm run dev
npm run build        # type-checks, builds, and pre-renders

# The device simulator (run the app first)
cd "Noma Virtual Device"
npm install
npm start
```

`Noma Device Firmware` is an Arduino sketch, not an npm project; see its README for the wiring and bring-up order.

Releases are cut by pushing a `vX.Y.Z` tag. GitHub Actions runs the tests on Windows and macOS, builds the installers, and uploads them to the download site. See [`RELEASING.md`](./Noma%20App/RELEASING.md).

## Design system

[`Noma Design`](./Noma%20Design) holds the design system:

- `noma-design-system-current.html`: the system as built, with measured contrast and its known problems. Open it in a browser.
- `Noma Design System v5.dc.html`: a proposed replacement in two directions, **Machined** (cool graphite, one cobalt accent) and **Display** (true black, white as the only accent). Each also has its own page.
- `claude-design-font-brief.md` and `claude-design-system-brief.md`: the briefs those proposals were made from.

## Read next

- [`Noma App/README.md`](./Noma%20App/README.md): a guided walkthrough of the app.
- [`docs/architecture.md`](./Noma%20App/docs/architecture.md): process layout, the learning loop, and how real execution is kept safe.
- [`docs/beta-testing-guide.md`](./Noma%20App/docs/beta-testing-guide.md): what to try and what to report.
- [`PRODUCT.md`](./Noma%20App/PRODUCT.md) and [`DESIGN.md`](./Noma%20App/DESIGN.md): who it is for, and the design rules.
- [`docs/product-audit.md`](./Noma%20App/docs/product-audit.md): the running audit of what is strong, missing and next.
- [`brainstorm.md`](./Noma%20App/brainstorm.md): the original product vision.

## Contact

Questions or bugs: [nomashift.com/feedback](https://nomashift.com/feedback) or hello@nomashift.com.

Copyright Noma. All rights reserved.
