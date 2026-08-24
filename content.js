let doi = null;
let isbn = null;
let articleTitle = null; 
let publisherPdfUrl = null;
let pageText = "";
const isPublisherViewerPage = window.location.pathname.includes('/doi/epdf/') || window.location.pathname.includes('/doi/epub/');

const IGNORED_HOSTS = ['gemini.google.com', 'chatgpt.com', 'chat.openai.com', 'claude.ai', 'perplexity.ai'];

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
    
    const jstorMatch = window.location.href.match(/jstor\.org\/stable\/(\d+)/i);
    if (jstorMatch) {
        return `10.2307/${jstorMatch[1]}`;
    }

    const urlMatch = window.location.href.match(/\b(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)\b/i);
    if (urlMatch) {
        const href = window.location.href.toLowerCase();
        if (href.includes('/doi/') || href.includes('/article/') || href.includes('abs') || checkIsSciHub()) {
            return urlMatch[1].replace(/[.;,]$/, '');
        }
    }

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
    
    const textTop = document.body ? document.body.textContent.substring(0, 10000) : "";
    const textDoiMatch = textTop.match(/DOI\s*[:\u200B]?\s*\b(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)\b/i) || 
                         textTop.match(/https?:\/\/(?:dx\.)?doi\.org\/(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)\b/i) ||
                         textTop.match(/doi\s*=\s*[{"]?(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)[}"]?/i);
    if (textDoiMatch) {
        return textDoiMatch[1].replace(/[.;,]$/, '');
    }

    return null;
}

function extractIsbnStrict() {
    const metaIsbn = document.querySelector('meta[name="citation_isbn"], meta[property="isbn"], meta[name="prism.isbn"], meta[name="dc.identifier"]');
    if (metaIsbn && metaIsbn.content) {
        const clean = metaIsbn.content.replace(/[^0-9X]/gi, '');
        if (clean.length === 10 || clean.length === 13) return clean;
    }
    
    const urlMatch = window.location.pathname.match(/\b(97[89]\d{10})\b/);
    if (urlMatch) return urlMatch[1];

    const textTop = document.body ? document.body.textContent.substring(0, 5000) : "";
    const textMatch = textTop.match(/ISBN(?:-1[03])?\s*[:\u200B]?\s*(97[89][- \u2013]?\d{1,5}[- \u2013]?\d{1,7}[- \u2013]?\d{1,6}[- \u2013]?\d|\d{1,5}[- \u2013]?\d{1,7}[- \u2013]?\d{1,6}[- \u2013]?[\dX])/i);
    if (textMatch) {
        const clean = textMatch[1].replace(/[^0-9X]/gi, '');
        if (clean.length === 10 || clean.length === 13) return clean;
    }

    if (window.location.hostname.includes("libgen")) {
        const libgenMatch = document.body.textContent.match(/\b(97[89][- \u2013]?\d{1,5}[- \u2013]?\d{1,7}[- \u2013]?\d{1,6}[- \u2013]?\d)\b/);
        if (libgenMatch) {
            const clean = libgenMatch[1].replace(/[^0-9X]/gi, '');
            if (clean.length === 10 || clean.length === 13) return clean;
        }
    }
    
    return null;
}

function extractTitleFallback() {
    const metaTitle = document.querySelector('meta[name="citation_title"], meta[name="DC.Title"], meta[name="prism.title"], meta[property="og:title"]');
    if (metaTitle && metaTitle.content) return metaTitle.content.trim();

    const h1 = document.querySelector('h1');
    if (h1 && h1.innerText && h1.innerText.length > 5) {
        return h1.innerText.trim().replace(/\n+/g, ' ');
    }

    return document.title ? document.title.split('|')[0].split('-')[0].trim() : null;
}

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
    const textTop = document.body ? document.body.innerText.substring(0, 4000) : "";
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

    const rgBtn = document.querySelector('a[href*="fulltext"], a[href*="download"][href*="publication"]');
    if (window.location.hostname.includes('researchgate.net') && rgBtn) return sanitizePublisherUrl(rgBtn.href);

    const academiaBtn = document.querySelector('a.js-swp-download-button, a[href*="/attachments/download/"]');
    if (window.location.hostname.includes('academia.edu') && academiaBtn) return sanitizePublisherUrl(academiaBtn.href);

    const links = Array.from(document.querySelectorAll('a'));
    for (const a of links) {
        const href = (a.href || "").toLowerCase();
        const text = (a.innerText || a.textContent || "").toLowerCase().trim();
        
        if (!href || href === window.location.href.toLowerCase() || href.startsWith('javascript:')) continue;
        if (href.includes("sci-hub") || href.includes("libgen") || href.includes("annas-archive") || href.includes("t.me")) continue;
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

const directIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
const sciHubIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square"><path d="M12 2v20"></path><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>`;
const nexusIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
const bookIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>`;
const annasIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

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
        action: "triggerDirectDownload", url: downloadUrl, doi: doi, isbn: isbn, text: pageText, title: articleTitle
    }, (response) => {
        if (chrome.runtime.lastError || !response || !response.success) {
            btnElement.innerHTML = `<span style="color:red; font-size:10px;">✖ FAILED</span>`;
            chrome.runtime.sendMessage({ action: "logError", type: "UI_DOWNLOAD_FAIL", message: "Download triggered via UI failed", details: { url: downloadUrl, error: response?.error } });
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
    } else if (actionType === "native") {
        btn.href = url;
        btn.target = "_self";
    }

    btn.style.cssText = `
        display: flex; align-items: center; gap: 12px; background-color: #ffffff; color: #000000;
        padding: 12px 18px; border: 2px solid #000000; border-radius: 0px; text-decoration: none;
        font-family: 'Helvetica Neue', Arial, sans-serif; font-weight: 800; font-size: 14px;
        text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 4px 4px 0px ${buttonColor};
        transition: all 0.2s ease; pointer-events: auto; cursor: pointer; white-space: nowrap;
    `;
    btn.innerHTML = `<span style="color:${hoverColor}; display:flex; align-items:center;">${iconHtml}</span> ${title}`;
    btn.onmouseover = () => { btn.style.backgroundColor = "#000000"; btn.style.color = "#ffffff"; btn.style.boxShadow = `4px 4px 0px ${hoverColor}`; };
    btn.onmouseout = () => { btn.style.backgroundColor = "#ffffff"; btn.style.color = "#000000"; btn.style.boxShadow = `4px 4px 0px ${buttonColor}`; };
    return btn;
}

async function injectButtons() {
    if (IGNORED_HOSTS.some(h => window.location.hostname.includes(h))) return;

    const existingContainer = document.getElementById("paperishere-ui-wrapper");
    if (existingContainer) existingContainer.remove();

    const isLibgenDownloadPage = window.location.hostname.includes("libgen") && (window.location.pathname.includes("ads.php") || window.location.pathname.includes("get.php"));

    if (!doi && !isbn && !publisherPdfUrl && !articleTitle && !isLibgenDownloadPage && !isPublisherViewerPage) return;

    const wrapper = document.createElement("div");
    wrapper.id = "paperishere-ui-wrapper"; 
    wrapper.style.cssText = "position:fixed; bottom:24px; left:24px; z-index:9999999; display:flex; flex-direction:column; align-items:flex-start; gap:16px; pointer-events:none;";

    const menu = document.createElement("div");
    menu.id = "paperishere-ui-menu";
    menu.style.cssText = "display:flex; flex-direction:column; gap:12px; opacity:0; pointer-events:none; transform:translateY(20px) scale(0.95); transform-origin:bottom left; transition:all 0.2s ease;";

    if (publisherPdfUrl && !isPublisherViewerPage) {
        const btn = createDownloadButton("Save PDF (Direct)", publisherPdfUrl, directIcon, "bypass", "#000000", "#10B981");
        btn.style.order = "1";
        menu.appendChild(btn);
    } else if (publisherPdfUrl && isPublisherViewerPage) {
        const infoBtn = document.createElement("div");
        infoBtn.style.cssText = `display:flex; align-items:center; gap:12px; background-color:#f9f9f9; color:#888; padding:12px 18px; border:2px dashed #ccc; font-family:'Helvetica Neue', Arial, sans-serif; font-weight:800; font-size:11px; text-transform:uppercase; order:1; pointer-events:auto;`;
        infoBtn.innerHTML = `<span style="color:#888; display:flex; align-items:center;">${directIcon}</span> USE SITE'S NATIVE PDF BUTTON ↗`;
        menu.appendChild(infoBtn);
    }

    if (doi && !isPublisherViewerPage) {
        chrome.runtime.sendMessage({ action: "checkUnpaywall", doi: doi }, (response) => {
            if (response && response.url) {
                const btn = createDownloadButton("Save PDF (Unpaywall)", response.url, directIcon, "bypass", "#000000", "#10B981");
                btn.style.order = "2";
                menu.appendChild(btn);
            }
        });
    }

    const scholarQuery = doi || isbn || articleTitle;
    if (scholarQuery) {
        const btn = createDownloadButton("Search in Scholar", `https://scholar.google.com/scholar?q=${encodeURIComponent(scholarQuery)}`, directIcon, "blank");
        btn.style.order = "3";
        menu.appendChild(btn);
    }

    chrome.storage.local.get(['sciHubDomain', 'libgenDomain', 'annasDomain', 'nexusBotUsername'], (domains) => {
        if (doi) {
            const btn = checkIsSciHub() ? createDownloadButton("Save PDF", extractSciHubPdfUrl(), sciHubIcon, "bypass") : createDownloadButton("Get PDF (Sci-Hub)", `${domains.sciHubDomain || "https://sci-hub.st"}/${doi}`, sciHubIcon, "blank");
            btn.style.order = "4";
            menu.appendChild(btn);
        }

        if (doi || isbn || articleTitle) {
            const nexusTarget = doi || isbn || articleTitle;
            const btn = createDownloadButton("Search in Nexus (Telegram)", `https://t.me/${domains.nexusBotUsername || "sks7777777nexusbot"}?text=${encodeURIComponent(nexusTarget)}`, nexusIcon, "blank", "#000000", "#24A1DE");
            btn.style.order = "5";
            menu.appendChild(btn);
        }

        const bookSearchQuery = isbn || doi || articleTitle;
        if (bookSearchQuery && !isLibgenDownloadPage) {
            const libgenUrl = domains.libgenDomain || "https://libgen.li";
            const dynamicSearchUrl = buildLibgenSearchUrl(libgenUrl, bookSearchQuery);
            const btn = createDownloadButton("Search Libgen (Books)", dynamicSearchUrl, bookIcon, "blank");
            btn.style.order = "6";
            menu.appendChild(btn);
        }

        if (bookSearchQuery && !isLibgenDownloadPage) {
            let annasBase = domains.annasDomain || "https://annas-archive.org";
            try { annasBase = new URL(annasBase).origin; } catch(e) {}
            const cleanQuery = encodeURIComponent(bookSearchQuery).replace(/%2F/g, '/');
            const annasUrl = `${annasBase}/s/${cleanQuery}?`;
            const btn = createDownloadButton("Search Anna's Archive", annasUrl, annasIcon, "blank", "#000000", "#FF6B6B");
            btn.style.order = "7";
            menu.appendChild(btn);
        }
        
        if (isLibgenDownloadPage && extractLibgenDownloadUrl()) {
            const btn = createDownloadButton("Save PDF (Libgen)", extractLibgenDownloadUrl(), bookIcon, "native");
            btn.style.order = "8";
            menu.appendChild(btn);
        }
    });

    const fab = document.createElement("div");
    fab.style.cssText = "width:44px; height:44px; background-color:#000000; color:#ffffff; border:2px solid #000000; border-radius:0px; display:flex; justify-content:center; align-items:center; cursor:pointer; box-shadow:4px 4px 0px #7851A9; transition:all 0.1s ease; pointer-events:auto;";
    fab.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
    
    let isMenuOpen = false;
    fab.addEventListener('click', (e) => {
        e.stopPropagation();
        isMenuOpen = !isMenuOpen;
        if (isMenuOpen) {
            menu.style.opacity = "1";
            menu.style.pointerEvents = "auto";
            menu.style.transform = "translateY(0) scale(1)";
            fab.style.backgroundColor = "#ffffff";
            fab.style.color = "#000000";
            fab.style.boxShadow = "2px 2px 0px #7851A9";
            fab.style.transform = "translate(2px, 2px)";
            fab.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
        } else {
            menu.style.opacity = "0";
            menu.style.pointerEvents = "none";
            menu.style.transform = "translateY(20px) scale(0.95)";
            fab.style.backgroundColor = "#000000";
            fab.style.color = "#ffffff";
            fab.style.boxShadow = "4px 4px 0px #7851A9";
            fab.style.transform = "translate(0px, 0px)";
            fab.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
        }
    });

    wrapper.appendChild(menu);
    wrapper.appendChild(fab);
    document.body.appendChild(wrapper);
}

function initializeExtension() {
    if (IGNORED_HOSTS.some(h => window.location.hostname.includes(h))) return;

    doi = extractDoiStrict();
    isbn = extractIsbnStrict();
    articleTitle = extractTitleFallback();
    pageText = extractPageTextStrict();
    publisherPdfUrl = extractNativePdfUrlStrict();

    chrome.runtime.sendMessage({ action: "storeMetadata", doi: doi, isbn: isbn, text: pageText, title: articleTitle });
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
    const isScholarSite = window.location.hostname.includes('scholar.google.com');
    const isLibgenSite = window.location.hostname.includes('libgen');
    
    if (!isScholarSite && (href.includes('academia.edu') || href.includes('researchgate.net'))) {
        return; 
    }
    
    const isPdfText = aTag.innerText.toLowerCase().includes('download pdf') || 
                      aTag.innerText.toLowerCase().includes('save pdf') || 
                      aTag.innerText.toLowerCase().trim() === 'pdf' ||
                      aTag.innerText.toLowerCase().includes('[pdf]');
                      
    const isPdfLink = href.endsWith('.pdf') || href.includes('.pdf?') || href.includes('/doi/pdf/') || href.includes('/doi/epdf/') || isPdfText;
    
    const isScholarPdf = isScholarSite && 
                         (aTag.querySelector('.gs_ctg2') || aTag.closest('.gs_or_ggsm'));

    if ((isPdfLink || isScholarPdf) && href.startsWith('http')) {
        if (checkIsSciHub() || isLibgenSite) return;

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
            text: pageText,
            title: articleTitle
        }, (response) => {
            if (chrome.runtime.lastError || !response || !response.success) {
                aTag.innerHTML = `<span style="color:red; font-weight:bold; background:#fff0f0; padding:2px 4px; border-radius:4px;">✖ FAILED</span>`;
                chrome.runtime.sendMessage({ action: "logError", type: "INTERCEPTOR_FAIL", message: "Background download failed from interceptor", details: { url: aTag.href, error: response?.error } });
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