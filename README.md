# v-block

A small, dependency-free Chrome Manifest V3 extension for desktop YouTube.
No npm install, bundler, remote scripts, telemetry, or recurring background timer.

## Install

1. Extract this ZIP to a permanent folder.
2. Open chrome://extensions and enable Developer mode.
3. Disable your old v-block extension to avoid duplicate copies.
4. Click Load unpacked and select the extracted v-block folder containing manifest.json.
5. Refresh any already-open YouTube tabs.
6. Pin v-block through Chrome's Extensions menu. Click it to change settings.

Use this complete folder as the replacement for your earlier prototype. Your
uploaded files are preserved separately. Chrome generates `_metadata` itself;
do not copy the old generated `_ruleset1`. The example.com test rule and test.html
are not part of this version.

## What it does

- Blocks requests to three advertising-domain families only when initiated by YouTube.
- Hides explicit ad placement elements on www.youtube.com.
- Experimental video handling clicks visible Skip buttons. If none is available,
  it mutes a video only while the player has YouTube's `ad-showing` class and
  attempts one seek to the end of a finite ad lasting at most two minutes.
- Restores the prior mute setting when the ad ends or filtering is disabled.
- Handles YouTube's in-page navigation and player replacement using debounced
  mutation observers and media events. The worker wakes only for lifecycle or
  setting changes. Page child-list mutations schedule at most one pending check.

The main toggle controls both network and cosmetic filtering. The second toggle
turns off video manipulation while retaining network and page filtering. Settings
are local to this browser; changes apply to open tabs without manual reload,
although already blocked requests may require a reload to recover.

## Important limitations

This is an experimental starter, not a verified replacement for a maintained
production blocker. Live YouTube ad blocking has NOT been verified in this build.
YouTube frequently changes its DOM and delivery behavior. Ads sharing video
infrastructure, server-inserted ads, anti-adblock screens, live streams, Shorts,
embedded videos and mobile YouTube are not reliably handled. Browser rules cannot
simply remove ad fields from a JSON response. Do not block googlevideo.com: doing
so can also block the videos you want to watch.

The seek behavior is best effort: some ads reject it; stale ad-state markup can
cause a mistaken seek. Turn off 'Skip video ads' if that happens. When seeking is
rejected, an ad may continue silently until its Skip button becomes available.
Changing mute manually during an ad may be overridden by restoration. No claim
of complete ad removal, zero delay, or bypassing YouTube's detection is made.

## Files

| File | Purpose |
| --- | --- |
| manifest.json | MV3 configuration and narrowly scoped page access |
| rules.json | Three YouTube-initiated advertising-domain blocking rules |
| background.js | Serialized settings changes and network-rule rollback |
| content.js | Ad-state detection, skip handling, mute restoration |
| content.css | Explicit ad-component selectors |
| index.html, script.js, style.css | Popup and settings |
| tests/ | Dependency-free Node tests using simulated browser APIs and DOM |

## Test

With Node.js 18 or later installed, run from this folder:

    node --test tests/*.test.cjs

Tests exercise normal-content protection, ad seeking, skip-button priority,
audio restoration, disabled behavior, long/live video protection, setting updates,
and rollback on storage failure. These are simulated tests, not browser integration
tests or proof of effectiveness against real YouTube ads.

Manual Chrome checklist:
1. Load unpacked; confirm chrome://extensions reports no manifest or rule errors.
2. Open a normal video. Verify volume, playback speed, seeking and navigation.
3. If an ad appears, inspect whether skipping works and audio returns afterward.
4. Toggle video skipping off during an ad; verify audio restores.
5. Toggle all filtering off, reload, and verify standard YouTube behavior returns.
6. Navigate among videos without reloading and repeat the check.
7. Restart Chrome; verify your saved toggle and rules remain consistent.
8. Test signed-in/out sessions separately; ad behavior can vary by session.

After editing files, click Reload on the extension card and refresh YouTube.
Update selectors in content.js/content.css if YouTube changes its markup.

## Permissions and privacy

`declarativeNetRequest` supplies request blocking; `storage` saves two booleans.
The content script only runs on https://www.youtube.com/* (top frame).
No history, cookies, account data, external analytics, or browsing records are
collected or transmitted. Network rules also cover requests initiated by other
YouTube subdomains, but cosmetic and video handling target desktop www only.

## Reference documentation

- https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest
- https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts
