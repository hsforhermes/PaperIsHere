# PaperIsHere

Minimalist Chrome Extension (Manifest V3) that surfaces accessible PDF copies where available and renames downloaded PDFs into standardized names.

## Language

**Direct Save**:
A download the extension starts itself through the background pipeline and renames.
_Avoid_: bypass, direct download, auto-download

**Search Link**:
A deep-link the extension builds to a third-party platform for the user to continue manually.
_Avoid_: bypass, integration, mirror link

**Viewer Hijack Bypass**:
Intercepting a PDF-link click in the capture phase to prevent a third-party viewer from taking over navigation.
_Avoid_: paywall bypass, DRM bypass

**Restricted Access**:
A page showing paywall or login signals without an open-access badge.
_Avoid_: paywall, locked article

**Passive Rename**:
A rename applied to a download the user started normally.
_Avoid_: passive download, auto-rename

**Memory Shield**:
Protection that keeps rich article metadata from being overwritten by text-sparse pages of the same paper.
_Avoid_: metadata cache, abstract guard
