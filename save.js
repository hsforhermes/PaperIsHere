// save.js — one Direct Save contract: pending label → background download → saved/failed → restore.
// Loaded before content.js in the same content-script scope.
// Interface: directSave({ element, url, page, labels, logType })
// The FAB and the interceptor differ only in how they pick the url and which labels they show.

const SAVE_RESTORE_MS = 3000;

function directSave({ element, url, page, labels, logType }) {
    const originalHTML = element.innerHTML;
    const originalPointerEvents = element.style.pointerEvents;

    element.innerHTML = labels.pending;
    element.style.pointerEvents = "none";

    chrome.runtime.sendMessage({
        action: "triggerDirectDownload",
        url: url,
        doi: page.doi,
        isbn: page.isbn,
        text: page.text,
        title: page.title
    }, (response) => {
        if (chrome.runtime.lastError || !response || !response.success) {
            element.innerHTML = labels.failed;
            chrome.runtime.sendMessage({ action: "logError", type: logType, message: "Direct Save failed", details: { url: url, error: response?.error } });
        } else {
            element.innerHTML = labels.saved;
        }
        setTimeout(() => {
            element.innerHTML = originalHTML;
            element.style.pointerEvents = originalPointerEvents;
        }, SAVE_RESTORE_MS);
    });
}
