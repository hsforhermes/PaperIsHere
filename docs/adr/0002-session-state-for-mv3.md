# Persist MV3 runtime state in `chrome.storage.session`

`currentTabMetadata`, `globalLastKnownMetadata`, and `activeDownloads` move from plain globals to `chrome.storage.session` with an in-memory cache and rehydrate-on-wake. The session store survives service-worker suspension and clears on browser close, which matches the lifetime we want for rename state.

## Considered Options

- Rehydrate from `chrome.storage.local`: rejected because rename state should not persist across browser restarts or consume local quota.
- Key renames by `downloadId` only: useful follow-up for `activeDownloads`, but not a substitute for per-tab metadata survival.
