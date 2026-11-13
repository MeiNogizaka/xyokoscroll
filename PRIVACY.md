# Privacy

xyokoscroll does not collect, transmit, or sell personal data.

## What the extension accesses

- Pages on `https://x.com/*` and `https://twitter.com/*` only, via Manifest V3 content scripts.
- The carousel already on the page: its slides, images, buttons, and scroll position, so a vertical wheel gesture can move to the previous or next image.
- `chrome.storage.local` for two settings: whether the wheel returns to the timeline at the first or last image (`releaseAtEdge`), and the options-page language (`uiLocale`: browser language, Japanese, or English).

## What it does not do

- No network requests of its own.
- No analytics, crash reporting, or telemetry.
- No cookies, account tokens, or post content are read for any purpose other than finding the carousel already on the page.
- No data is sent to the author or to a third party.
- No `localStorage` on x.com or twitter.com.

## Permissions

`storage` is the only Chrome permission. Host access is limited to x.com and twitter.com.

## Uninstall

Removing the extension deletes its `chrome.storage.local` data. It does not leave a key in the site's `localStorage`.
