# Why Direct Save fails on publisher PDFs

Ticket: **#9 — "Why Direct Save fails on publisher PDFs"**
Repo: `/Users/hosseinsamani/Projects/PaperIsHere` @ 2.5.0. Probes run **2026-11-17**. No repo file modified.

## Method, and what the numbers mean

Two independent evidence sources:

1. **Primary documentation** for what the extension's APIs can and cannot do (Chrome `downloads` reference, MDN forbidden headers, Chrome `declarativeNetRequest` reference).
2. **Cookieless HTTP probes** of real publisher PDF endpoints with a desktop Chrome user agent. These show what the *download URL* returns when it has no session cookie and no `Referer` — the worst case, and the case a signed-out user hits. They do **not** reproduce a signed-in browser, where `chrome.downloads` sends the user's cookies.

Every row below says which kind of evidence it is.

## Platform facts (verified against primary docs)

| Fact | Consequence | Source |
|---|---|---|
| `downloads.download` **does** send "all cookies currently set for its hostname". | The ticket's premise "the downloads API sends no cookies" is **wrong**. Cookies are not the gap for the direct path. | <https://developer.chrome.com/docs/extensions/reference/api/downloads> (method `download()`) |
| `DownloadOptions.headers` exists but is "restricted to those allowed by XMLHttpRequest". `Referer` is a forbidden request header; MDN notes it is only settable through `fetch`'s `referrer` option, not a raw header. | **Cannot set `Referer` through the downloads API.** Hotlink protection cannot be defeated by adding a header here. | <https://developer.mozilla.org/en-US/docs/Glossary/Forbidden_request_header> |
| `onDeterminingFilename` fires "after the file's MIME type and a tentative filename have been determined", and the item carries `mime`. | The HTML Shield's `item.mime === 'text/html'` test acts on what the server actually returned. Any publisher that answers a real PDF URL with an HTML interstitial is **cancelled**, not downloaded. | <https://developer.chrome.com/docs/extensions/reference/api/downloads> (event `onDeterminingFilename`) |
| `declarativeNetRequest` `modifyHeaders` can `set` / `remove` request headers (including `cookie`), with `append` limited to specific headers. | Setting `Referer`/`Origin` on the browser's own requests is *plausible* via DNR; whether DNR rules apply to requests initiated by `chrome.downloads` is **not stated** in the reference and must be tested before it is designed in. | <https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest> (HeaderOperation, modifyHeaders example) |
| MV3 service workers are terminated when idle; `fetch` in the worker is cross-origin with `credentials: 'same-origin'` by default. | `fallbackBlobDownload` has neither the page's cookies nor a CORS grant from most publishers, and can be killed mid-transfer. | Chrome MV3 service-worker lifecycle docs |

## Measured matrix (cookieless, no Referer, desktop UA, 2026-11-17)

| Publisher | Probed URL shape | Status | Content-Type | Reading |
|---|---|---|---|---|
| Wiley | `onlinelibrary.wiley.com/doi/pdf/<doi>` | **403** | `text/html` | Bot/edge block before any PDF. A plain download gets an error page. |
| Taylor & Francis | `tandfonline.com/doi/pdf/<doi>` | **403** | `text/html` | Same. |
| SAGE | `journals.sagepub.com/doi/pdf/<doi>` | **403** | `text/html` | Same. |
| ACM | `dl.acm.org/doi/pdf/<doi>` | **403** | `text/html` | Same. |
| IEEE Xplore | `ieeexplore.ieee.org/stampPDF/getPDF.jsp?tp=&arnumber=<n>` | **418** | `text/html` | Explicit bot challenge; not a PDF at all. |
| Springer Nature | `link.springer.com/content/pdf/<doi>.pdf` | **200** | `text/html` | **The silent killer.** Correct status, correct-looking URL, HTML body. Today this becomes an HTML-Shield cancel with no user-visible reason. |
| MDPI | `mdpi.com/<issn>/<vol>/<issue>/<id>/pdf` | **403** | `text/html` | Edge challenge on this path. |
| arXiv | `arxiv.org/pdf/<id>` | **200** | `application/pdf` | Works. The good case. |

Caveat: signed-in sessions may succeed where these fail, because the browser sends cookies. That is exactly why the failure is intermittent and publisher-specific rather than total.

## Failure classes, ranked by how much of the symptom they explain

1. **HTML returned from a "PDF" URL (Springer measured; likely Wiley/T&F interstitials too).** Today: HTML Shield cancels it and the label says "FAILED" with no reason. Fix direction: detect `text/html` *before* cancelling, keep the tab or surface the landing URL, and never present a cancel as a silent failure.
2. **Edge bot challenge / 403 (Wiley, T&F, SAGE, ACM, MDPI, IEEE).** The download request looks unlike the page's own XHR (no `Referer`, no `Origin`, different `Sec-Fetch-*`). Fix direction: prefer the site's own resolved PDF URL obtained from the page context, or open the PDF tab and let the browser negotiate; treat a 403 as "use the site's button", not as a retry.
3. **JS-resolved PDF URLs.** ScienceDirect/Wiley produce the final PDF URL only after client code runs; the anchor's `href` is an intermediate. Fix direction: per-publisher resolver in the content script, or a documented fallback.
4. **`fallbackBlobDownload` cannot succeed cross-origin.** No page credentials, no CORS, worker can die. Fix direction: delete it as a general fallback; keep a blob path only for same-origin or explicitly CORS-open hosts.
5. **Signed / one-time URLs.** Retrying a consumed URL 403s. Fix direction: never reuse a URL across attempts.
6. **Mirror liveness is unverified.** `findActiveMirror` returns `urls[0]` when every probe fails, so a dead domain is handed to the user as if it were live.
7. **Attribution race in Passive Rename.** `onDeterminingFilename` keys `activeDownloads` on `item.url`/`item.finalUrl` and resolves the tab with `chrome.tabs.query({active:true})`; `DownloadItem` carries no tab id in the event, so a download started from a background tab can be renamed with the foreground tab's metadata. The event does expose `byExtensionId`, which distinguishes extension-initiated downloads.
8. **4s naming race.** Crossref + Gemini inside the download handshake; a slow chain loses the name and leaves the raw filename.

## What this ticket cannot settle, and the protocol that can

Per-publisher signed-in behaviour needs a real browser session, which is not available to an AFK research run. Before the build commits to a technique per publisher, run this protocol once per publisher, signed out and signed in:

1. Open the article page, click the site's own PDF button, record the final URL and `Content-Type` from the Network panel.
2. Trigger Direct Save on the same article; record the `DownloadItem` (`mime`, `error`, `finalUrl`, `referrer`).
3. Compare: same URL? same MIME? difference in `Referer`/`Sec-Fetch-*`?

That matrix — not this document — is the acceptance evidence for the engine work.

## Boundary

Nothing here proposes paywall circumvention. Restricted Access stays detection-and-suppression: when the page signals no open access, the engine suppresses the action rather than trying to defeat the block.
