# v-block

A lightweight Chrome extension that reduces advertising interruptions on desktop YouTube through network filtering, cosmetic filtering, and experimental video-ad skipping.

Built with vanilla JavaScript, HTML, and CSS using Chrome's Manifest V3 extension platform. No frameworks, runtime dependencies, or build step are required.

## Overview

v-block explores how a small browser extension can combine declarative request blocking with page-level ad detection. Its scope is deliberately focused: a short network ruleset, explicit ad-element selectors, and an event-driven content script for YouTube's player.

Video-ad handling is experimental. The project does not guarantee complete ad removal, and its effectiveness against live YouTube ads has not been established by the automated tests.

## Features

- **Network filtering:** Blocks requests to three advertising-domain families when initiated by YouTube.
- **Cosmetic filtering:** Hides recognized ad placements on desktop YouTube.
- **Video-ad handling:** Clicks visible Skip buttons or attempts to mute and seek past short videos explicitly marked as ads by the player.
- **Skip notification:** Shows a two-second toast in the top-right corner when v-block clicks Skip or seeks past an ad.
- **Audio restoration:** Restores the prior mute setting when an ad ends or video-ad handling is disabled.
- **Popup controls:** Provides separate controls for overall filtering and experimental video-ad handling.
- **Persistent preferences:** Saves settings locally and applies changes to open YouTube tabs.
- **Navigation support:** Responds to YouTube's in-page navigation and player replacement.

## Project Structure

| Path | Responsibility |
| --- | --- |
| `manifest.json` | Declares permissions, content scripts, the popup, icons, and network ruleset. |
| `background.js` | Serializes settings changes and rolls back network-rule changes if saving preferences fails. |
| `content/content.js` | Observes page and player changes, detects ad state, and handles skip requests, notifications, and mute restoration. |
| `content/content.css` | Hides known ad components while filtering is enabled and styles the skip toast. |
| `popup/index.html` | Defines the popup interface. |
| `popup/script.js` | Loads preferences and handles popup controls. |
| `popup/style.css` | Styles the popup interface. |
| `assets/logo.png` | Provides the extension and popup logo. |
| `rules/rules.json` | Defines YouTube-initiated advertising requests for Chrome to block. |
| `tests/background.test.cjs` | Tests settings updates, message validation, and network-rule rollback. |
| `tests/content.test.cjs` | Tests content-script behavior using simulated browser APIs and player elements. |
| `.gitignore` | Excludes generated files such as Chrome's `_metadata/` directory from version control. |
| `README.md` | Documents the project, installation, testing, and limitations. |

## How It Works

The content script uses debounced mutation observers and media events rather than a continuous polling loop. The background service worker handles lifecycle and settings events without a recurring timer. These choices keep the implementation small; browser performance has not been benchmarked.

Video manipulation requires the player's `ad-showing` class. Seeking is limited to finite videos lasting at most two minutes, with one attempt per source-and-duration combination during an ad session. The extension does not change playback speed or broadly block video-delivery domains.

## Installation

1. Clone or download the repository and extract it if necessary.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Select **Load unpacked** and choose the folder containing `manifest.json`.
4. Refresh any open YouTube tabs.

The extension popup controls filtering and video-ad skipping. After source changes, reload the extension and refresh YouTube to load the updated content script.

## Testing

With Node.js 18 or later, run from the repository root:

```bash
node --test tests/*.test.cjs
```

The test suite covers settings updates, rollback on storage failure, malformed messages, normal-video protection, ad seeking, skip-button priority, skip notifications, audio restoration, and disabled behavior.

These tests simulate browser APIs and player state. They do not validate Chrome's rule loading, current YouTube markup, real ad delivery, or browser performance. Browser testing should isolate v-block from other adblockers and check playback, audio restoration, toggles, and navigation between videos.

## Limitations

- YouTube can change its player markup and ad delivery, requiring updates to detection logic and selectors.
- Some ads reject seeking or share infrastructure with ordinary videos; network rules alone cannot reliably distinguish them.
- Stale ad-state markup can cause an incorrect seek. Video-ad handling can be disabled independently if playback is affected.
- Manual mute changes during an ad may be overridden when the original setting is restored.
- Server-inserted ads, anti-adblock screens, live streams, Shorts, embedded players, and mobile YouTube are not reliably supported.

Page filtering and player handling target `https://www.youtube.com/*`. Network rules also apply to requests initiated by other YouTube subdomains.

## Privacy and Permissions

| Permission | Purpose |
| --- | --- |
| `declarativeNetRequest` | Enables declarative network-request blocking. |
| `storage` | Stores the two local preference values. |

v-block has no analytics, remote scripts, or external backend. It does not collect or transmit browsing history, cookies, account information, or viewing records.
