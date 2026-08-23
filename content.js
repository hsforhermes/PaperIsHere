let doi = null;
let isbn = null;
let articleTitle = null; 
let publisherPdfUrl = null;
let pageText = "";
const isPublisherViewerPage = window.location.pathname.includes('/doi/epdf/') || window.location.pathname.includes('/doi/epub/');

if (window.location.href.includes('/doi/epub/')) {
    window.location.replace(window.location.href.replace('/doi/epub/', '/doi/epdf/'));
}

function checkIsSciHub() {
    const host = window.location.hostname.toLowerCase();
    if (host.includes("sci-hub") || host.includes("scihub") || host.includes("sci-net")) return true;
    if (document.getElementById('menu') && document.getElementById('article')) return true;
    return false;
}

function extractDoiStrict() {
    const metaDoi = document.querySelector('meta[name="citation_doi"], meta[name="prism.doi"], meta[name="dc.identifier"]');
    if (metaDoi && metaDoi.content) {
        const match = metaDoi.content.match(/\b(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)\b/i);
        if (match) return match[1].replace(/[.;,]$/, '');
    }
    
    const urlMatch = window.location.href.match(/\b(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)\b/i);
    if (urlMatch) {
        const href = window.location.href.toLowerCase();
        if (href.includes('/doi/') || href.includes('/article/') || href.includes('abs') || checkIsSciHub()) {
            return urlMatch[1].replace(/[.;,]$/, '');
        }
    }

    // --- NEW: Google Scholar Explicit DOI Extraction ---
    if (window.location.hostname.includes('scholar.google.com')) {
        const urlParams = new URLSearchParams(window.location.search);
        const q = urlParams.get('q') || '';
        const qMatch = q.match(/\b(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)\b/i);
        if (qMatch) return qMatch[1].replace(/[.;,]$/, '');
        
        const searchInput = document.querySelector('input[name="q"]');
        if (searchInput && searchInput.value) {
            const inputMatch = searchInput.value.match(/\b(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)\b/i);
            if (inputMatch) return inputMatch[1].replace(/[.;,]$/, '');
        }
    }
    
    return null;
}

function extractIsbnStrict() {
    const metaIsbn = document.querySelector('meta[name="citation_isbn"], meta[property="isbn"], meta[name="prism.isbn"]');
    if (metaIsbn && metaIsbn.content) return metaIsbn.content.replace(/[^0-9X]/gi, '');
    
    if (window.location.hostname.includes("libgen")) {
        const isbn13Match = document.body.innerText.match(/\b(97[89][- \u2013]?\d{1,5}[- \u2013]?\d{1,7}[- \u2013]?\d{1,6}[- \u2013]?\d)\b/);
        if (isbn13Match) return isbn13Match[1].replace(/[^0-9]/g, '');
    }
    return null;
}

// --- NEW: Clean Text Extraction for Scholar AI Accuracy ---
function extractPageTextStrict() {
    if (window.location.hostname.includes("scholar.google.com")) {
        const results = document.querySelectorAll('.gs_ri');
        if (results.length > 0) {
            return Array.from(results).map(r => r.innerText).join('\n\n').substring(0, 3000);
        }
    }
    return document.body ? document.body.innerText.substring(0, 3000) : "";
}

function isRestrictedAccess() {
    const textTop = document.body.innerText.substring(0, 4000);
    const isWiley = window.location.hostname.includes('wiley.com');
    
    if (textTop.includes("Get access to the full version") || 
        textTop.includes("Purchase Instant Access") || 
        textTop.includes("Institutional Login") ||
        textTop.includes("Log in to Wiley Online Library") ||
        document.querySelector('.login-options, .paywall-article, .access-options, #paywall-banner, .article-paywall')) {
        return true; 
    }

    const openAccessSelectors = [
        '.access-icon.open', '.open-access', 'img[alt*="Open Access"]', 
        'img[alt*="Free Access"]', '.doi-access.open', '.oa-open'
    ];
    const hasOABadge = document.querySelector(openAccessSelectors.join(', '));
    
    if (hasOABadge || textTop.includes("Open access") || textTop.includes("Open Access") || textTop.includes("Free access")) {
        return false; 
    }

    if (isWiley && !hasOABadge) return true; 

    if (document.querySelector('.access-icon.restricted, img[alt*="Restricted"], [data-access-type="restricted"], .icon-lock')) {
        return true;
    }

    if (textTop.includes("Restricted access") || textTop.includes("Purchase article")) {
        return true;
    }
    
    return false;
}

function sanitizePublisherUrl(rawUrl) {
    if (!rawUrl) return null;
    let safeUrl = rawUrl;
    if (!safeUrl.startsWith('http')) safeUrl = new URL(safeUrl, window.location.origin).href;
    safeUrl = safeUrl.split('?')[0]; 
    if (safeUrl.includes('/doi/epub/')) safeUrl = safeUrl.replace('/doi/epub/', '/doi/epdf/');
    return safeUrl;
}

function extractNativePdfUrlStrict() {
    if (isRestrictedAccess()) return null; 

    const meta = document.querySelector('meta[name="citation_pdf_url"]');
    if (meta && meta.content) return sanitizePublisherUrl(meta.content);

    const links = Array.from(document.querySelectorAll('a'));
    for (const a of links) {
        const href = (a.href || "").toLowerCase();
        const text = (a.innerText || a.textContent || "").toLowerCase().trim();
        
        if (!href || href === window.location.href.toLowerCase() || href.startsWith('javascript:')) continue;
        if (href.includes("sci-hub") || href.includes("libgen") || href.includes("t.me")) continue;
        if (href.includes('onlinelibrary.wiley.com/doi/pdf/') && isRestrictedAccess()) continue;

        if (href.includes('/doi/pdf/') || href.includes('/doi/epdf/') || href.includes('/doi/epub/')) return sanitizePublisherUrl(a.href);
        if (text === 'download pdf' || text === 'article pdf' || text.includes('pdf/epub')) return sanitizePublisherUrl(a.href);
    }
    
    if (isPublisherViewerPage && doi) return sanitizePublisherUrl(`https://journals.sagepub.com/doi/epdf/${doi}`);
    return null;
}

function extractSciHubPdfUrl() { 
    let downloadUrl = window.location.href;
    const dlBtn = document.querySelector('.download a') || document.querySelector('#menu a[href*=".pdf"]');
    const obj = document.querySelector('object[type="application/pdf"]');
    const iframe = document.querySelector('iframe');
    
    if (dlBtn && dlBtn.href) downloadUrl = dlBtn.href;
    else if (obj && obj.data) downloadUrl = obj.data;
    else if (iframe && iframe.src) downloadUrl = iframe.src;

    if (downloadUrl.startsWith('//')) downloadUrl = 'https:' + downloadUrl;
    else if (downloadUrl.startsWith('/')) downloadUrl = window.location.origin + downloadUrl;
    return downloadUrl;
}

function extractLibgenDownloadUrl() { 
    const getLinks = Array.from(document.querySelectorAll('a')).filter(a => {
        const text = a.textContent.trim().toUpperCase();
        return text === "GET" || text === "CLOUDFLARE" || text === "IPFS.IO" || text === "PINATA";
    });
    if (getLinks.length > 0) return getLinks[0].href;
    return null;
}

const directIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
const sciHubIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square"><path d="M12 2v20"></path><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>`;
const nexusIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
const bookIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>`;

function initiateDirectDownload(originalUrl, btnElement) {
    const originalHTML = btnElement.innerHTML;
    btnElement.innerHTML = `<span style="color:#7851A9;">⏳</span> AI NAMING...`;
    btnElement.style.pointerEvents = "none";

    let downloadUrl = originalUrl;
    if (checkIsSciHub()) {
        downloadUrl = extractSciHubPdfUrl();
    } else if (window.location.hostname.includes("libgen") && (window.location.pathname.includes("ads.php") || window.location.pathname.includes("get.php"))) {
        const libgenDirectUrl = extractLibgenDownloadUrl();
        if (libgenDirectUrl) downloadUrl = libgenDirectUrl;
    }

    chrome.runtime.sendMessage({
        action: "triggerDirectDownload", url: downloadUrl, doi: doi, isbn: isbn, text: pageText
    }, (response) => {
        if (chrome.runtime.lastError || !response || !response.success) {
            btnElement.innerHTML = `<span style="color:red; font-size:10px;">✖ FAILED</span>`;
        } else {
            btnElement.innerHTML = `<span style="color:green;">✔</span> SAVED!`;
        }
        setTimeout(() => { btnElement.innerHTML = originalHTML; btnElement.style.pointerEvents = "auto"; }, 3000);
    });
}

function createDownloadButton(title, url, iconHtml, actionType, buttonColor = "#000000", hoverColor = "#7851A9") {
    const btn = document.createElement("a");
    if (actionType === "bypass") {
        btn.href = "javascript:void(0);";
        btn.onclick = (e) => { e.preventDefault(); initiateDirectDownload(url, btn); };
    } else if (actionType === "blank") {
        btn.href = url;
        btn.target = "_blank";
        if (title.includes("Libgen")) btn.addEventListener('click', () => chrome.storage.local.set({ activeLibgenSearchContext: { doi: doi, isbn: isbn } }));
    }

    btn.style.cssText = `
        display: flex; align-items: center; gap: 12px; background-color: #ffffff; color: #000000;
        padding: 12px 18px; border: 2px solid #000000; border-radius: 0px; text-decoration: none;
        font-family: 'Helvetica Neue', Arial, sans-serif; font-weight: 800; font-size: 14px;
        text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 4px 4px 0px ${buttonColor};
        transition: all 0.2s ease; margin-bottom: 12px; pointer-events: auto; cursor: pointer;
    `;
    btn.innerHTML = `<span style="color:${hoverColor}; display:flex; align-items:center;">${iconHtml}</span> ${title}`;
    btn.onmouseover = () => { btn.style.backgroundColor = "#000000"; btn.style.color = "#ffffff"; btn.style.boxShadow = `4px 4px 0px ${hoverColor}`; };
    btn.onmouseout = () => { btn.style.backgroundColor = "#ffffff"; btn.style.color = "#000000"; btn.style.boxShadow = `4px 4px 0px ${buttonColor}`; };
    return btn;
}

async function injectButtons() {
    const existingContainer = document.getElementById("paperishere-ui-container");
    if (existingContainer) existingContainer.remove();

    const isLibgenDownloadPage = window.location.hostname.includes("libgen") && (window.location.pathname.includes("ads.php") || window.location.pathname.includes("get.php"));

    if (!doi && !isbn && !publisherPdfUrl && !articleTitle && !isLibgenDownloadPage && !isPublisherViewerPage) return;

    const container = document.createElement("div");
    container.id = "paperishere-ui-container"; 
    container.style.cssText = "position:fixed; bottom:30px; left:30px; z-index:9999999; display:flex; flex-direction:column; pointer-events:none;";

    if (publisherPdfUrl && !isPublisherViewerPage) {
        const btn = createDownloadButton("Save PDF (Direct)", publisherPdfUrl, directIcon, "bypass", "#000000", "#10B981");
        btn.style.order = "1";
        container.appendChild(btn);
    } else if (publisherPdfUrl && isPublisherViewerPage) {
        const infoBtn = document.createElement("div");
        infoBtn.style.cssText = `display:flex; align-items:center; gap:12px; background-color:#f9f9f9; color:#888; padding:12px 18px; border:2px dashed #ccc; font-family:'Helvetica Neue', Arial, sans-serif; font-weight:800; font-size:11px; text-transform:uppercase; margin-bottom:12px; order:1; pointer-events:auto;`;
        infoBtn.innerHTML = `<span style="color:#888; display:flex; align-items:center;">${directIcon}</span> USE SITE'S NATIVE PDF BUTTON ↗`;
        container.appendChild(infoBtn);
    }

    if (doi && !isPublisherViewerPage) {
        chrome.runtime.sendMessage({ action: "checkUnpaywall", doi: doi }, (response) => {
            if (response && response.url) {
                const btn = createDownloadButton("Save PDF (Unpaywall)", response.url, directIcon, "bypass", "#000000", "#10B981");
                btn.style.order = "2";
                container.appendChild(btn);
            }
        });
    }

    const scholarQuery = doi || articleTitle || (doi ? document.title : null);
    if (scholarQuery) {
        const btn = createDownloadButton("Search in Scholar", `https://scholar.google.com/scholar?q=${encodeURIComponent(scholarQuery)}`, directIcon, "blank");
        btn.style.order = "3";
        container.appendChild(btn);
    }

    chrome.storage.local.get(['sciHubDomain', 'libgenDomain', 'nexusBotUsername'], (domains) => {
        if (doi) {
            const btn = checkIsSciHub() ? createDownloadButton("Save PDF", extractSciHubPdfUrl(), sciHubIcon, "bypass") : createDownloadButton("Get PDF (Sci-Hub)", `${domains.sciHubDomain || "https://sci-hub.st"}/${doi}`, sciHubIcon, "blank");
            btn.style.order = "4";
            container.appendChild(btn);
        }

        if (doi || isbn) {
            const btn = createDownloadButton("Search in Nexus (Telegram)", `https://t.me/${domains.nexusBotUsername || "sks7777777nexusbot"}?text=${encodeURIComponent(doi || isbn)}`, nexusIcon, "blank", "#000000", "#24A1DE");
            btn.style.order = "5";
            container.appendChild(btn);
        }

        if ((isbn || doi) && !isLibgenDownloadPage) {
            const btn = createDownloadButton("Search Libgen (Books)", `${(domains.libgenDomain || "https://libgen.li").replace(/\/$/, "")}/search.php?req=${encodeURIComponent(isbn || doi)}`, bookIcon, "blank");
            btn.style.order = "6";
            container.appendChild(btn);
        }
        
        if (isLibgenDownloadPage && extractLibgenDownloadUrl()) {
            const btn = createDownloadButton("Save PDF (Libgen)", extractLibgenDownloadUrl(), bookIcon, "bypass");
            btn.style.order = "7";
            container.appendChild(btn);
        }
    });
    document.body.appendChild(container);
}

function initializeExtension() {
    doi = extractDoiStrict();
    isbn = extractIsbnStrict();
    pageText = extractPageTextStrict();
    articleTitle = document.querySelector('meta[name="citation_title"], meta[name="DC.Title"], meta[name="prism.title"]')?.content || null;
    publisherPdfUrl = extractNativePdfUrlStrict();

    chrome.runtime.sendMessage({ action: "storeMetadata", doi: doi, isbn: isbn, text: pageText });
    injectButtons();
}

initializeExtension();

let lastKnownUrl = location.href;
new MutationObserver(() => {
    if (location.href !== lastKnownUrl) {
        lastKnownUrl = location.href;
        setTimeout(initializeExtension, 800); 
    }
}).observe(document.body, { childList: true, subtree: true });

document.addEventListener('click', function(e) {
    const aTag = e.target.closest('a');
    if (!aTag || !aTag.href) return;
    
    if (aTag.hasAttribute('onclick') && aTag.getAttribute('onclick').includes('initiateDirectDownload')) return;

    const href = aTag.href.toLowerCase();
    const isPdfLink = href.endsWith('.pdf') || href.includes('/doi/pdf/') || href.includes('/doi/epdf/');
    const isScholarPdf = window.location.hostname.includes('scholar.google.com') && 
                         (aTag.innerText.includes('[PDF]') || 
                          aTag.querySelector('.gs_ctg2') || 
                          aTag.closest('.gs_or_ggsm') || 
                          href.endsWith('.pdf'));

    if ((isPdfLink || isScholarPdf) && href.startsWith('http')) {
        if (checkIsSciHub() || window.location.hostname.includes('libgen')) return;

        e.preventDefault();
        e.stopPropagation();

        const originalHTML = aTag.innerHTML;
        aTag.innerHTML = `<span style="color:#7851A9; font-weight:bold; background:#f0f0f0; padding:2px 4px; border-radius:4px;">⏳ AI SAVING...</span>`;
        
        const originalPointerEvents = aTag.style.pointerEvents;
        aTag.style.pointerEvents = "none";

        chrome.runtime.sendMessage({
            action: "triggerDirectDownload",
            url: aTag.href,
            doi: doi, 
            isbn: isbn,
            text: pageText
        }, (response) => {
            if (chrome.runtime.lastError || !response || !response.success) {
                aTag.innerHTML = `<span style="color:red; font-weight:bold; background:#fff0f0; padding:2px 4px; border-radius:4px;">✖ FAILED</span>`;
            } else {
                aTag.innerHTML = `<span style="color:green; font-weight:bold; background:#f0fff0; padding:2px 4px; border-radius:4px;">✔ SAVED!</span>`;
            }
            setTimeout(() => {
                aTag.innerHTML = originalHTML;
                aTag.style.pointerEvents = originalPointerEvents;
            }, 3000);
        });
    }
}, true);