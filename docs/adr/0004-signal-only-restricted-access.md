# Signal-only Restricted Access detection

`isRestrictedAccess` no longer treats every non-OA Wiley page as restricted. A page counts as restricted only on explicit signals: paywall/login text or restricted selectors, with open-access badges short-circuiting to unrestricted. This restores Direct Save for entitled users behind institutional proxies at the cost of occasionally showing Direct Save on a truly paywalled Wiley page, where the publisher simply returns no PDF.
