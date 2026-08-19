/**
 * PaperIsHere - Content Script
 * Strict Link Correction (epub -> epdf) & State-Aware Informational UI
 */

// Auto-redirect epub to epdf immediately to prevent the viewer trap
if (window.location.href.includes('/doi/epub/')) {
    window.location.replace(window.location.href.replace('/doi/epub/', '/doi/epdf/'));
}

let doi = null;
let isbn = null;
let articleTitle = null; 

// Extract DOI
const urlMatch = window.location.href.match(/\b(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)\b/i);
if (urlMatch) doi = urlMatch[1].replace(/[.;,]$/, '');
if (!doi) {
    const textMatch = document.body.innerText.match(/\b(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)\b/i);
    if (textMatch) doi = textMatch[1].replace(/[.;,]$/, '');
}

// Extract ISBN
const metaIsbn = document.querySelector('meta[name="citation_isbn"], meta[property="isbn"], meta[name="prism.isbn"]');
if (metaIsbn && metaIsbn.content) isbn = metaIsbn.content.replace(/[^0-9X]/gi, '');
if (!isbn) {
    const isbn13Match = document.body.innerText.match(/\b(97[89][- \u2013]?\d{1,5}[- \u2013]?\d{1,7}[- \u2013]?\d{1,6}[- \u2013]?\d)\b/);
    if (isbn13Match) isbn = isbn13Match[1].replace(/[^0-9]/g, '');
}
if (!isbn) {
    const isbn10Match = document.body.innerText.match(/ISBN(?:-10)?\s*[:\u200B]?\s*([\d]{1,5}[- \u2013]?[\d]{1,7}[- \u2013]?[\d]{1,6}[- \u2013]?[\dX])/i);
    if (isbn10Match) isbn = isbn10Match[1].replace(/[^0-9X]/gi, '');
}
if (isbn && isbn.length !== 10 && isbn.length !== 13) isbn = null;

// Extract Title
const metaTitle = document.querySelector('meta[name="citation_title"], meta[name="DC.Title"], meta[name="prism.title"]');
if (metaTitle && metaTitle.content) {
    articleTitle = metaTitle.content;
}

const pageText = document.body ? document.body.innerText.substring(0, 3000) : "";

function sanitizePublisherUrl(rawUrl) {
    if (!rawUrl) return null;
    let safeUrl = rawUrl;
    
    if (!safeUrl.startsWith('http')) {
        safeUrl = new URL(safeUrl, window.location.origin).href;
    }
    
    safeUrl = safeUrl.split('?')[0]; 
    
    if (safeUrl.includes('/doi/epub/')) {
        safeUrl = safeUrl.replace('/doi/epub/', '/doi/epdf/');
    }

    return safeUrl;
}

const isPublisherViewerPage = window.location.pathname.includes('/doi/epdf/') || window.location.pathname.includes('/doi/epub/');

function extractNativePdfUrl() {
    const meta = document.querySelector('meta[name="citation_pdf_url"]');
    if (meta && meta.content) return sanitizePublisherUrl(meta.content);

    const links = Array.from(document.querySelectorAll('a'));
    for (const a of links) {
        const href = (a.href || "").toLowerCase();
        const text = (a.innerText || a.textContent || "").toLowerCase().trim();
        const title = (a.title || "").toLowerCase();
        const className = (a.className || "").toString().toLowerCase();

        if (!href || href === window.location.href.toLowerCase() || href.startsWith('javascript:') || href.includes("sci-hub") || href.includes("libgen") || href.includes("t.me") || href.includes("mailto:")) continue;

        if (href.includes('/doi/pdf/') || href.includes('/doi/epdf/') || href.includes('/doi/epub/')) return sanitizePublisherUrl(a.href);
        if (href.endsWith('.pdf') || href.includes('.pdf?')) return sanitizePublisherUrl(a.href);
        
        if (text === 'pdf' || text === 'download pdf' || text.includes('pdf/epub') || text === 'article pdf') return sanitizePublisherUrl(a.href);
        if (title === 'pdf' || title.includes('download pdf')) return sanitizePublisherUrl(a.href);
        if (className.includes('pdf-link') || className.includes('download-pdf') || className === 'pdf' || className.includes('pdf-button')) return sanitizePublisherUrl(a.href);
    }
    
    if (isPublisherViewerPage && doi) {
        return sanitizePublisherUrl(`https://journals.sagepub.com/doi/epdf/${doi}`);
    }
    
    return null;
}

let publisherPdfUrl = extractNativePdfUrl();

chrome.runtime.sendMessage({ action: "storeMetadata", doi: doi, isbn: isbn, text: pageText });

// UI ICONS
const directIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
const sciHubIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square"><path d="M12 2v20"></path><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>`;
const nexusIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
const bookIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>`;

function checkIsSciHub() {
    const host = window.location.hostname.toLowerCase();
    if (host.includes("sci-hub") || host.includes("scihub") || host.includes("sci-net")) return true;
    if (document.getElementById('menu') && document.getElementById('article')) return true;
    return false;
}

function extractSciHubPdfUrl() {
    let downloadUrl = window.location.href;
    const dlBtn = document.querySelector('.download a') || document.querySelector('#menu a[href*=".pdf"]');
    const obj = document.querySelector('object[type="application/pdf"]');
    const iframe = document.querySelector('iframe');
    const embed = document.querySelector('embed');
    
    if (dlBtn && dlBtn.href) downloadUrl = dlBtn.href;
    else if (obj && obj.data) downloadUrl = obj.data;
    else if (embed && embed.src) downloadUrl = embed.src;
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

    if (getLinks.length > 0) {
        const primaryGet = getLinks.find(a => a.textContent.trim().toUpperCase() === "GET");
        if (primaryGet && primaryGet.href) return primaryGet.href;
        if (getLinks[0].href) return getLinks[0].href;
    }
    return null;
}

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
        action: "triggerDirectDownload",
        url: downloadUrl,
        doi: doi,
        isbn: isbn,
        text: pageText
    }, (response) => {
        if (chrome.runtime.lastError) {
            btnElement.innerHTML = `<span style="color:red; font-size:10px;">✖ ERR</span>`;
        } else if (response && response.success) {
            btnElement.innerHTML = `<span style="color:green;">✔</span> SAVED!`;
            setTimeout(() => {
                btnElement.innerHTML = originalHTML;
                btnElement.style.pointerEvents = "auto";
            }, 3000);
        } else {
            btnElement.innerHTML = `<span style="color:red; font-size:10px;">✖ FAILED</span>`;
            setTimeout(() => {
                btnElement.innerHTML = originalHTML;
                btnElement.style.pointerEvents = "auto";
            }, 4000);
        }
    });
}

function createDownloadButton(title, url, iconHtml, actionType, buttonColor = "#000000", hoverColor = "#7851A9") {
    const btn = document.createElement("a");

    if (actionType === "bypass") {
        btn.href = "javascript:void(0);";
        btn.onclick = (e) => {
            e.preventDefault();
            initiateDirectDownload(url, btn);
        };
    } else if (actionType === "blank") {
        btn.href = url;
        btn.target = "_blank";
        if (title.includes("Libgen")) {
            btn.addEventListener('click', () => {
                chrome.storage.local.set({ activeLibgenSearchContext: { doi: doi, isbn: isbn } });
            });
        }
    }

    btn.style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
        background-color: #ffffff;
        color: #000000;
        padding: 12px 18px;
        border: 2px solid #000000;
        border-radius: 0px;
        text-decoration: none;
        font-family: 'Helvetica Neue', Arial, sans-serif;
        font-weight: 800;
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        box-shadow: 4px 4px 0px ${buttonColor};
        transition: all 0.2s ease;
        margin-bottom: 12px;
        pointer-events: auto;
        cursor: pointer;
    `;

    btn.innerHTML = `<span style="color:${hoverColor}; display:flex; align-items:center;">${iconHtml}</span> ${title}`;

    btn.onmouseover = () => {
        btn.style.backgroundColor = "#000000";
        btn.style.color = "#ffffff";
        btn.style.boxShadow = `4px 4px 0px ${hoverColor}`;
    };
    btn.onmouseout = () => {
        btn.style.backgroundColor = "#ffffff";
        btn.style.color = "#000000";
        btn.style.boxShadow = `4px 4px 0px ${buttonColor}`;
    };

    return btn;
}

function buildLibgenSearchUrl(baseDomain, query) {
    const encodedQuery = encodeURIComponent(query);
    const cleanDomain = baseDomain.replace(/\/$/, "");
    const format2Domains = ["libgen.li", "libgen.vg", "libgen.lc"];
    const isFormat2 = format2Domains.some(domain => cleanDomain.includes(domain));

    if (isFormat2) {
        return `${cleanDomain}/index.php?req=${encodedQuery}&columns%5B%5D=t&columns%5B%5D=a&columns%5B%5D=s&columns%5B%5D=y&columns%5B%5D=p&columns%5B%5D=i&objects%5B%5D=f&objects%5B%5D=e&objects%5B%5D=s&objects%5B%5D=a&objects%5B%5D=p&objects%5B%5D=w&topics%5B%5D=l&topics%5B%5D=c&topics%5B%5D=f&topics%5B%5D=a&topics%5B%5D=m&topics%5B%5D=r&topics%5B%5D=s&res=25&gmode=on&filesuns=all`;
    }
    return `${cleanDomain}/search.php?req=${encodedQuery}`;
}

async function injectButtons() {
    const isLibgenDownloadPage = window.location.hostname.includes("libgen") && 
                                (window.location.pathname.includes("ads.php") || window.location.pathname.includes("get.php"));

    if (!doi && !isbn && !publisherPdfUrl && !articleTitle && !isLibgenDownloadPage && !isPublisherViewerPage) return;

    const container = document.createElement("div");
    container.style.cssText = "position:fixed; bottom:30px; left:30px; z-index:9999999; display:flex; flex-direction:column; pointer-events:none;";

    // PRIORITY 1: PUBLISHER LINK
    if (publisherPdfUrl) {
        if (!isPublisherViewerPage) {
            // Main page: standard button opening epdf in a new tab
            const btn = createDownloadButton("Open PDF (Direct)", publisherPdfUrl, directIcon, "blank", "#000000", "#10B981");
            btn.style.order = "1";
            container.appendChild(btn);
        } else {
            // Inside the publisher's viewer: Disabled, greyed-out informative button
            const infoBtn = document.createElement("div");
            infoBtn.style.cssText = `
                display: flex;
                align-items: center;
                gap: 12px;
                background-color: #f9f9f9;
                color: #888888;
                padding: 12px 18px;
                border: 2px dashed #cccccc;
                border-radius: 0px;
                font-family: 'Helvetica Neue', Arial, sans-serif;
                font-weight: 800;
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 12px;
                cursor: not-allowed;
                order: 1;
                pointer-events: auto;
            `;
            infoBtn.innerHTML = `<span style="color:#888888; display:flex; align-items:center;">${directIcon}</span> USE SITE'S NATIVE PDF BUTTON ↗`;
            container.appendChild(infoBtn);
        }
    }

    // PRIORITY 2: UNPAYWALL OPEN ACCESS
    if (doi && !isPublisherViewerPage) {
        chrome.runtime.sendMessage({ action: "checkUnpaywall", doi: doi }, (response) => {
            if (response && response.url) {
                const btn = createDownloadButton("Open PDF (Unpaywall)", response.url, directIcon, "blank", "#000000", "#10B981");
                btn.style.order = "2";
                container.appendChild(btn);
            }
        });
    }

    // PRIORITY 3: GOOGLE SCHOLAR
    const scholarQuery = doi || articleTitle || (doi ? document.title : null);
    if (scholarQuery) {
        const realScholarUrl = `https://scholar.google.com/scholar?q=${encodeURIComponent(scholarQuery)}`;
        const btn = createDownloadButton("Search in Scholar", realScholarUrl, directIcon, "blank");
        btn.style.order = "3";
        container.appendChild(btn);
    }

    // Load Settings
    chrome.storage.local.get(['sciHubDomain', 'libgenDomain', 'nexusBotUsername'], (domains) => {
        const sciHubUrl = domains.sciHubDomain || "https://sci-hub.st";
        const libgenUrl = domains.libgenDomain || "https://libgen.li";
        const nexusBotUsername = domains.nexusBotUsername || "sks7777777nexusbot";

        // PRIORITY 4: SCI-HUB
        if (doi) {
            const isOnSciHub = checkIsSciHub();
            let btn;
            if (isOnSciHub) {
                btn = createDownloadButton("Save PDF", extractSciHubPdfUrl(), sciHubIcon, "bypass");
            } else {
                btn = createDownloadButton("Get PDF (Sci-Hub)", `${sciHubUrl}/${doi}`, sciHubIcon, "blank");
            }
            btn.style.order = "4";
            container.appendChild(btn);
        }

        // PRIORITY 5: NEXUS (TELEGRAM)
        const nexusQuery = doi || isbn;
        if (nexusQuery) {
            const telegramUrl = `https://t.me/${nexusBotUsername}?text=${encodeURIComponent(nexusQuery)}`;
            const btn = createDownloadButton("Search in Nexus (Telegram)", telegramUrl, nexusIcon, "blank", "#000000", "#24A1DE");
            btn.style.order = "5";
            container.appendChild(btn);
        }

        // PRIORITY 6: LIBGEN
        const libgenQuery = isbn || doi;
        if (libgenQuery && !isLibgenDownloadPage) {
            const dynamicSearchUrl = buildLibgenSearchUrl(libgenUrl, libgenQuery);
            const btn = createDownloadButton("Search Libgen (Books)", dynamicSearchUrl, bookIcon, "blank");
            btn.style.order = "6";
            container.appendChild(btn);
        }

        // PRIORITY 7: LIBGEN DOWNLOAD PAGE
        if (isLibgenDownloadPage) {
            const downloadUrl = extractLibgenDownloadUrl();
            if (downloadUrl) {
                const btn = createDownloadButton("Save PDF (Libgen)", downloadUrl, bookIcon, "bypass");
                btn.style.order = "7";
                container.appendChild(btn);
            }
        }
    });

    document.body.appendChild(container);
}

if (window.location.hostname.includes('libgen')) {
    chrome.storage.local.get(['activeLibgenSearchContext'], (res) => {
        if (res.activeLibgenSearchContext) {
            doi = res.activeLibgenSearchContext.doi || doi;
            isbn = res.activeLibgenSearchContext.isbn || isbn;
            chrome.runtime.sendMessage({ 
                action: "storeMetadata", 
                doi: doi, 
                isbn: isbn, 
                text: pageText 
            });
        }
    });
}

injectButtons();