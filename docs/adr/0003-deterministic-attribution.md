# Deterministic download attribution via sender tab

UI-initiated downloads already carry their metadata in the `triggerDirectDownload` message. For the passive path, `onDeterminingFilename` looks up the initiating tab's stored metadata from the session cache and falls back to the global shield only when the tab store is empty or text-poor. The old `active-tab` query remains only as the best-effort tab picker for passive downloads, which carry no tab identity.

## Consequences

Concurrent downloads across windows can still misattribute on the passive path; only the UI-initiated path is fully deterministic. Same-paper comparison is by DOI/ISBN equality, falling back to title equality only when both sides carry no DOI and no ISBN — so text-sparse viewer pages of the same paper never wipe a rich abstract, while a different untagged paper still replaces it.
