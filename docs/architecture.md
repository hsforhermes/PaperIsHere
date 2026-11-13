# Architecture

> Behavioural map of the PaperIsHere extension: what each module does and how the
> pieces talk to each other. Verified against the source at **2.5.0**. Symbols, not
> line numbers, so it stays findable as code moves — grep the named function.
> No bug list and no priority list here: `git log` and `docs/adr/` are the record.

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

- **Version:** 2.5.0 (`manifest.json`)
- **Manifest:** V3
- **Assets:** sized icons `icon16.png` / `icon48.png` / `icon128.png`; `icon.png` is
  a leftover full-size copy, not referenced by the manifest.

## 3. Project Goal

Remove friction from the academic PDF workflow: surface accessible copies where
available, aggregate search entry points for third-party libraries, defeat
third-party PDF-viewer hijacking of normal link clicks, and convert chaotic download
filenames (`1-s2.0-SXXXX-main.pdf`, `viewcontent.cgi`, ...) into clean names such as
`2015-BelenzonS-social_context_ownership_family_firms.pdf`.

## 4. Important Legal/Behavioral Boundaries

Per `README.md` and as implemented in source:

- The extension does **NOT** bypass, crack, or circumvent paywalls or DRM. The
  opposite is implemented: `isRestrictedAccess()` **detects** paywalls to *suppress*
  direct-download buttons; `extractNativePdfUrl()` returns `null` when access is
  restricted; the HTML Shield cancels landing-page saves.
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
├── background.js        # Service worker (~630 lines): APIs, AI naming, download pipeline, logging
├── page.js              # Content-script page reading (~270 lines): one readPage() -> one metadata record
├── save.js              # Content-script Direct Save contract (~35 lines): pending -> saved/failed -> restore
├── content.js           # Content script (~740 lines): FAB UI, menu, link interception
├── popup.html           # Settings UI (brutalist styling, custom dropdown, advanced panel)
├── popup.js             # Popup logic (~183 lines): load/save settings, bug-report composer
├── icon16.png           # Sized icons declared in the manifest
├── icon48.png
├── icon128.png
├── icon.png             # Unreferenced full-size copy
├── README.md            # Features, legal disclaimer, install/config instructions
├── LICENSE.txt          # MIT License
├── CONTEXT.md           # Domain vocabulary (see the glossary entries there)
├── docs/architecture.md # This document
├── docs/adr/            # Decision records 0001–0006
├── docs/agents/         # Issue-tracker, triage-label and domain-doc conventions
└── tests/               # node --test: naming.test.js (naming/shield), page.test.js (page reading), save.test.js (Direct Save)
```

`npm test` runs the suites; `npm run check` is a syntax check. `page.js` is the tested
seam for page reading: `readPage({document, location})` returns
`{doi, isbn, title, text, pdfUrl, restricted, sciHub, viewer}`. `tests/page.test.js`
drives it with a hand-built page adapter, so the extraction heuristics need no browser.
`save.js` is the tested seam for Direct Save: `directSave({element, url, page, labels, logType})`
runs the one pending → saved/failed → restore contract, with a fake element and fake
`chrome` in `tests/save.test.js`. `content.js` keeps the FAB, menu and link interception,
where the DOM is still welded in and untested.

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

- `manifest.json` registers `page.js`, `save.js`, `content.js` (in that order) on
  `<all_urls>` and `background.js` as service worker.
- All layers share configuration through `chrome.storage.local`; runtime state
  (metadata stores, rename map) lives in `chrome.storage.session`.
- The only channel between page context and privileged worker is
  `chrome.runtime.sendMessage`; responses use the `sendResponse` + `return true`
  async pattern.

## 7. Component Responsibilities

| File | Responsibilities |
|---|---|
| `manifest.json` | Identity (v2.5.0), permissions (`downloads`, `storage`, `activeTab`), `<all_urls>` hosts, popup action, service worker, content-script injection |
| `page.js` | Reads one page into one record: DOI/ISBN/title/text extraction, Restricted Access detection, publisher-PDF discovery, Sci-Hub and viewer-page flags. First in the content-script list so its globals and `readPage` are available to `content.js` |
| `save.js` | The one Direct Save contract: pending label, `triggerDirectDownload` payload from `pageInfo`, `saved`/`failed` label, `logError` on failure, 3s restore. Callers only supply the element, the url and their labels |
| `content.js` | FAB menu injection (orders 1–8); Sci-Hub/Libgen page-specific URL extraction; capture-phase PDF-link interception; SPA URL-change re-init; reads `pageInfo` from one `readPage` call |
| `background.js` | Per-tab + global metadata stores with Memory Shield, rehydrated from `chrome.storage.session`; Crossref/Gemini/Unpaywall calls; mirror scraping & liveness probing; filename generation (AI + fallbacks); download orchestration incl. `onDeterminingFilename` renaming, HTML Shield, blob fallback; serialized ring-buffer logging |
| `popup.html` | Save-folder input, naming-style dropdown (6 styles), advanced panel (mirror domains, Nexus bot, Gemini key + opt-in toggle), report/GitHub links |
| `popup.js` | Loads/saves settings (`chrome.storage.local`, Gemini key in `chrome.storage.session`); domain normalization via `new URL(...).origin` with hardcoded defaults; composes GitHub issue URL embedding sanitized logs |

## 8. Message Passing / Communication Contract

Handled in `background.js` `chrome.runtime.onMessage`; every message carries `action`:

| Action | Sender | Payload | Response |
|---|---|---|---|
| `logError` | content | `{type, message, details}` | none (fire-and-forget, returns `false`) |
| `getLogsForReport` | popup | – | `{logs}` joined ring buffer |
| `storeMetadata` | content | `{doi,isbn,text,title}` | none; rehydrates session state, updates tab store + global Memory Shield, persists |
| `checkUnpaywall` | content | `{doi}` | `{url\|null}` from `best_oa_location.url_for_pdf` |
| `pingMirrors` | any | – | `{status:"done", data:{sciHubDomain,libgenDomain}}` |
| `triggerDirectDownload` | content | `{url,doi,isbn,text,title}` | `{success,filename}` or `{success:false,error}` |

Async handlers return `true` to keep `sendResponse` alive; the synchronous
`logError` branch returns `false`.

## 9. Runtime Execution Flow

1. **Install** → `onInstalled` seeds mirror domains if absent (`background.js`).
2. **Page load** → content script runs unless host is in `IGNORED_HOSTS`
   (AI-chat sites). `/doi/epub/` URLs are redirected to `/doi/epdf/`.
3. `initializeExtension()`: `readPage({document, location})` (`page.js`) produces the
   one metadata record, then `content.js` sends `storeMetadata`; call `injectButtons()`.
4. `injectButtons()`: FAB + menu; button set depends on metadata/page type
   (viewer pages get an advisory label). Unpaywall button appears async if OA found.
5. `MutationObserver` detects SPA URL changes → re-init after 800 ms debounce.
6. **PDF-looking link clicked** → capture-phase listener prevents default,
   marks element (`data-paperishere-bypass`), then calls `directSave` (`save.js`).
7. Background: DOI from clicked URL if needed; original filename from URL;
   final name via `generateFinalFilename`; `activeDownloads[url]=filename`;
   `chrome.downloads.download({url})`. Rename applied via URL lookup in
   `onDeterminingFilename`.
8. Chrome blocks/refuses → `fallbackBlobDownload`: fetch → validate (reject
   HTML / <5000 bytes) → data-URL → re-download with explicit filename.
9. **Passive downloads** hit `onDeterminingFilename` directly: HTML Shield →
   forced-name lookup → caller-tab metadata (threaded, with active-tab fallback) +
   URL-DOI fallback → 4 s naming race → sanitized-original fallback.

## 10. Metadata Extraction

All in `page.js`, behind `readPage`: the record is the only thing `content.js` sees.

- **DOI** (`extractDoi`): meta tags (`citation_doi`, `prism.doi`,
  `dc.identifier`) → JSTOR `stable/{id}` ⇒ `10.2307/{id}` → URL regex
  `\b10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+\b` (context-gated: `/doi/`, `/article/`,
  `abs`, Sci-Hub) → Google Scholar `q` param / search-box value → body-text scan
  (`DOI:`, `doi.org/…`, `doi = {…}`) over first 10 000 chars. Trailing `.;,` stripped.
- **ISBN** (`extractIsbn`): meta tags (`citation_isbn`,
  `property="isbn"`, `prism.isbn`, `dc.identifier`) → URL path ISBN-13 pattern →
  body-text ISBN-10/13 regex (first 5 000 chars) → Libgen-specific body scan.
  Validated to 10/13 digits plus X.
- **Title** (`extractTitle`): `citation_title` / `DC.Title` /
  `prism.title` / `og:title` → first `<h1>` (>5 chars) → `document.title` split on `|`
  then `-`.
- **Page text** (`extractPageText`): Scholar `.gs_ri` aggregation,
  else `body.innerText` capped at 3 000 chars.
- **Publisher PDF URL** (`extractNativePdfUrl`): `citation_pdf_url`
  meta → ResearchGate / Academia.edu selectors → generic link scan (`/doi/pdf/`,
  `/doi/epdf/`, `/doi/epub/`, "download pdf"-style texts; shadow-library links
  excluded); SAGE viewer pages synthesize an `epdf` URL from the DOI. Query
  strings stripped and `epub` normalized to `epdf` (`sanitizePublisherUrl`).

## 11. Paywall Detection

`isRestrictedAccess()` gates direct-download features only, and is **signal-only** —
it fires on evidence present in the page, never on the publisher's identity:

- Restricted signals: "Get access to the full version", "Purchase Instant Access",
  "Institutional Login", "Log in to Wiley Online Library"; selectors `.login-options`,
  `.paywall-article`, `.access-options`, `#paywall-banner`, `.article-paywall`;
  "Restricted access", "Purchase article"; lock icons / `[data-access-type="restricted"]`.
- Open-access signals short-circuit to unrestricted: `.access-icon.open`,
  `.open-access`, OA/free-alt images, `.doi-access.open`, `.oa-open`, OA text.
- No per-publisher rule: Wiley pages are gated only by these signals (the earlier
  blanket "non-OA Wiley ⇒ restricted" rule was removed in 2.5.0).

## 12. PDF Detection and Download Flow

Two entry paths converge on the rename pipeline:

**A. UI-initiated** (`directSave` in `save.js`; both the FAB button and the interceptor
call it, differing only in the url and the labels):
- Sci-Hub pages: URL from `.download a`, `object[type="application/pdf"]`, or iframe
  (`extractSciHubPdfUrl`).
- Libgen `ads.php`/`get.php`: first GET/CLOUDFLARE/IPFS.IO/PINATA link
  (`extractLibgenDownloadUrl`); a native anchor is also offered.
- Filename pre-generated; mapping stored in `activeDownloads`; plain download started;
  rename applied via URL match in `onDeterminingFilename`. The blob fallback carries
  the explicit filename itself.

**B. Passive downloads**: `onDeterminingFilename` attributes them to the initiating
tab's metadata, falling back to the active tab, to `globalLastKnownMetadata`, and/or to
a DOI parsed from the download URL. A `.pdf` extension alone qualifies for renaming.
Naming is raced against a 4 s timeout; on failure the sanitized original name is placed
inside the save folder.

**HTML Shield**: any `text/html` download is cancelled unless the URL is a Google
Scholar or Libgen URL — preventing landing pages from saving as PDFs.

**Interceptor scope**: the capture-phase click handler only diverts links whose URL has
a PDF shape, and only outside `ACADEMIC_PUBLISHER_DOMAINS`; extension-injected buttons
carry `data-paperishere-bypass` and are skipped. External Academia.edu/ResearchGate
links and internal Sci-Hub/Libgen links are deliberately left alone.

## 13. Filename Generation and All Naming Styles

Pipeline (`generateFinalFilename`):

1. Extension resolution from original filename (`.php`/`.html` rejected; default `pdf`).
2. Libgen bibtext shortcut: captured text containing `@book` or `Publisher:` →
   `parseLibgenText` (supports BibTeX and plain-text forms) → deterministic
   name, **no AI call**.
3. DOI present → Crossref lookup → structured input → Gemini; Gemini failure ⇒
   deterministic fallback.
4. No DOI but title/text → Gemini directly (title + DOI hint + original-filename hint
   + up to 2 500 chars context).
5. Result stripped of trailing `.pdf`; correct extension appended; save-folder prefix
   applied (default `Renamed Papers`). `conflictAction: 'uniquify'` always used.
6. Total fallback: sanitized original filename.

Deterministic fallback (`generateFallbackName`) tokenizes titles via
`smartTokenizeAndFilter` (strips brackets, keeps words >2 chars, drops `STOP_WORDS`):

| Style ID (popup label) | Pattern | Example (prompt spec) |
|---|---|---|
| `kebab` (default) | `YYYY-LastNameInitials-kw_kw_kw.pdf` | `2015-BelenzonS-social_context_ownership_family_firms.pdf` |
| `pascal` | `YYYY-LastNameInitials-KwKwKw.pdf` (fused PascalCase, ≤6 kw) | `2015-BelenzonS-SocialContextOwnershipFamilyFirms.pdf` |
| `date-kebab` | `YYYYMMDD-LastNameInitials-kw_kw_kw.pdf` (missing M/D ⇒ 01) | `20150921-BelenzonS-social_context_ownership_family_firms.pdf` |
| `model1` | `YYYY_LastNameInitials_kw-kw-kw.pdf`; `_Vxx` only if stated in source | `2015_BelenzonS_social-context-ownership-family-firms.pdf` |
| `model2` | `YYYYMMDD_kw-kw-kw_type.pdf` (type only when the source states one) | `20260821_entrepreneur-resilience_methodology-design.pdf` |
| `model3` | `YYYYMMDD-kebab-description.pdf` | `20260821_development-progress-report.pdf` |

Missing years render as `0000`; the words `null`/`undefined` are never emitted
(the sanitizer works on whole tokens, not substrings).

## 14. Gemini Integration

- Endpoint: `generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`;
  POST `{contents:[{parts:[{text}]}]}` with the key in the `x-goog-api-key` header.
- Key read from `chrome.storage.session.geminiApiKey`; a key left in
  `chrome.storage.local` by an older version is migrated once and removed from local.
- Opt-in gate: `chrome.storage.local.geminiOptIn === false` skips AI naming entirely
  (`GEMINI_SKIP` log); a missing key is skipped the same way.
- System prompt per style (`getSystemPrompt`): role = expert Data Librarian;
  strict output format; stop-word removal; sanitization of `` * $ \ / < > | " ? [ ] ; = + ``
  with `&`→`And`; SMART_KEYWORD_RULE (identify field → prefer author keywords/JEL →
  keep core variables/contexts/populations → exclude metaphors and generic study
  words; `0000` for missing year).
- Input truncated to 4 000 chars; 8 s abort timeout.
- Response handling: first candidate text; strips ``` fences and literal
  `json`; rejects results ≤5 chars; replaces `null`→`0000`.

## 15. Crossref Integration

- `getCrossref(doi)`: GET
  `api.crossref.org/works/{doi}?mailto=researcher@example.com`, 6 s timeout.
- Date precedence: `published-print` → `published-online` → `issued` → `created`;
  zero-padded YYYYMMDD; missing ⇒ year `0000`.
- Uses **first author only** (`author?.[0].family` + given initials). Requires family
  + title + resolvable year; HTML stripped from titles.

## 16. Unpaywall Integration

- GET `api.unpaywall.org/v2/{doi}?email=researcher@example.com`; returns
  `best_oa_location.url_for_pdf` or `null`.
- Content script offers "Save PDF (Unpaywall)" only when a URL comes back.

## 17. Mirror Discovery

- Scraper (`fetchDynamicMirrors`, wrapped by `fetchDynamicSciHubs` /
  `fetchDynamicLibgens`): fetch `sci-hub.pub` / `librarygenesis.net`, remove
  `<del>/<s>/<strike>` blocks, regex out `sci-hub.*` / `libgen.*` hrefs, de-duplicate;
  fallback to hardcoded lists (sci-hub.st/.ru/.se; libgen.li/.vg/.rs).
- Liveness probing (`checkUrl` → `findActiveMirror`): sequential `HEAD`, retried as
  `GET`, 3.5 s abort each, success judged by `response.ok`; first success wins, else
  the first list entry.
- Persisted via `updateMirrors`; triggered on install (if unset) and via
  `pingMirrors`. Manual override possible in popup.

## 18. External Services and Integrations

| Service | Purpose | Auth | Status |
|---|---|---|---|
| api.crossref.org | DOI metadata for naming | polite `mailto=researcher@example.com` | Working |
| generativelanguage.googleapis.com (`gemini-1.5-flash`) | AI filename generation | user API key (session storage) | Working (opt-in) |
| api.unpaywall.org | Legal OA PDF location | `email=researcher@example.com` | Working |
| sci-hub.pub + mirrors | Mirror discovery; article access links | none | Best-effort |
| librarygenesis.net + mirrors | Mirror discovery; book search/download | none | Best-effort |
| annas-archive.org | Book/eBook search deep links | none | Link-out only |
| t.me Nexus bot (default `sks7777777nexusbot`) | Document-request deep link | none | Link-out only |
| scholar.google.com | Search deep links; DOI/text harvesting; PDF-result interception | none | Working |
| github.com/hsforhermes/PaperIsHere | Bug-report issue composer with logs | none | Working |

Privacy-relevant: with Gemini opted in, page-text snippets (≤2 500–4 000 chars) and
metadata are sent to Google; DOIs plus a hardcoded example email go to
Crossref/Unpaywall.

## 19. Chrome APIs and Permissions

Declared (`manifest.json`): `downloads`, `storage`, `activeTab`;
`host_permissions: <all_urls>`.

Actually used:
- `chrome.downloads`: `download()`, `onDeterminingFilename`, `cancel()` (HTML Shield).
- `chrome.storage.local`: config, logs, mirror domains.
- `chrome.storage.session`: metadata stores, rename map, Gemini key.
- `chrome.runtime`: messaging, `lastError`, `onInstalled`.
- `chrome.tabs.query`: attribution fallback when the initiating tab is unknown.

## 20. Persistent Storage Keys

`chrome.storage.local` (survives restarts):

| Key | Writer | Reader | Purpose |
|---|---|---|---|
| `saveFolder` | popup.js | background.js | Target subfolder (default `Renamed Papers`) |
| `namingStyle` | popup.js | background.js | `kebab,pascal,date-kebab,model1,model2,model3` |
| `fabEnabled` | popup.js | content.js | FAB visibility toggle |
| `geminiOptIn` | popup.js | background.js | AI naming consent gate |
| `sciHubDomain` | popup.js; updateMirrors | content.js; popup load | Active Sci-Hub origin |
| `libgenDomain` | popup.js; updateMirrors | content.js; popup load | Active Libgen origin |
| `annasDomain` | popup.js | content.js | Anna's Archive origin |
| `nexusBotUsername` | popup.js | content.js | Telegram bot handle |
| `systemLogs` | background.js | background.js; popup report | Ring buffer, max **100** entries, written through a serialized promise chain |

`chrome.storage.session` (cleared when the browser closes):

| Key | Writer | Reader | Purpose |
|---|---|---|---|
| `geminiApiKey` | popup.js; background.js migration | background.js | Gemini key, never written to local |
| `currentTabMetadata` / `globalLastKnownMetadata` / `activeDownloads` | background.js | background.js | MV3 survives-worker-restart state |

## 21. Runtime State and MV3 Service Worker Behavior

In-memory state in `background.js`, mirrored to `chrome.storage.session` on every
mutation and rehydrated lazily before use:

- `currentTabMetadata` — per-tab `{doi,isbn,text,title,tabId}` keyed by tab id.
- `globalLastKnownMetadata` — richest recent metadata; **Memory Shield** skips an
  update that concerns the same paper (`isSamePaper`: equal DOI, equal ISBN, or equal
  title when both sides lack identifiers) whose text is poor (<300 chars) while the
  stored text is rich (≥300 chars).
- `activeDownloads` — URL→filename map consumed by `onDeterminingFilename`.

Chrome may terminate the idle service worker at any time; session storage is what keeps
rename mappings and Memory Shield alive across that. Content-side state lives as long
as the page does, refreshed on SPA navigations via the MutationObserver debounce.
