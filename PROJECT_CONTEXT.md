# PROJECT_CONTEXT.md

> Living context document for the PaperIsHere repository. Every claim was verified
> against the actual source files (manifest.json, background.js, content.js,
> popup.js, popup.html, README.md) at version 2.3.0. Line numbers are approximate.
> Items are marked **[CONFIRMED]** (verified defect/behavior in source) or
> **[POSSIBLE]** (reasonable risk, not yet reproduced).

---

## 1. Project Overview

PaperIsHere is a minimalist, typography-driven **Chrome Extension (Manifest V3)** for
academic researchers. It:

- Extracts scholarly metadata (DOI, ISBN, Title) from publisher pages, databases, and
  search results.
- Injects an on-page floating menu with download/search shortcuts (publisher PDF,
  Unpaywall, Google Scholar, Sci-Hub, Telegram Nexus bot, Libgen, Anna's Archive).
- Intercepts clicks on PDF links across the web and routes them through a silent
  background download pipeline.
- Automatically renames downloaded PDFs into standardized formats using Crossref,
  an optional Google Gemini API key, and deterministic local fallbacks.

## 2. Current Version

- **Version:** 2.3.0 (`manifest.json:4`)
- **Manifest:** V3 (`manifest.json:2`)
- **Assets:** one `icon.png` reused for all icon sizes (16/48/128)

## 3. Project Goal

Remove friction from the academic PDF workflow: surface accessible copies where
available, aggregate search entry points for third-party libraries, defeat
third-party PDF-viewer hijacking of normal link clicks, and convert chaotic download
filenames (`1-s2.0-SXXXX-main.pdf`, `viewcontent.cgi`, ...) into clean names such as
`2015-BelenzonS-social_context_ownership_family_firms.pdf`.

## 4. Important Legal/Behavioral Boundaries

Per `README.md` and as implemented in source:

- The extension does **NOT** bypass, crack, or circumvent paywalls or DRM. The
  opposite is implemented: `isRestrictedAccess()` (`content.js:115-148`) **detects**
  paywalls to *suppress* direct-download buttons; `extractNativePdfUrlStrict()`
  returns `null` when access is restricted (`content.js:160`); the HTML Shield
  cancels landing-page saves (`background.js:490-497`).
- The extension hosts/distributes no content. It builds **search URLs** and
  **deep-links** to third-party platforms (Sci-Hub, Libgen, Anna's Archive, Telegram
  bot, Google Scholar) and automates otherwise-manual clicks/downloads.
- Third-party integrations are provided as **search aggregation** only. Users are
  responsible for ensuring they have the legal right to download any material.
- Note: earlier project docs described the goal as "bypassing paywalls"; that wording
  is inaccurate and contradicts both the README disclaimer and the actual
  detection-and-suppression implementation described above.

## 5. Complete File and Folder Structure

```text
PaperIsHere/
├── manifest.json        # MV3 config: permissions, service worker, content script registration
├── background.js        # Service worker (~553 lines): APIs, AI naming, download pipeline, logging
├── content.js           # Content script (~482 lines): DOM extraction, FAB UI, link interception
├── popup.html           # Settings UI (brutalist styling, custom dropdown, advanced panel)
├── popup.js             # Popup logic (~126 lines): load/save settings, bug-report composer
├── icon.png             # Single icon asset for all sizes
├── README.md            # Features, legal disclaimer, install/config instructions
├── LICENSE.txt          # MIT License
├── PROJECT_CONTEXT.md   # This document
└── .DS_Store            # macOS artifact (no .gitignore exists yet)
```

## 6. Architecture

Three layers plus shared storage:

```
┌─────────────────────┐  chrome.runtime.sendMessage   ┌──────────────────────┐
│ content.js          │ ─────────────────────────────►│ background.js        │
│ (every page)        │ ◄─────────────────────────────│ (service worker)     │
│ detect + request    │  sendResponse (async)         │ execute + rename     │
└─────────────────────┘                               └──────────┬───────────┘
                                                      │ reads/writes
┌─────────────────────┐  chrome.storage.local         ▼
│ popup.html/popup.js │ ─────────────► shared persistent config
└─────────────────────┘
```

- `manifest.json` registers `content.js` declaratively on `<all_urls>`
  (`manifest.json:29-38`) and `background.js` as service worker (:26-28).
- All layers share configuration through `chrome.storage.local`.
- The only channel between page context and privileged worker is
  `chrome.runtime.sendMessage`; responses use the `sendResponse` + `return true`
  async pattern.

## 7. Component Responsibilities

| File | Responsibilities |
|---|---|
| `manifest.json` | Identity (v2.3.0), permissions (`downloads`, `storage`, `activeTab`, `scripting`, `alarms`), `<all_urls>` hosts, popup action, service worker, content-script injection |
| `content.js` | Strict DOI/ISBN/title/text extraction; paywall detection; publisher-PDF discovery; FAB menu injection (orders 1–8); Sci-Hub/Libgen page-specific URL extraction; capture-phase PDF-link interception; SPA URL-change re-init |
| `background.js` | Per-tab + global metadata stores with Memory Shield; Crossref/Gemini/Unpaywall calls; mirror scraping & liveness probing; filename generation (AI + fallbacks); download orchestration incl. `onDeterminingFilename` renaming, HTML Shield, blob fallback; ring-buffer logging |
| `popup.html` | Save-folder input, naming-style dropdown (6 styles), advanced panel (mirror domains, Nexus bot, Gemini key), report/GitHub links |
| `popup.js` | Loads/saves settings to `chrome.storage.local`; domain normalization via `new URL(...).origin` with hardcoded defaults; composes GitHub issue URL embedding sanitized logs |

## 8. Message Passing / Communication Contract

Handled in `background.js` `chrome.runtime.onMessage` (:405-488):

| Action | Sender | Payload | Response |
|---|---|---|---|
| `logError` | content | `{type, message, details}` | none (fire-and-forget) |
| `getLogsForReport` | popup | – | `{logs}` joined ring buffer |
| `storeMetadata` | content | `{doi,isbn,text,title}` | none; updates tab store + global Memory Shield (:419-431) |
| `checkUnpaywall` | content | `{doi}` | `{url\|null}` — **broken**, see §22 |
| `pingMirrors` | any | – | `{status:"done", data:{sciHubDomain,libgenDomain}}` |
| `triggerDirectDownload` | content | `{url,doi,isbn,text,title}` | `{success,filename}` or `{success:false,error}` |

All handlers return `true` to keep `sendResponse` alive for async work.

## 9. Runtime Execution Flow

1. **Install** → `onInstalled` seeds mirror domains if absent (`background.js:130-134`).
2. **Page load** → content script runs unless host is in `IGNORED_HOSTS`
   (`content.js:8`: AI-chat sites). `/doi/epub/` URLs are redirected to `/doi/epdf/`
   (:10-12).
3. `initializeExtension()` (:403-414): extract DOI → ISBN → title → text → publisher
   PDF URL (paywall-gated); send `storeMetadata`; call `injectButtons()`.
4. `injectButtons()` (:283-401): FAB + menu; button set depends on metadata/page type
   (viewer pages get an advisory label). Unpaywall button appears async if OA found.
5. `MutationObserver` (:418-424) detects SPA URL changes → re-init after 800 ms debounce.
6. **PDF-looking link clicked** → capture-phase listener (:426-482) prevents default,
   marks element, sends `triggerDirectDownload`.
7. Background: DOI from clicked URL if needed (:452-454); original filename from URL
   (:457-463); final name via `generateFinalFilename` (:315-371);
   `activeDownloads[url]=filename` (:466); `chrome.downloads.download({url})` (:469).
   Rename applied via URL lookup in `onDeterminingFilename` (:499-508).
8. Chrome blocks/refuses → `fallbackBlobDownload` (:373-403): fetch → validate (reject
   HTML / <5000 bytes) → data-URL → re-download with explicit filename.
9. **Passive downloads** hit `onDeterminingFilename` directly (:490-553): HTML Shield →
   forced-name lookup → active-tab metadata + URL-DOI fallback → 4 s naming race →
   sanitized-original fallback.

## 10. Metadata Extraction

All in `content.js`:

- **DOI** (`extractDoiStrict`, :21-63): meta tags (`citation_doi`, `prism.doi`,
  `dc.identifier`) → JSTOR `stable/{id}` ⇒ `10.2307/{id}` (:28-31) → URL regex
  `\b10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+\b` (context-gated: `/doi/`, `/article/`,
  `abs`, Sci-Hub) → Google Scholar `q` param / search-box value → body-text scan
  (`DOI:`, `doi.org/…`, `doi = {…}`) over first 10 000 chars. Trailing `.;,` stripped.
- **ISBN** (`extractIsbnStrict`, :65-91): meta tags (`citation_isbn`,
  `property="isbn"`, `prism.isbn`, `dc.identifier`) → URL path ISBN-13 pattern →
  body-text ISBN-10/13 regex (first 5 000 chars) → Libgen-specific body scan.
  Validated to 10/13 digits plus X.
- **Title** (`extractTitleFallback`, :93-103): `citation_title` / `DC.Title` /
  `prism.title` / `og:title` → first `<h1>` (>5 chars) → `document.title` split on `|`
  then `-`.
- **Page text** (`extractPageTextStrict`, :105-113): Scholar `.gs_ri` aggregation,
  else `body.innerText` capped at 3 000 chars.
- **Publisher PDF URL** (`extractNativePdfUrlStrict`, :159-186): `citation_pdf_url`
  meta → ResearchGate / Academia.edu selectors → generic link scan (`/doi/pdf/`,
  `/doi/epdf/`, `/doi/epub/`, "download pdf"-style texts; shadow-library links
  excluded); SAGE viewer pages synthesize an `epdf` URL from the DOI (:184). Query
  strings stripped and `epub` normalized to `epdf` (`sanitizePublisherUrl`, :150-157).

## 11. Paywall Detection

`isRestrictedAccess()` (`content.js:115-148`) gates direct-download features only:

- Restricted signals: "Get access to the full version", "Purchase Instant Access",
  "Institutional Login", Wiley login text; selectors `.login-options`,
  `.paywall-article`, `.access-options`, `#paywall-banner`, `.article-paywall`;
  "Restricted access", "Purchase article"; lock icons / `[data-access-type="restricted"]`.
- Open-access signals short-circuit to unrestricted: `.access-icon.open`,
  `.open-access`, OA/free-alt images, `.doi-access.open`, `.oa-open`, OA text.
- Wiley special case (:137): any Wiley page without an OA badge is treated as
  restricted — aggressive heuristic, known false-negative source (§26).

## 12. PDF Detection and Download Flow

Two entry paths converge on the rename pipeline:

**A. UI-initiated** (`initiateDirectDownload` :230-254; interceptor :426-482 →
`triggerDirectDownload`):
- Sci-Hub pages: URL from `.download a`, `object[type="application/pdf"]`, or iframe
  (`extractSciHubPdfUrl`, :188-201).
- Libgen `ads.php`/`get.php`: first GET/CLOUDFLARE/IPFS.IO/PINATA link
  (`extractLibgenDownloadUrl`, :203-210); a native anchor is also offered.
- Filename pre-generated; mapping stored in `activeDownloads`; plain download started;
  rename applied via URL match in `onDeterminingFilename`. The blob fallback carries
  the explicit filename itself.

**B. Passive downloads**: `onDeterminingFilename` (:490-553) attributes them to the
active tab's metadata, falling back to `globalLastKnownMetadata` and/or a DOI parsed
from the download URL (:526-527). A `.pdf` extension alone qualifies for renaming
(:534). Naming is raced against a 4 s timeout; on failure the sanitized original name
is placed inside the save folder.

**HTML Shield** (:492-497): any `text/html` download is cancelled — except URLs
containing `libgen` — preventing landing pages from saving as PDFs. (The Google
Scholar exemption in that line is broken; see §22 #2.)

## 13. Filename Generation and All Naming Styles

Pipeline (`generateFinalFilename`, `background.js:315-371`):

1. Extension resolution from original filename (`.php`/`.html` rejected; default `pdf`).
2. Libgen bibtext shortcut: captured text containing `@book` or `Publisher:` →
   `parseLibgenText` (:152-185, supports BibTeX and plain-text forms) → deterministic
   name, **no AI call**.
3. DOI present → Crossref lookup → structured input → Gemini; Gemini failure ⇒
   deterministic fallback.
4. No DOI but title/text → Gemini directly (title + DOI hint + original-filename hint
   + up to 2 500 chars context).
5. Result stripped of trailing `.pdf`; correct extension appended; save-folder prefix
   applied (default `Renamed Papers`). `conflictAction: 'uniquify'` always used.
6. Total fallback: sanitized original filename.

Deterministic fallback (`generateFallbackName`, :230-266) tokenizes titles via
`smartTokenizeAndFilter` (:142-150: strips brackets, keeps words >2 chars, drops
`STOP_WORDS` :5-9):

| Style ID (popup label) | Pattern | Example (prompt spec) |
|---|---|---|
| `kebab` (default) | `YYYY-LastNameInitials-kw_kw_kw.pdf` | `2015-BelenzonS-social_context_ownership_family_firms.pdf` |
| `pascal` | `YYYY-LastNameInitials-KwKwKw.pdf` (fused PascalCase, ≤6 kw) | `2015-BelenzonS-SocialContextOwnershipFamilyFirms.pdf` |
| `date-kebab` | `YYYYMMDD-LastNameInitials-kw_kw_kw.pdf` (missing M/D ⇒ 01) | `20150921-BelenzonS-social_context_ownership_family_firms.pdf` |
| `model1` | `YYYY_LastNameInitials_kw-kw-kw.pdf`; `_Vxx` only if stated in source | `2015_BelenzonS_social-context-ownership-family-firms.pdf` |
| `model2` | `YYYYMMDD_kw-kw-kw_type.pdf` (AI prompt expects doc-type; fallback hardcodes `_document`) | `20260821_entrepreneur-resilience_methodology-design.pdf` |
| `model3` | `YYYYMMDD_kebab-description.pdf` (fallback hardcodes `_report`) | `20260821_development-progress-report.pdf` |

Missing years render as `0000`; the words `null`/`undefined` are never emitted.

## 14. Gemini Integration

- Endpoint: `generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=<key>`
  (`background.js:282`); POST `{contents:[{parts:[{text}]}]}`.
- Key read from `chrome.storage.local.geminiApiKey`; absent ⇒ silently skipped with
  `GEMINI_SKIP` log (:270-275).
- System prompt per style (`getSystemPrompt`, :28-78): role = expert Data Librarian;
  strict output format; stop-word removal; sanitization of `` * $ \ / < > | " ? [ ] ; = + ``
  with `&`→`And`; SMART_KEYWORD_RULE (identify field → prefer author keywords/JEL →
  keep core variables/contexts/populations → exclude metaphors and generic study
  words; `0000` for missing year).
- Input truncated to 4 000 chars (:277); 8 s abort timeout (:281).
- Response handling (:295-306): first candidate text; strips ``` fences and literal
  `json`; rejects results ≤5 chars; replaces `null`→`0000`.

## 15. Crossref Integration

- `getCrossref(doi)` (:187-228): GET
  `api.crossref.org/works/{doi}?mailto=researcher@example.com`, 6 s timeout.
- Date precedence: `published-print` → `published-online` → `issued` → `created`;
  zero-padded YYYYMMDD; missing ⇒ year `0000`.
- Uses **first author only** (`author?.[0].family` + given initials). Requires family
  + title + resolvable year; HTML stripped from titles.

## 16. Unpaywall Integration

- Intended behavior (`background.js:433-439`): GET
  `api.unpaywall.org/v2/{doi}?email=researcher@example.com`, return
  `best_oa_location.url_for_pdf`.
- **Status: completely non-functional [CONFIRMED]** — corrupted template literal
  (§22 #1). Consequently the "Save PDF (Unpaywall)" UI button never appears
  (content.js:313-319 receives no URL).

## 17. Mirror Discovery

- Scrapers (`fetchDynamicSciHubs` :95-106, `fetchDynamicLibgens` :108-119): fetch
  `sci-hub.pub` / `librarygenesis.net`, remove `<del>/<s>/<strike>` blocks, regex out
  `sci-hub.*` / `libgen.*` hrefs, de-duplicate; fallback to hardcoded lists
  (:11-12: sci-hub.st/.ru/.se; libgen.li/.vg/.rs).
- Liveness probing (`checkUrl` :80-88 → `findActiveMirror` :90-93): sequential GETs,
  `mode:'no-cors'`, 3.5 s abort each; first success wins; else first list entry.
- Persisted via `updateMirrors` (:121-128); triggered on install (if unset) and via
  `pingMirrors`. Manual override possible in popup.

## 18. External Services and Integrations

| Service | Purpose | Auth | Status |
|---|---|---|---|
| api.crossref.org | DOI metadata for naming | polite `mailto=researcher@example.com` | Working |
| generativelanguage.googleapis.com (`gemini-1.5-flash`) | AI filename generation | user API key | Working (optional) |
| api.unpaywall.org | Legal OA PDF location | `email=researcher@example.com` | **Broken** (§22 #1) |
| sci-hub.pub + mirrors | Mirror discovery; article access links | none | Best-effort |
| librarygenesis.net + mirrors | Mirror discovery; book search/download | none | Best-effort |
| annas-archive.org | Book/eBook search deep links | none | Link-out only |
| t.me Nexus bot (default `sks7777777nexusbot`) | Document-request deep link | none | Link-out only |
| scholar.google.com | Search deep links; DOI/text harvesting; PDF-result interception | none | Working |
| github.com/hsforhermes/PaperIsHere | Bug-report issue composer with logs | none | Working |

Privacy-relevant: with a Gemini key configured, page-text snippets (≤2 500–4 000
chars) and metadata are sent to Google; DOIs plus a hardcoded example email go to
Crossref/Unpaywall.

## 19. Chrome APIs and Permissions

Declared (`manifest.json:6-15`): `downloads`, `storage`, `activeTab`, `scripting`,
`alarms`; `host_permissions: <all_urls>`.

Actually used:
- `chrome.downloads`: `download()`, `onDeterminingFilename`, `cancel()` (HTML Shield).
- `chrome.storage.local`: config, logs, persistence.
- `chrome.runtime`: messaging, `lastError`, `onInstalled`.
- `chrome.tabs.query`: active-tab attribution in rename pipeline.

Declared-but-unused: **`alarms`** (never referenced anywhere) and **`scripting`**
(programmatic injection never performed; content script is declarative).

## 20. Persistent Storage Keys

| Key | Writer | Reader | Purpose |
|---|---|---|---|
| `saveFolder` | popup.js:98 | background.js:328, 511 | Target subfolder (default `Renamed Papers`) |
| `namingStyle` | popup.js:100 | background.js:329 | `kebab,pascal,date-kebab,model1,model2,model3` |
| `sciHubDomain` | popup.js:101; updateMirrors | content.js:329; popup load | Active Sci-Hub origin |
| `libgenDomain` | popup.js:102; updateMirrors | content.js:345; popup load | Active Libgen origin |
| `annasDomain` | popup.js:103 | content.js:353 | Anna's Archive origin |
| `nexusBotUsername` | popup.js:104 | content.js:338 | Telegram bot handle |
| `geminiApiKey` | popup.js:105 | background.js:270 | Gemini key (**plaintext**) |
| `systemLogs` | background.js:20-25 | background.js:412; popup report | Ring buffer, max **10** entries |
| `activeLibgenSearchContext` | content.js:264 | **none — dead write** | Intended context carry-over, never read |

## 21. Runtime State and MV3 Service Worker Behavior

In-memory-only state in `background.js` (:1-3):

- `currentTabMetadata` — per-tab `{doi,isbn,text,title}` keyed by `sender.tab.id`.
- `globalLastKnownMetadata` — richest recent metadata; **Memory Shield** (:422-430):
  an update is skipped when it concerns the same paper (equal DOI **or** equal ISBN)
  AND its text is poor (<300 chars) while stored text is rich (≥300 chars).
- `activeDownloads` — URL→filename map consumed by `onDeterminingFilename`.

**MV3 hazard:** Chrome may terminate the idle service worker at any time; all three
stores then empty until repopulated by page activity. Consequences: lost rename
mappings (§24) and cold-start latency. Nothing persists these structures today
(`chrome.storage.session` unused). Content-side state lives as long as the page does;
refreshed on SPA navigations via the MutationObserver debounce.

## 22. Known Bugs

**#1 [CONFIRMED] Unpaywall handler is dead code in practice** —
`background.js:434`. The fetch URL is a mangled template literal containing the text
`[https://api.unpaywall.org/v2/$](https://api.unpaywall.org/v2/$){message.doi}…`, so
`${message.doi}` never interpolates and the URL is invalid.
*Impact:* every `checkUnpaywall` request fails; the "Save PDF (Unpaywall)" button can
never appear; the entire legal-OA feature path is non-functional.

**#2 [CONFIRMED] HTML Shield Scholar exemption never matches** —
`background.js:493`. The condition checks
`item.url.includes('[google.com/scholar](https://google.com/scholar)')` — a Markdown
link literal that cannot occur in real URLs, so the negation is always true.
*Impact:* the Shield cancels **every** `text/html` download (except URLs containing
`libgen`), regardless of origin — broader than intended; any legitimate HTML download
anywhere is silently cancelled and logged as `HTML_CANCELLED`.

**#3 [CONFIRMED] Self-interception guard is dead** —
`content.js:430`. The interceptor checks `aTag.hasAttribute('onclick')`, but
`createDownloadButton` assigns the JS property `btn.onclick = ...` (:260), which does
not create an HTML attribute. *Impact:* extension-injected anchors are not exempted
from the global click interceptor. Practical blast radius is limited because
`bypass` buttons use `javascript:void(0)` hrefs (rejected by the `startsWith('http')`
check at :450), but `native`/`blank` buttons whose href/text matches PDF patterns
(e.g., the Libgen native save button) can be double-processed.

**#4 [CONFIRMED] Mirror liveness check is unreliable** —
`background.js:84`. `fetch(url, {mode:'no-cors'})` resolves with an opaque response
for *any* reachable host — including soft-404 parking pages and wrong-site hits —
and status codes are unreadable. *Impact:* `findActiveMirror` almost always returns
the first scraped URL; dead-but-DNS-resolvable mirrors get persisted until the user
hits a failure.

**#5 [CONFIRMED] Hanging sendResponse for fire-and-forget messages** —
`background.js:406-409`. The `logError` branch returns `true` (keeping the message
channel open) but never calls `sendResponse`. *Impact:* senders' callbacks fire only
on port close with `chrome.runtime.lastError`; harmless functionally but produces
console noise and masks real response errors.

**#6 [CONFIRMED] Metadata equality quirk in Memory Shield / rename attribution** —
`background.js:423` and :522 compare DOI/ISBN with `===`; when both sides are
`null`/`undefined` they compare equal, so unrelated metadata-less pages can be
misclassified as "same paper" and skipped or merged with stale globals.
*Impact:* occasional stale-title renames on pages without DOI/ISBN.

## 23. Security Risks

- **[CONFIRMED] Gemini API key stored in plaintext** (`chrome.storage.local`,
  written popup.js:105) **and transmitted as a URL query parameter**
  (`background.js:282`). Any compromise of storage or of logs/referrers leaks the key.
- **[POSSIBLE] Fragile log redaction** — `systemLog` masks keys only via regex
  `key=[a-zA-Z0-9_-]+` (`background.js:16`). Keys appearing in other shapes would not
  be masked before logs are embedded into public GitHub issue bodies by
  `popup.js:115-125`.
- **[CONFIRMED] Maximal permission surface** — `<all_urls>` host permissions plus
  content-script injection into every page (`manifest.json:13-15, 29-38`), including
  banking/healthcare sites. Only mitigations present: `IGNORED_HOSTS`
  (`content.js:8`) skips AI-chat sites.
- **[CONFIRMED] Third-party data flow** — page-text snippets and derived metadata go
  to Google Gemini when configured; DOIs + hardcoded example email
  (`researcher@example.com`) go to Crossref/Unpaywall. No user consent surface exists.
- **[POSSIBLE] Arbitrary-URL downloads** — content scripts may ask background to
  download any URL (interceptor or injected UI); a compromised renderer page could
  abuse `triggerDirectDownload` as a download primitive. Bounded by MV3 messaging
  (only this extension's content scripts may send).
- **[CONFIRMED, mitigated] No remote code execution** — no `eval`, no remote script
  loading, no innerHTML of remote origin into privileged contexts (injected UI uses
  static SVG strings). Mirror HTML is parsed via regex only.

## 24. Architectural Risks

- **[CONFIRMED] MV3 service-worker state loss** — `activeDownloads`,
  `currentTabMetadata`, `globalLastKnownMetadata` are plain globals
  (`background.js:1-3`). Worker suspension wipes them ⇒ UI-triggered downloads lose
  their forced rename (falls through to passive naming), Memory Shield resets, and
  per-tab attribution disappears mid-session.
- **[CONFIRMED] Active-tab race in rename pipeline** —
  `onDeterminingFilename` attributes passive downloads via
  `chrome.tabs.query({active:true,currentWindow:true})` (`background.js:517`). With
  multiple tabs/windows downloading concurrently, files receive whichever paper's
  metadata was focused. Deterministic attribution requires carrying
  `sender.tab.id`/download identity through the flow instead.
- **[POSSIBLE] Naming timeout vs UX** — the 4 s race (`background.js:536-540`) can
  truncate legitimate slow Gemini+Crossref chains for passive downloads, silently
  yielding fallback names.
- **[POSSIBLE] Global link interception side effects** — the capture-phase listener
  rewrites clicks site-wide; heuristic false positives (link text containing
  "pdf", `[PDF]`) hijack non-PDF navigations into the download pipeline.

## 25. Technical Debt

- **[CONFIRMED]** Unused permissions `alarms` and `scripting` (`manifest.json:10-11`).
- **[CONFIRMED]** Dead write `activeLibgenSearchContext` (`content.js:264`) — never read.
- **[CONFIRMED]** Promise-constructor antipattern around callback APIs
  (`generateFinalFilename` :326-370, `callGemini` :269); mixed callback/async styles.
- **[CONFIRMED]** Duplicated mirror-scraper logic (Sci-Hub/Libgen functions differ
  only by source URL and domain pattern).
- **[CONFIRMED]** Fallback generators diverge from prompt specs for `model2`/`model3`
  (hardcoded `_document` / `_report` suffixes, :256, :261) — AI and fallback outputs
  disagree for the same style.
- **[CONFIRMED]** `systemLog` ring buffer capped at 10 entries (:23) — insufficient
  for diagnosing intermittent failures; also performs unsequenced read-modify-write
  on `chrome.storage.local` (concurrent logs can drop entries).
- **[CONFIRMED]** Response-cleaning mutations could corrupt legit filenames:
  `.replace(/json/gi,'')` (:298) strips the substring "json"; `.replace(/null/gi,'0000')`
  (:301) rewrites any word containing "null".
- **[CONFIRMED]** Single low-res `icon.png` reused for 16/48/128.
- **[CONFIRMED]** No `.gitignore` (.DS_Store tracked); no tests, no lint config,
  no build system.
- **[CONFIRMED]** Inline SVG icon strings duplicated across `content.js` (:224-228).

## 26. Known Limitations

- First-author-only naming (Crossref `author?.[0]`); multi-author papers take the
  first surname.
- Wiley blanket rule treats all non-OA Wiley pages as restricted → direct-save button
  suppressed even where the user has institutional access.
- Page text capped at 3 000 chars; Gemini input at 4 000 chars — long abstracts/
  references truncated before AI sees them.
- Interceptor deliberately skips external Academia.edu/ResearchGate links
  (`content.js:436-438`) and Sci-Hub/Libgen internal links (:451) — coverage gaps by design.
- `/doi/epub/` pages force-redirect to `/doi/epdf/` (:10-12) — visible navigation
  behavior on those publisher pages.
- Shadow-library domains rotate frequently; auto-discovery is best-effort and can lag.
- Popup domain inputs normalize via `new URL(...).origin`; malformed input silently
  reverts to hardcoded defaults rather than warning the user.
- Libgen author parsing assumes "Last, First" ordering (`background.js:172`);
  other conventions produce wrong initials.
- Extension has no options page beyond the popup; no export/import of settings.

## 27. Version History / Current Baseline

| Version | Notes |
|---|---|
| 2.3.0 | Current. Manifest V3; 6 naming styles; Memory Shield V2; HTML Shield; blob-fallback downloads; dynamic mirror discovery; Nexus bot & Anna's Archive links; bug-report composer. Known defects listed in §22 shipped in this version. |

Earlier history is not recorded in-repo (no CHANGELOG exists).

## 28. Recommended Priorities for Future Work

1. **P0 — Fix corrupted strings** (`background.js:434` Unpaywall URL; `background.js:493`
   Scholar exemption). One-line each; restores a whole feature and corrects Shield scope.
2. **P1 — Persist runtime state for MV3** — move `activeDownloads` and metadata stores
   to `chrome.storage.session` (or key renames by `downloadId`) so worker suspension
   cannot break renaming.
3. **P2 — Deterministic download attribution** — thread initiating-tab identity through
   `triggerDirectDownload` → rename lookup instead of active-tab query.
4. P3 — Replace `no-cors` liveness probing with `fetch` + status check via host-permission
   CORS exemption (already granted by `<all_urls>`).
5. P4 — Shrink permissions to academic/publisher domains; drop `alarms`/`scripting`.
6. P5 — Fix dead onclick guard (#3), add tests for filename generation, split scraper
   duplication, align fallback generators with prompt specs.

## 29. Safe Development Rules

- Never expose, hard-code, or log API keys or secrets; if a key must be logged for
  debugging, mask it deterministically and keep logs local.
- Preserve Manifest V3 compatibility: service-worker-safe patterns only (no DOM in
  background, no persistent workers, assume suspension between events).
- Avoid unnecessary architectural rewrites; prefer small, testable, reviewable changes.
- Do not change unrelated functionality in the same commit; keep diffs minimal.
- Verify changes against existing behavior before committing: exercise both download
  paths (UI-initiated + passive), all six naming styles, and the fallback chain
  (Libgen-text → Crossref+Gemini → deterministic → sanitized original).
- Maintain the documented behavioral boundary: paywalls are detected to *suppress*
  actions, never bypassed.
- Keep user-facing strings and docs consistent with README's legal disclaimer.

---

## CURRENT BASELINE

As of this document's update: the repository working tree is clean apart from this
PROJECT_CONTEXT.md update itself. **No source-code changes have been made during this
analysis session** — `manifest.json`, `background.js`, `content.js`, `popup.js`,
`popup.html`, `icon.png`, `README.md`, and `LICENSE.txt` are untouched and match
version 2.3.0 as initially inspected.

