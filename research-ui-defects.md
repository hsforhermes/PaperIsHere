# UI defect inventory — in-page surface + settings popup

Ticket: **#11 — "UI defect inventory: in-page surface and popup"**
Target: `/Users/hosseinsamani/Projects/PaperIsHere` @ 2.5.0 (`manifest.json`), read-only.
Files owning the UI: `content.js` (FAB, menu, link interception), `popup.html` + `popup.js`
(settings), `save.js` (label state machine), `page.js` (only what the menu can say).

> Nothing in the repo was modified and no git command was run. All measurements come from
> throwaway harnesses in
> `/private/var/folders/_5/7jt4yz8x57vb7cvwkbsrfk800000gn/T/opencode/wf/harness/`
> (extracted shadow CSS + real `content.js` running against a stubbed `chrome`), driven by
> headless Chrome. The ticket's output path overrides the repo's `docs/` convention; this
> file is not a repo artefact.

---

## 1. How this was produced (so the numbers are auditable)

| Method | What it covers |
|---|---|
| Code read of `content.js`, `popup.html`, `popup.js`, `save.js`, `page.js` | every claim about control flow, event wiring, ARIA |
| `getShadowStyles()` CSS extracted from `content.js` and rendered in a real page | menu geometry, widths, contrast, RTL, dark page |
| Real `page.js`/`save.js`/`content.js` loaded in a page with a stubbed `chrome.*` | duplicate/stale menu items, `detectCollisions()` behaviour |
| `popup.html` + `popup.js` (chrome stubbed) in headless Chrome | popup body heights, dropdown push, control semantics |
| Contrast computed from the literal hex values in both files | WCAG 1.4.3 / 1.4.11 maths |

Where a number appears below it is **measured** unless the row says *code-read*.

---

## 2. Verdict on the ticket's starting points

| Starting point | Verdict | What actually happens |
|---|---|---|
| `body{width:320px;padding:24px;border:2px}` under `border-box` | **Not a defect** | 320px total, 316px padding box, **268px** usable content width. Deliberate, consistent. |
| `.custom-select.active` drops `border-bottom`, `.custom-options` adds its own border, panel is in flow → pushes fields down | **Confirmed and worse** | Opening the naming dropdown moves everything below it **+240px**; the select itself collapses **47→45px** (2px jump on open and close); Save's top goes 352→592 and its bottom lands at **640px**, i.e. 8px of it inside Chrome's 600px popup cap. With Advanced open the body is **1213px** (1453px with the dropdown open). |
| `.hint-link{margin-top:-16px}` against the input above | **Selector confirmed, diagnosis wrong** | The gap is 4px (`input` has `margin-bottom:20px`), not an overlap. Real problems: it breaks the 8px label rhythm and the same class is used on a non-link privacy `<span>`. |
| `.paperishere-fab` 52×48, `border-left:none`, `0 4px 4px 0`; `.paperishere-menu{margin-left:10px}`; wrapper `fixed;bottom:78px`; container `absolute;bottom:0` | **Confirmed, cosmetic** | Measured: 52×48 at `left:0`, `bottom:78`, menu `left:10`. The 10px indent detaches the card stack from the flush tab (design language), it does not cause a functional failure. |
| `style.order` 1–8 + async append breaks visual order | **Wrong** | `order` makes the visual sequence deterministic: a button appended last with `order:2` renders **second** (verified in the live harness). The real bug at that seam is **duplicate and stale buttons**, not misordering — see #1. |
| `detectCollisions()` scans ≤600 elements, bottom-left band | **Confirmed, fatal** | A page with 703 candidates hides the banner at index 701: `detectCollisions()` returns 78 and the FAB sits on top of it. The identical banner at index 0 returns 110 (control run). |
| 15s auto-close fires mid-reading | **Confirmed, worse** | `mousemove` is not wired; only `mouseenter` on the menu, `click`, `focusin`, `mouseenter` on the FAB reset the timer. Moving the pointer *between* buttons does not reset it. |
| No focus management, no `role="menu"`, Escape twice | **Confirmed** | No `role`, no `aria-controls`, `aria-label` stays "Open PaperIsHere menu" while open, no `.focus()` call exists anywhere in `content.js`, `outline:none !important` on FAB and every button. Escape is handled twice (harmless, idempotent). |
| `FAB_SAVE_LABELS`/`LINK_SAVE_LABELS` replace text; failures carry no reason; spans reflow the host link | **Confirmed and quantified** | Save button width **197.2 → 148.7 → 108.7 → 86.0px** across pending/saved/failed then snaps back. A host `[PDF]` anchor grows **43.4 → 123.4px** and its paragraph goes **21 → 45px** (one line → two). `response.error` is sent to the log ring buffer only, never to the UI. |
| Dark host pages vs the white menu | **Confirmed** | FAB black-on-`#0d0d0d` = **1.08:1**. Menu buttons stay 21:1 white/black but their `4px 4px 0 #000` shadow disappears. |
| z-index vs cookie banners | **Misdiagnosed** | The wrapper is at `2147483647`; stacking is not the failure mode. The failure is geometric (`detectCollisions`, #5) plus `position:fixed` breaking under a transformed/filtered ancestor (code-read, #22). |
| text truncation on long button labels | **Wrong word** | No truncation exists: `white-space:nowrap`, no `max-width`, no ellipsis. Longest label is **287.7px** wide; the menu is 297.7px at `left:10` and fits a 320px viewport with 12px to spare, but overflows *any* narrower viewport with no wrap and no scroll. |
| contrast of `#7851A9` on white and on black | **Passes** | 5.92:1 on white (AA text), 3.55:1 on black (≥3:1 graphic). The colours that fail are the *other* accents — see #16. |
| `all: unset` + `!important` breaks host inheritance | **Half true** | Declared properties are immune (verified: host `letter-spacing:3px; font-size:22px` did not leak). Undeclared **inherited** properties do leak — `direction` actually breaks RTL hosts (#8). `!important` inside a shadow root cannot leak outward. |
| (extra check) global `input{}` rule hits the checkbox `#geminiOptIn` | **Not a defect** | Measured 13×13px, `padding:0`, `border:0`, `appearance:auto`; Chrome's native checkbox styling wins over the author `input` rule. No fix needed. |

---

## 3. Defect table — ordered by user impact

Severity: **P1** = wrong result or blocked task, **P2** = frequent friction / visibly broken, **P3** = polish.
Class: `logic` / `layout/CSS` / `design-language` (the ticket's two buckets, split where a row is both).

| # | Symbol / selector | User-visible symptom | Root cause | Class | Sev |
|---|---|---|---|---|---|
| 1 | `FABManager.populateMenu()` — `chrome.runtime.sendMessage({action:"checkUnpaywall"})` callback | After moving between articles on an SPA publisher, the menu shows **2–3 identical "Save PDF (Unpaywall)" rows**, and the extra rows carry the **previous article's** PDF URL. Clicking one downloads paper A while naming it with paper B's metadata. Measured: 2 × `create()` + one 500ms round-trip → 9 items, 3× `order:2`. | Callbacks append with `this.state.menu.appendChild(...)`, which is re-read *at callback time*. `create()` runs again on SPA URL change (`MutationObserver` → `initializeExtension` → `injectButtons` → `create()`), so a reply from the previous generation lands in the new menu. Nothing dedupes; `populateMenu`'s `innerHTML=''` cannot undo a callback that has not fired yet. | logic | **P1** |
| 2 | `popup.html` `.custom-select`, `.custom-option`, `.advanced-toggle`; `popup.js` click handlers | The two dropdowns (naming format, FAB enabled) and the Advanced toggle cannot be reached or operated by keyboard or screen reader. Both are `div`s: `tabIndex:-1`, `role:null`, **zero native `<select>` elements in the document** (measured). Enter/Space/arrows do nothing; a screen reader announces nothing. | A `<select>` was hand-replaced by a click-only widget; the hidden `<input type="hidden">` is the real value holder. Advanced toggle is a `div` with a click handler and no `aria-expanded`. | design-language (a11y wiring is a patch) | **P1** |
| 3 | `.custom-select.active{border-bottom:none}`, `.custom-options{display:block}` inside `.custom-select-wrapper{display:flex;flex-direction:column}` | Opening "Naming Format" pushes every field down **240px**; the Save button (`#saveBtn`) lands at 592–640px, clipped to an **8px sliver** by Chrome's 600px popup cap. The trigger also jumps **2px** taller/shorter on open/close. With Advanced open the body is **1213px** (1453px with the dropdown open) in a 600px window. | The option list is a normal-flow flex child instead of an overlay. The `border-bottom:none` / `border-top:none` seam is a visual hack that removes 2px of box. | layout/CSS | **P1** |
| 4 | `save.js directSave()` + `FAB_SAVE_LABELS` / `LINK_SAVE_LABELS` | One click makes the button *shrink three times*: 197.2 → 148.7 ("⏳ AI NAMING…") → 108.7 ("✔ SAVED!") → 86.0 ("✖ FAILED") and snap back 3s later. On an intercepted host link the target grows 43.4 → 123.4px and reflows the publisher's paragraph (21 → 45px, one line → two). Failures say only "✖ FAILED" with no reason; the pending label says "AI NAMING" even when Gemini is off and the name is deterministic. | The state machine replaces `innerHTML` with differently-sized inline-styled spans (`padding:2px 4px`, `font-weight:bold`, `font-size:10px`) on a `width:max-content` control; restore is a raw string round-trip. `response.error` (`CHROME_BLOCKED`, `TIMEOUT`, …) is logged, never displayed. | design-language + layout | **P1** |
| 5 | `FABManager.detectCollisions()` (`querySelectorAll('button,a,div,footer,aside,section,nav')`, `Math.min(candidates.length, 600)`) | On any content-heavy page (thousands of `div`s) the FAB sits **on top of** the site's cookie banner / bottom-left toolbar and blocks its buttons. Measured A/B: same fixed 100px banner at DOM index 0 → FAB lifted to 110px; at index 701 of 703 → FAB left at 78px and overlaps. | The scan only ever inspects the **first 600** matched elements in document order — on a real publisher page that window is entirely above the fold. Cost is also unearned: ~600 `getComputedStyle` + `getBoundingClientRect` reads per scroll rAF. | logic | **P2** |
| 6 | `getShadowStyles()` `.paperishere-menu` (no `max-height` / `overflow`) | On a short window (laptop with docked devtools, zoomed browser, split screen) the top of the menu is **off-screen and unreachable**: 8 items = 392px tall; at a 413px viewport the first ~117px is above y=0. Measured with 12 items: menu top **−281px**, 6 buttons unreachable. | The container is bottom-anchored (`bottom:0` inside a `position:fixed` wrapper); the menu grows upward with no cap, no scroll, and no top clamp. `updatePosition()` only measures obstructions in the bottom band, never the menu's own top. | layout/CSS | **P2** |
| 7 | `.paperishere-fab{background:#000;border:2px solid #000}` and `.paperishere-btn{background:#fff;box-shadow:4px 4px 0 #000}` | On a dark host page the FAB is effectively **invisible** (black on `#0d0d0d` = **1.08:1**, measured); the menu is a hard white slab whose black offset shadow disappears, so the stack looks unanchored. No `prefers-color-scheme`, no host-luminance probe. | One hard-coded light theme; the FAB's only separation from the page is its own black fill, which is also the page's likely background. | design-language | **P2** |
| 8 | `.paperishere-fab{all:unset!important}`, `.paperishere-container{align-items:flex-start}`, `.paperishere-menu{margin-left:10px}` on an RTL host | On an RTL page the FAB **leaves the screen edge** (measured `left:0` → **245.7px**), the 10px indent lands on the wrong side, and icon/text order mirrors inside every button. | `direction` is inherited and never declared in the shadow CSS; `all:unset` resolves inherited properties to `inherit`, and `align-items:flex-start`/`margin-left` are physical/logical-sensitive. (Host `letter-spacing`/`font-size` did **not** leak — only undeclared inherited props do.) | logic (1-line CSS) | **P2** |
| 9 | `FABManager.create()/openMenu()/closeMenu()`, `.paperishere-fab` | Keyboard/screen-reader use of the menu is degraded: no `role="menu"`/`menuitem`, no `aria-controls`, `aria-label` stays **"Open PaperIsHere menu"** while `aria-expanded="true"`, focus is never moved into the menu on open and is **dropped to `<body>`** on close (the focused anchor becomes `visibility:hidden`), and `outline:none !important` on FAB **and** every button removes the only visible focus cue. | ARIA attributes were added for `aria-expanded` only; no focus management and a global outline reset. | design-language + logic | **P2** |
| 10 | `FABManager.AUTO_CLOSE_DELAY_MS = 15000`, `startAutoCloseTimer()/resetInactivity()` | The menu closes itself after 15s while the user is still reading or deciding, with no countdown and no way to disable. | Timer reset is wired to `mouseenter` (fires once on entry only), `click` and `focusin`. Pointer movement inside the menu never resets it; there is no `mousemove`/`mouseover` listener. | logic | **P2** |
| 11 | `populateMenu()` Unpaywall branch (same async seam as #1, different fix) | ~0.3–1s after the menu opens, "Save PDF (Unpaywall)" **pops into the middle of the stack** and pushes the rows above it upward under the cursor — the natural next click then lands on the wrong action. | The menu is bottom-anchored and the insert has no reserved slot, no skeleton row, no entry animation; the button simply appears when `checkUnpaywall` answers. | layout/CSS | **P2** |
| 12 | `FABManager.attachEventListeners()` `outsideClickHandler` | Clicking the **8px gap between two menu buttons** (or the 10px indent strip) closes the menu, even though the pointer is inside the menu surface. | The handler hit-tests by class name on `composedPath()` (`paperishere-fab`, `paperishere-btn`, `paperishere-info-badge`) instead of testing "is this the menu subtree", so the menu's own padding/gaps/background count as outside. | logic | **P2** |
| 13 | `popup.html #reportIssueBtn` inside `#advancedOptions` | "Report Issue / Bug" — the escape hatch when the extension misbehaves — is hidden behind **Advanced Settings**, a collapsed panel a normal user never opens. | Markup placement; the button lives inside the advanced container that `toggleAdvancedBtn` collapses `display:none`. | design-language (IA) | **P2** |
| 14 | `.paperishere-btn` (`padding:10px 16px`, `white-space:nowrap`, `align-items:flex-start`) | The menu renders as a **ragged right edge**: measured widths 201.2 / 237.3 / 214.5 / 201.6 / 287.7 / 244.6 / 249.3 / 201.2px in one column, and each row changes width while saving (#4). Combined with the 10px indent vs the flush FAB, two radii (`0` on buttons, `0 4px 4px 0` on the tab) and a shadow on buttons but not on the tab, the tab metaphor reads as an accident. | Text-driven widths, no column width token, no `justify-content`, two different corner/shadow treatments in one component family. | design-language | **P3** |
| 15 | `populateMenu()` action set; `.paperishere-info-badge` | The menu never explains itself: a restricted page (`pageInfo.restricted === true`, computed in `page.js`, read by **nothing** in `content.js`) silently ships a menu with no "Save PDF (Direct)" row; the viewer badge reads **"USE SITE'S NATIVE PDF BUTTON ↗"** as a dead `<div>` (looks like a link, is not clickable, `↗` promises navigation); the FAB itself is a bare "+" with no `title`/tooltip. | `restricted` is used only as a suppression flag in `page.js`, and the badge was built as an info strip with link typography. | design-language | **P3** |
| 16 | `createDownloadButton(..., hoverColor)` → inline `color` on the icon span | Three of five accent icons fail the 3:1 non-text threshold on the button's white fill: emerald `#10B981` **2.54**, Anna's `#FF6B6B` **2.78**, Nexus `#24A1DE` **2.91** (measured). They were picked for the black hover state, where they pass. | One colour value is used as both a rest-state icon colour on white and a hover-state icon colour on black; no paired light/dark token. | design-language | **P3** |
| 17 | `fab.addEventListener('keydown', …Escape…)` + `document.addEventListener('keydown', escapeHandler)`; `createDownloadButton` `href="javascript:void(0);"` | Escape is handled twice (second path is the only one that works, since the first requires focus on the FAB) — harmless but dead code that hides intent. Two of eight buttons carry a `javascript:void(0)` href, so "copy link address" and middle-click expose `javascript:void(0);`. | Duplicated handler wiring; a JS-only action modelled as an `<a href>`. | logic | **P3** |
| 18 | `popup.js saveBtn` handler (`new URL(...).origin`, `.replace(/[<>:"\|?*]/g,'')`) | A mistyped domain is silently replaced with the hard-coded default and the folder name is silently rewritten; the popup still reports "SYSTEM UPDATED". The input keeps showing the user's text until reopening. | Validation happens only at save time, with `catch { default }` and no per-field feedback (`#status` is one shared line). | logic | **P3** |
| 19 | `popup.js` `chrome.storage.session` block; `.hint-link` after `#apiKey` | The Gemini key looks persistent but is session-only (gone after a browser restart) and the UI never says so. If `chrome.storage.session` is unavailable the key is **dropped** while the legacy local copy is removed in the same block — silent loss, no `minimum_chrome_version` in the manifest. | `if (chrome.storage.session)` skips the write, then `chrome.storage.local.remove(['geminiApiKey'])` runs unconditionally inside the same `try`. | logic | **P3** |
| 20 | `#status`, `showStatus()` | Two saves in a row: the first call's 3s timeout clears the **second** message early. The line is not `aria-live`, so screen readers never hear "SYSTEM UPDATED"; it has a fixed `height:16px` for 11px uppercase text. | `setTimeout` handle not stored/cleared; no live region. | logic | **P3** |
| 21 | `.hint-link` (`margin-top:-16px`) incl. the `<span>` variant | The hint sits **4px** under its input (measured), visibly tighter than the 8px label rhythm, and the Gemini privacy note is a `<span>` styled *identically* to the two clickable mirror links (9px, uppercase, right-aligned, `cursor:default` on the span only). | A negative-margin nudge instead of a spacing token, and one class reused for two different affordances. | design-language | **P3** |
| 22 | `#paperishere-ui-wrapper` inline `position:fixed` inside `document.body` | On sites whose `<body>`/`<html>` carries `transform`, `filter` or `perspective` (common in SPA shells and some reader modes) the wrapper stops being viewport-fixed, so the FAB can scroll away with the content or be clipped. Code-read only; not reproduced on a real site. | A fixed element's containing block becomes the nearest transformed ancestor; `bottom` then resolves against that box instead of the viewport. | layout/CSS | **P3** |

Rows 1 and 11 share one async seam but need different fixes (generation guard vs reserved slot), so both are listed; rows 3 and 4 both cause width jump but in different files and with different fixes.

---

## 4. One-line / small patch vs what needs the design system

The redesign should **not** rebuild these. Most of the list is a patch, and a rewrite that keeps the
same async seam will reproduce #1 and #11 exactly.

### 4a. One-line to ~5-line patches (no design decision required)

| # | Patch |
|---|---|
| 1 | Capture the generation before the async call, drop late replies: `const menu = this.state.menu;` … in the callback `if (menu !== this.state.menu) return;` (2 lines, one per callback). |
| 3 | `.custom-options{position:absolute;top:100%;left:0;right:0;z-index:10}` + drop `.custom-select.active{border-bottom:none}`. Kills the 240px push and the 2px jump in one line. |
| 5 | Replace the 600-element scan with `document.elementsFromPoint(40, innerHeight - 16)` (plus a couple of probe points) — constant time *and* correct on any page size. |
| 6 | `.paperishere-menu{max-height:calc(100vh - 160px);overflow-y:auto}`. |
| 8 | `direction:ltr !important` (or `:host{direction:ltr}`) on `.paperishere-container`. |
| 10 | Delete the timer, or add `menu.addEventListener('mousemove', resetInactivity)` **and** a visible countdown; a timer nobody can see is the bug. |
| 12 | `const p = e.composedPath(); if (p.includes(this.state.menu) \|\| p.includes(this.state.fab)) return;` — subtree test instead of the three class checks. |
| 13 | Move `#reportIssueBtn` out of `#advancedOptions` in the markup. |
| 17 | Delete the `fab` keydown listener; give JS-only buttons `href="#"` + `role` or a `<button>`. |
| 20 | Store the `showStatus` timeout id and `clearTimeout` before re-arming; add `role="status"`. |
| 21 | `margin-top:-4px` (or a 4px gap token) and swap the privacy `<span class="hint-link">` for a plain note class. |

### 4b. Small patches that need one behaviour decision

| # | Decision to make, then it is a patch |
|---|---|
| 2 | Native `<select>` + `<button aria-expanded>` restyle, or keep the custom widget and add `role="listbox"/"option"`, `tabindex`, Enter/Space/arrows, `aria-expanded`. Either way ~20 lines; the palette stays. |
| 4 | Reserve width (`min-width` per row, `justify-content:center`) so the control stops resizing, and put `response.error` in the label (`✖ FAILED — BLOCKED`). What the states *say* and whether they belong inside the host page's own link is 4c. |
| 7 | Add a separating outline (`box-shadow:inset 0 0 0 2px #fff`) — but choosing "adapt to host" vs "one theme with a guaranteed halo" is 4c. |
| 9 | `role="menu"`, `aria-controls`, focus first item on open, return focus to the FAB on close, `:focus-visible` rings. Mechanical, ~15 lines, but should land with the same pattern as 2 so both surfaces behave alike. |
| 11 | Reserve the Unpaywall slot (`min-height` placeholder or `visibility:hidden` row) so arrival never moves the stack. |
| 15 | Render `pageInfo.restricted` as a row ("PAYWALLED — NO DIRECT PDF") instead of a silently missing button. Wording is 4c. |
| 16 | Change three hex values (e.g. darker variants for the rest state) — *which* values is 4c. |
| 18 | Show the coerced value: "Domain fixed to https://sci-hub.st" in `#status`. Copy is 4c. |

### 4c. Genuinely needs the design system (do not one-line these)

- **The tab metaphor itself** (#14, #6, #7): is the surface a 52px screen-edge tab with a stack of
  detached cards, or a compact panel? Right now it is both — flush tab, 10px indent, ragged card
  widths, two radii, offset shadow on some elements only. Any single-property patch makes one row
  tidy and the set less coherent. Needs: one corner radius, one shadow rule, one column width,
  one alignment anchor, and a decision on what happens on narrow/short viewports.
- **Colour roles** (#16, #7): the palette (`--black/--white/--purple`, plus per-platform
  green/red/blue accents) has no semantic layer. Accents are used simultaneously as rest-state
  icon colour on white and hover-state icon colour on black; the FAB has one fill for all hosts.
  Needs paired tokens (surface / on-surface / accent-on-light / accent-on-dark) and a stated
  contrast floor (4.5:1 text, 3:1 graphics) checked once.
- **The save-state vocabulary** (#4, #15): replacing the *host page's* link text is a product
  decision, not a style bug. Does the extension own a foreign control for 3 seconds? If yes it
  needs a non-reflowing treatment (fixed-width badge beside the link, or an in-menu progress row)
  and a failure taxonomy (blocked / timeout / not-a-pdf / no-metadata) instead of one "FAILED".
  Same for "AI NAMING" when no AI is in play.
- **Honest state on the page** (#15): when an action is unavailable the menu must say
  why (paywalled, no DOI, viewer page). Today silence is the only signal, and `restricted` is
  computed and thrown away.
- **Overlay behaviour** (#10, #12, #11): dismiss rules (outside click, Escape, idle), focus
  ownership and the arrival of async rows are one interaction model. Patch them separately and
  they will contradict each other (e.g. an idle timeout plus a stack that moves on arrival).
- **Dialog semantics** (#2, #9): both surfaces should use the same disclosure pattern (native
  control where one exists, otherwise one custom widget with one keyboard contract). Two bespoke
  widgets is how the current divergence happened.

---

## 5. Explicit non-defects (so nobody "fixes" them into bugs)

- The 320px popup body, its 24px padding and 2px border are consistent (268px content). Not too narrow.
- `visibility:hidden` on the closed menu **does** remove its links from the tab order (verified after the 0.18s transition), so `display:none` is not needed.
- `#7851A9` on white is 5.92:1 and on black 3.55:1 — both pass. Do not darken the brand purple on that account.
- The `order:1-8` scheme works; late arrivals are visually correct. Only the duplicate/stale append is broken.
- The global `input{...}` rule does **not** deform `#geminiOptIn` (measured 13×13, clean).
- Shadow-root `!important` cannot escape and restyle the host page; the exposure is limited to inherited properties (`direction`, `writing-mode`, `text-indent`, `word-spacing`, `font-feature-settings`, …). Only `direction` bites in practice.
- `z-index: 2147483647` will win against ordinary cookie banners. The collision is geometric (#5), not a stacking failure.

---

## 6. Measured evidence (for whoever picks this up)

Harness: `…/wf/harness/` (`fab.html`, `fab-dup.html`, `fab-short.html`, `fab-collide.html`,
`popup-harness.html`, `labels.html`, `measure.js`, `build.js`; run with `python3 -m http.server`
and headless Chrome).

```
popup   body 320 wide / 268 content | closed 494px | dropdown open 734px (+240) | advanced 1213px | advanced+dropdown 1453px
        #saveBtn top 352 -> 592, bottom 640 (Chrome popup cap 600) | .custom-select 47px -> 45px when active
        native <select> in document: 0 | .custom-select tabIndex -1 role null | .advanced-toggle DIV tabIndex -1
        .hint-link sits 4px under its input | #geminiOptIn 13x13, padding 0, border 0
menu    8 buttons, 42px tall, widths 201.2 / 237.3 / 214.5 / 201.6 / 287.7 / 244.6 / 249.3 / 201.2
        menu box 297.7px at left 10 | total height 392px | 12 items -> 568px, top -281px at vh 413
        duplicate rows after 2 x create() + 500ms round-trip: 9 items, 3 x "Save PDF (Unpaywall)"
FAB     52x48 at left 0 bottom 78, border-left 0, radius 0 4px, outline none, direction ltr
        RTL host: left 245.7 (leaves the edge) | dark host #0d0d0d: contrast 1.08
labels  Save PDF (Direct) 197.2 -> 148.7 -> 108.7 -> 86.0 | Nexus 282.1 -> 148.7
        host [PDF] 43.4 -> 123.4, paragraph 21 -> 45px
collide 703 candidates, banner at index 701 -> detectCollisions() 78 (overlap); banner at index 0 -> 110 (lifted)
```

---

## 7. Sources

All primary, in-repo:

- `content.js` — `getShadowStyles()` (shadow CSS, lines 166–297), `detectCollisions()` (299–333),
  `updatePosition()` (335–344), `closeMenu/openMenu/toggleMenu` (346–374), `create()` (376–438),
  `populateMenu()` (440–515), `attachEventListeners()` (517–571), `FAB_SAVE_LABELS`/`LINK_SAVE_LABELS` (87–97),
  `createDownloadButton()` (111–132).
- `popup.html` — `body` (8–12), `input` (19–26), `.hint-link` (28–33), `.custom-select*`/`.custom-options*` (35–57),
  `.advanced-toggle` (59–61), `button` (63–68), `#status` (70), `#reportIssueBtn` (147), markup (77–155).
- `popup.js` — dropdown handlers (31–76), `showStatus` (78–82), `toggleAdvancedBtn` (84–92),
  `chrome.storage.*` load (94–126), save handler (128–171).
- `save.js` — `directSave()` (8–34); `tests/save.test.js` pins the current label contract (37–110).
- `page.js` — `restricted` produced by `isRestrictedAccess()` (194–215), `readPage()` (257–270); never read in `content.js`.
- `background.js` — `checkUnpaywall` reply shape (524–529), `triggerDirectDownload` error codes (537–577),
  `systemLog`/`getLogsForReport` (44–60, 496–501) — the only place a failure reason currently surfaces.
- `docs/architecture.md` §7–§9 and §12 (component responsibilities, execution flow, Direct Save paths).
