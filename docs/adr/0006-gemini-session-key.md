# Gemini key in session storage with header auth and opt-in

The Gemini API key now lives in `chrome.storage.session` (cleared on browser close) instead of persisted plaintext in `chrome.storage.local`, travels in the `x-goog-api-key` header instead of a `?key=` query parameter, and is gated by a user-visible `geminiOptIn` toggle (default on, preserving behavior for existing key holders who pasted a key as their consent act).

## Considered Options

- Keep key in `local` + query param: rejected because keys persisted on disk indefinitely and leaked into URLs, referrers, and logs.
- Default opt-in off: rejected because it would silently disable AI naming for existing users; the key-paste plus visible toggle and popup notice is the consent surface.

## Consequences

Users re-enter the key after each browser restart. A one-time migration moves any `local`-stored key into session storage on first use.
