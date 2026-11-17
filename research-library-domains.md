# Live domains for Z-Library, Libgen and Anna's Archive

Ticket: **#10 — "Live domains for Z-Library, Libgen and Anna's Archive"**
Probes run **2026-11-17**. Repo untouched.

## Method and its limits

- HTTP probes with `curl` (desktop Chrome UA, redirects followed up to 10), recording status, redirect count, and response headers.
- One third-party but actively maintained source: the Library Genesis Guide (<https://librarygenesis.net>), page dated **November 10, 2026**, which states it tests mirrors regularly and flags fakes.
- **No web search was available this run** (search API returned HTTP 402), so social/announcement channels could not be checked. Treat "official social account" as unverified.

No first-party machine-readable domain list was found for any of the three services.

## Measured reachability

| Domain | Status | Redirects | Verdict |
|---|---|---|---|
| `libgen.li` | 200 | 0 | reachable |
| `libgen.la` | 200 | 0 | reachable |
| `annas-archive.gl` | 200 | 0 | reachable |
| `annas-archive.org` | transport error | – | **not reachable from this network**; cannot be confirmed either way |
| `z-library.im` | 307 → self, loops cookieless | 10 | behind a cookie wall (`__diamwall`) |
| `z-library.sk` | 307 → self, loops cookieless | 10 | behind a cookie wall (`__diamwall`) |
| `z-lib.fm` | connection failed | – | down from here |
| `annas-archive.org` (retry) | transport error | – | same |

Both Z-Library hosts answered identically:

```
HTTP/2 307
server: openresty
location: https://<same-host>/
set-cookie: __diamwall=0x…; Domain=.<same-host>; Secure; SameSite=None
```

Same server banner, same cookie name, same value pattern, same self-redirect per host. That is strong evidence `z-library.im` and `z-library.sk` are the **same operation behind the same protection layer**, not a clone of each other. It also means an HTTP client cannot validate Z-Library by status code: a real host and a gated host both answer 307.

## Third-party source: Library Genesis Guide, November 2026

Reporting as of 2026-11-10 (<https://librarygenesis.net/>):

- **Libgen "Format 2" up:** `libgen.la`, `libgen.li`, `libgen.bz`; `libgen.gl` and `libgen.vg` reported down.
- **Libgen "Format 1" (all down):** `libgen.st`, `libgen.is`, `libgen.rs`, `libgen.re`, `libgen.yt`.
- **Flagged as NOT genuine:** `libgen.mx`, `libgen.ac`, `libgenesis.net`.
- **Anna's Archive legitimate domains:** `annas-archive.gl`, `annas-archive.pk`, `annas-archive.gd`; flagged as scams: `annas-archive.io`, `annas-archive.cc`.
- **Z-Library:** primary `z-library.sk`, mirrors `z-lib.fm`, `z-lib.gs`, `1lib.sk`, `es.1lib.sk`, `it.1lib.sk`.

The maintainer supplied `https://z-library.im/`. Nothing in this evidence contradicts it: it behaves exactly like `z-library.sk`. Both should be treated as valid seeds until a first-party statement says otherwise.

## Why the current code is fragile

- `fetchDynamicMirrors()` scrapes hardcoded hubs (`sci-hub.pub`, `librarygenesis.net`) for `href` patterns. `librarygenesis.net` links to these libraries for **informational** purposes and explicitly disclaims affiliation and deep links, so scraping it is both brittle and off-target.
- `findActiveMirror()` returns `urls[0]` when every probe fails, so an unverified domain is presented as if validated.
- Probing is `HEAD` then `GET` with a 3.5s budget. For Z-Library that is useless (307 to self); for a gated host, status alone proves nothing.

## Recommended resolution model (the decision input for #12)

1. **Seed list per service, shipped in code.** Z-Library: `z-library.im`, `z-library.sk`, `1lib.sk`. Libgen: `libgen.li`, `libgen.la`, `libgen.bz`. Anna's: `annas-archive.gl`, `annas-archive.org`, `annas-archive.pk`, `annas-archive.gd`. Sci-Hub: keep the three existing.
2. **Validate by content marker, not status.** Fetch the homepage with a 4s timeout and look for a service-specific marker string. A 307 to self is inconclusive, not failure: treat "gated but responding" as usable.
3. **User override wins, permanently.** The popup field stays authoritative; automatic results only fill a blank or replace a value that failed validation. Store the source of each value (`user` | `auto` | `seed`) so a refresh never silently overwrites a user choice.
4. **Refresh lazily and rarely.** On install and when a Search Link is about to be built, at most once per 24h; no background polling of library hosts.
5. **Fail visibly.** If no candidate validates, the menu entry is shown disabled with "domain unverified" rather than linking a domain known to be down.
6. **Never infer from a scraped guide page.** A maintained list can seed *new* candidates for a human-reviewed update, but the runtime must not adopt arbitrary domains from a third-party page.
7. **Clone defence.** Only hosts matching the bundled list or the user's own override are linked. Anything else is surfaced as unverified, never silently used.

No first-party announcement endpoint exists that an extension can poll, so a fully automatic "the community says the domain changed" feed is **not** implementable from this evidence; the honest design is seeds + validation + user override.
