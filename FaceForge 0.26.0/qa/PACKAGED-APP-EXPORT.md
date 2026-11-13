# Driving the packaged app without build hooks

FaceForge is a WPF window hosting WebView2. Synthetic OS clicks do not reach the page (background input
is dropped by the host and foreground delivery is refused while the WebView child holds focus), so a
GUI test of the *shipped* binary needs a different door. WebView2 reads
`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` from the environment of whatever launches it, which opens the
Chrome DevTools protocol on the released EXE with no code change and nothing to strip later.

## Launch

```powershell
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-port=9222'
Start-Process -FilePath '<extracted>\FaceForge-0.26.0-STANDALONE.exe'
```

Confirm the endpoint: `curl http://127.0.0.1:9222/json/version`.

## The repeatable check

`node qa/packaged-app-check.mjs` connects to that port and asserts the release-blocking basics: the
interface loads from `https://app.faceforge/`, the install is indexed, the bundled synthetic portrait
analyses, a request to another host is refused (the landmark library's usage logger is the reason),
and the window refuses to navigate away. Run it against the extracted download before publishing.

## Drive the page

The repo's own Playwright install is enough:

```js
const { chromium } = requireFromWeb("playwright");        // src/FaceForge.Web/package.json
const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
const page = browser.contexts()[0].pages()[0];

await page.locator('input[type="file"]').nth(0).setInputFiles(photo);   // 0 = front photo
await page.getByRole("button", { name: /^Analyze face$/i }).click();
await page.waitForFunction(() => !/Status:\s*Waiting/.test(document.body.innerText), null, { timeout: 240000 });

await page.getByRole("button", { name: /^hair$/i }).click();            // then .appearance-list button
await page.locator(".appearance-list button").nth(0).click();
```

File inputs, in order: front photo, left, right, video, extra angle, then the two `.jslot` template slots.
The appearance picker is `.appearance-guidance` → `.appearance-tabs` → `.appearance-list button`; each
entry's text names the part, its `plugin|FormID`, the sex and the valid-race list.

## The native save dialog

The export button opens a real `#32770` "Export ..." dialog. Drive it with UI Automation, not with the
page: find the window by title via `EnumWindows`, `AutomationElement::FromHandle`, then either
`ValuePattern` on the file-name box or `SetForegroundWindow` + `SendKeys('{ENTER}')` to accept the
default name in `Downloads`. The file-name element does not implement `ValuePattern`, so SendKeys is the
practical route; a second Enter dismisses the replace prompt.

## What this does not prove

Anything the game renders. It proves the packaged binary analyses a photo, writes a preset with typed
head parts, and converts a reshape into sculpt deltas. The RaceMenu load is still a human step:
`qa/RACEMENU-CHECKLIST-0.26.0.md`.
