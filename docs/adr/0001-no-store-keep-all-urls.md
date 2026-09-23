# No Chrome Web Store listing; keep `<all_urls>`

We are not pursuing a Chrome Web Store listing in this hardening pass, so we keep `<all_urls>` host permissions and declarative injection into every page. We drop only the unused `alarms` and `scripting` permissions.

## Considered Options

- Shrink to `ACADEMIC_PUBLISHER_DOMAINS` + Scholar + mirrors: rejected for now because coverage (search-result pages, new publishers) matters more than review risk while distribution is local unpacked loads.
- Pursue Store listing now: rejected because Sci-Hub/Libgen Search Links plus maximal hosts would invite rejection; that is a separate future decision with its own host-by-host justification.
