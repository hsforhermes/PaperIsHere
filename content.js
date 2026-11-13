// Page reading lives in page.js (loaded first). This file owns the FAB, menu and links.
let pageInfo = { doi: null, isbn: null, title: null, text: "", pdfUrl: null, restricted: false, sciHub: false, viewer: isViewerPath(window.location) };

function shouldShowFAB() {
    if (hostMatches(window.location.hostname, IGNORED_HOSTS)) return false;

    const pathname = window.location.pathname.toLowerCase();
    const href = window.location.href.toLowerCase();

    const hasDoi = !!pageInfo.doi;
    const hasIsbn = !!pageInfo.isbn;
    const hasPdfUrl = !!pageInfo.pdfUrl;
    
    const hasAcademicPath = pathname.includes('/doi/') || 
                            pathname.includes('/article/') || 
                            pathname.includes('/abs/') || 
                            pathname.includes('/reader/') ||
                            pathname.includes('/full/') ||
                            pathname.includes('/epdf/') ||
                            pathname.includes('/epub/') ||
                            pathname.includes('/pdf/') ||
                            href.includes('jstor.org/stable/');

    const isOnPublisher = hostMatches(window.location.hostname, ACADEMIC_PUBLISHER_DOMAINS);
    
    if (hasDoi || hasIsbn || hasPdfUrl) {
        return true;
    }
    
    if (isOnPublisher && hasAcademicPath) {
        return true;
    }
    
    if (pageInfo.viewer) {
        return true;
    }

    return false;
}

if (window.location.href.includes('/doi/epub/')) {
    window.location.replace(window.location.href.replace('/doi/epub/', '/doi/epdf/'));
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

const FAB_SAVE_LABELS = {
    pending: `<span style="color:#7851A9;">⏳</span> AI NAMING...`,
    saved: `<span style="color:green;">✔</span> SAVED!`,
    failed: `<span style="color:red; font-size:10px;">✖ FAILED</span>`
};

const LINK_SAVE_LABELS = {
    pending: `<span style="color:#7851A9; font-weight:bold; background:#f0f0f0; padding:2px 4px; border-radius:4px;">⏳ AI SAVING...</span>`,
    saved: `<span style="color:green; font-weight:bold; background:#f0fff0; padding:2px 4px; border-radius:4px;">✔ SAVED!</span>`,
    failed: `<span style="color:red; font-weight:bold; background:#fff0f0; padding:2px 4px; border-radius:4px;">✖ FAILED</span>`
};

function initiateDirectDownload(originalUrl, btnElement) {
    let downloadUrl = originalUrl;
    if (pageInfo.sciHub) {
        downloadUrl = extractSciHubPdfUrl();
    } else if (window.location.hostname.includes("libgen") && (window.location.pathname.includes("ads.php") || window.location.pathname.includes("get.php"))) {
        const libgenDirectUrl = extractLibgenDownloadUrl();
        if (libgenDirectUrl) downloadUrl = libgenDirectUrl;
    }

    directSave({ element: btnElement, url: downloadUrl, page: pageInfo, labels: FAB_SAVE_LABELS, logType: "UI_DOWNLOAD_FAIL" });
}

function createDownloadButton(title, url, iconHtml, actionType, buttonColor = "#000000", hoverColor = "#7851A9") {
    const btn = document.createElement("a");
    btn.className = "paperishere-btn";
    if (actionType === "bypass") {
        btn.href = "javascript:void(0);";
        btn.dataset.paperishereBypass = "true";
        btn.onclick = (e) => { e.preventDefault(); initiateDirectDownload(url, btn); };
    } else if (actionType === "blank") {
        btn.href = url;
        btn.target = "_blank";
        if (title.includes("Libgen")) btn.addEventListener('click', () => chrome.storage.local.set({ activeLibgenSearchContext: { doi: pageInfo.doi, isbn: pageInfo.isbn } }));
    } else if (actionType === "native") {
        btn.href = url;
        btn.target = "_self";
    }

    if (buttonColor !== "#000000") {
        btn.style.boxShadow = `4px 4px 0px ${buttonColor}`;
    }
    btn.innerHTML = `<span style="color:${hoverColor}; display:flex; align-items:center;">${iconHtml}</span> ${title}`;
    return btn;
}

const FABManager = {
    state: {
        enabled: true,
        isMenuOpen: false,
        wrapper: null,
        shadow: null,
        container: null,
        fab: null,
        menu: null,
        resizeTimer: null,
        currentBottom: 78,
        listeners: null,
        autoCloseTimer: null
    },

    AUTO_CLOSE_DELAY_MS: 15000,

    clearAutoCloseTimer() {
        if (this.state.autoCloseTimer) {
            clearTimeout(this.state.autoCloseTimer);
            this.state.autoCloseTimer = null;
        }
    },

    startAutoCloseTimer() {
        this.clearAutoCloseTimer();
        this.state.autoCloseTimer = setTimeout(() => {
            this.state.autoCloseTimer = null;
            this.closeMenu();
        }, this.AUTO_CLOSE_DELAY_MS);
    },

    getShadowStyles() {
        return `
            *, *::before, *::after {
                box-sizing: border-box !important;
                margin: 0 !important;
                padding: 0 !important;
            }
            .paperishere-container {
                position: absolute !important;
                bottom: 0 !important;
                left: 0 !important;
                display: flex !important;
                flex-direction: column !important;
                align-items: flex-start !important;
                gap: 12px !important;
                pointer-events: none !important;
                width: max-content !important;
                z-index: 2147483647 !important;
            }
            .paperishere-fab {
                all: unset !important;
                box-sizing: border-box !important;
                width: 52px !important;
                height: 48px !important;
                background-color: #000000 !important;
                color: #ffffff !important;
                border: 2px solid #000000 !important;
                border-left: none !important;
                border-radius: 0 4px 4px 0 !important;
                display: flex !important;
                justify-content: center !important;
                align-items: center !important;
                cursor: pointer !important;
                box-shadow: none !important;
                transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease !important;
                pointer-events: auto !important;
                user-select: none !important;
                outline: none !important;
                opacity: 1 !important;
                visibility: visible !important;
                flex-shrink: 0 !important;
            }
            .paperishere-fab:hover {
                background-color: #7851A9 !important;
                border-color: #7851A9 !important;
                color: #ffffff !important;
                box-shadow: none !important;
            }
            .paperishere-fab.open {
                background-color: #ffffff !important;
                color: #000000 !important;
                border-color: #000000 !important;
                box-shadow: none !important;
                transform: none !important;
            }
            .paperishere-fab svg {
                display: block !important;
                width: 24px !important;
                height: 24px !important;
                stroke: currentColor !important;
                fill: none !important;
                stroke-width: 2.5 !important;
            }
            .paperishere-menu {
                display: flex !important;
                flex-direction: column !important;
                gap: 8px !important;
                opacity: 0 !important;
                visibility: hidden !important;
                pointer-events: none !important;
                transform: translateY(12px) scale(0.96) !important;
                transform-origin: bottom left !important;
                transition: opacity 0.18s cubic-bezier(0.16, 1, 0.3, 1), transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.18s !important;
                align-items: flex-start !important;
                margin-left: 10px !important;
            }
            .paperishere-menu.open {
                opacity: 1 !important;
                visibility: visible !important;
                pointer-events: auto !important;
                transform: translateY(0) scale(1) !important;
            }
            .paperishere-btn {
                display: flex !important;
                align-items: center !important;
                gap: 10px !important;
                background-color: #ffffff !important;
                color: #000000 !important;
                padding: 10px 16px !important;
                border: 2px solid #000000 !important;
                border-radius: 0px !important;
                text-decoration: none !important;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
                font-weight: 800 !important;
                font-size: 13px !important;
                text-transform: uppercase !important;
                letter-spacing: 0.5px !important;
                box-shadow: 4px 4px 0px #000000 !important;
                transition: all 0.15s ease !important;
                pointer-events: auto !important;
                cursor: pointer !important;
                white-space: nowrap !important;
                outline: none !important;
                line-height: 1.2 !important;
                user-select: none !important;
            }
            .paperishere-btn:hover {
                background-color: #000000 !important;
                color: #ffffff !important;
                box-shadow: 4px 4px 0px #7851A9 !important;
            }
            .paperishere-btn svg {
                flex-shrink: 0 !important;
                display: block !important;
            }
            .paperishere-info-badge {
                display: flex !important;
                align-items: center !important;
                gap: 10px !important;
                background-color: #f9f9f9 !important;
                color: #888888 !important;
                padding: 10px 16px !important;
                border: 2px dashed #cccccc !important;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
                font-weight: 800 !important;
                font-size: 11px !important;
                text-transform: uppercase !important;
                pointer-events: auto !important;
                white-space: nowrap !important;
            }
        `;
    },

detectCollisions() {
        if (!document.body) return 78;

        let maxObstructionHeight = 0;
        const candidates = document.querySelectorAll('button, a, div, footer, aside, section, nav');
        const limit = Math.min(candidates.length, 600);

        for (let i = 0; i < limit; i++) {
            const el = candidates[i];
            if (!el || el.id === 'paperishere-ui-wrapper' || (el.closest && el.closest('#paperishere-ui-wrapper'))) continue;

            const style = window.getComputedStyle(el);
            if (style.position !== 'fixed' && style.position !== 'sticky') continue;
            if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) < 0.1) continue;

            const rect = el.getBoundingClientRect();
            if (rect.width < 20 || rect.height < 15 || rect.height > 180) continue;
            if (rect.width > window.innerWidth * 0.8 && rect.height > 100) continue;

            const distanceFromBottom = window.innerHeight - rect.bottom;
            if (distanceFromBottom > 80 || rect.top < window.innerHeight - 250) continue;

            if (rect.left < 80 && rect.right > 0) {
                const heightFromBottom = window.innerHeight - rect.top;
                if (heightFromBottom > maxObstructionHeight && heightFromBottom < 220) {
                    maxObstructionHeight = heightFromBottom;
                }
            }
        }

        if (maxObstructionHeight > 0) {
            return Math.max(78, Math.min(maxObstructionHeight + 10, 220));
        }
        return 78;
    },

    updatePosition() {
        if (!this.state.wrapper) return;

        const targetBottom = this.detectCollisions();

        if (Math.abs(this.state.currentBottom - targetBottom) > 2) {
            this.state.currentBottom = targetBottom;
            this.state.wrapper.style.bottom = `${targetBottom}px`;
        }
    },

    closeMenu() {
        this.clearAutoCloseTimer();
        this.state.isMenuOpen = false;
        if (this.state.menu) {
            this.state.menu.classList.remove('open');
        }
        if (this.state.fab) {
            this.state.fab.classList.remove('open');
            this.state.fab.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
            this.state.fab.setAttribute('aria-expanded', 'false');
        }
    },

    openMenu() {
        this.state.isMenuOpen = true;
        this.state.menu.classList.add('open');
        this.state.fab.classList.add('open');
        this.state.fab.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
        this.state.fab.setAttribute('aria-expanded', 'true');
        this.startAutoCloseTimer();
    },

    toggleMenu() {
        if (this.state.isMenuOpen) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    },

    create() {
        this.destroy();

        const wrapper = document.createElement('div');
        wrapper.id = 'paperishere-ui-wrapper';
        wrapper.style.cssText = 'position:fixed !important; bottom:78px !important; left:0px !important; z-index:2147483647 !important; width:0px !important; height:0px !important; overflow:visible !important; pointer-events:none !important; margin:0 !important; padding:0 !important; border:none !important;';

        const shadow = wrapper.attachShadow({ mode: 'open' });

        const styleEl = document.createElement('style');
        styleEl.textContent = this.getShadowStyles();
        shadow.appendChild(styleEl);

        const container = document.createElement('div');
        container.className = 'paperishere-container';

        const menu = document.createElement('div');
        menu.id = 'paperishere-ui-menu';
        menu.className = 'paperishere-menu';

        const fab = document.createElement('button');
        fab.id = 'paperishere-fab';
        fab.className = 'paperishere-fab';
        fab.setAttribute('aria-label', 'Open PaperIsHere menu');
        fab.setAttribute('aria-expanded', 'false');
        fab.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;

        fab.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleMenu();
        });

        fab.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.state.isMenuOpen) {
                e.preventDefault();
                this.closeMenu();
            }
        });

        const resetInactivity = () => {
            if (this.state.isMenuOpen) this.startAutoCloseTimer();
        };
        menu.addEventListener('mouseenter', resetInactivity);
        menu.addEventListener('click', resetInactivity);
        menu.addEventListener('focusin', resetInactivity);
        fab.addEventListener('mouseenter', resetInactivity);

        container.appendChild(menu);
        container.appendChild(fab);
        shadow.appendChild(container);
        document.body.appendChild(wrapper);

        this.state.wrapper = wrapper;
        this.state.shadow = shadow;
        this.state.container = container;
        this.state.fab = fab;
        this.state.menu = menu;
        this.state.currentBottom = 28;

        this.populateMenu();
        this.updatePosition();
        this.attachEventListeners();
    },

    populateMenu() {
        if (!this.state.menu) return;
        this.state.menu.innerHTML = '';

        const isLibgenDownloadPage = window.location.hostname.includes("libgen") && (window.location.pathname.includes("ads.php") || window.location.pathname.includes("get.php"));

        if (pageInfo.pdfUrl && !pageInfo.viewer) {
            const btn = createDownloadButton("Save PDF (Direct)", pageInfo.pdfUrl, directIcon, "bypass", "#000000", "#10B981");
            btn.style.order = "1";
            this.state.menu.appendChild(btn);
        } else if (pageInfo.pdfUrl && pageInfo.viewer) {
            const infoBtn = document.createElement("div");
            infoBtn.className = "paperishere-info-badge";
            infoBtn.style.order = "1";
            infoBtn.innerHTML = `<span style="color:#888; display:flex; align-items:center;">${directIcon}</span> USE SITE'S NATIVE PDF BUTTON ↗`;
            this.state.menu.appendChild(infoBtn);
        }

        if (pageInfo.doi && !pageInfo.viewer) {
            chrome.runtime.sendMessage({ action: "checkUnpaywall", doi: pageInfo.doi }, (response) => {
                if (response && response.url) {
                    const btn = createDownloadButton("Save PDF (Unpaywall)", response.url, directIcon, "bypass", "#000000", "#10B981");
                    btn.style.order = "2";
                    this.state.menu.appendChild(btn);
                }
            });
        }

        const scholarQuery = pageInfo.doi || pageInfo.isbn || pageInfo.title;
        if (scholarQuery) {
            const btn = createDownloadButton("Search in Scholar", `https://scholar.google.com/scholar?q=${encodeURIComponent(scholarQuery)}`, directIcon, "blank");
            btn.style.order = "3";
            this.state.menu.appendChild(btn);
        }

        chrome.storage.local.get(['sciHubDomain', 'libgenDomain', 'annasDomain', 'nexusBotUsername'], (domains) => {
            if (pageInfo.doi) {
                const btn = pageInfo.sciHub ? createDownloadButton("Save PDF", extractSciHubPdfUrl(), sciHubIcon, "bypass") : createDownloadButton("Get PDF (Sci-Hub)", `${domains.sciHubDomain || "https://sci-hub.st"}/${pageInfo.doi}`, sciHubIcon, "blank");
                btn.style.order = "4";
                this.state.menu.appendChild(btn);
            }

            if (pageInfo.doi || pageInfo.isbn || pageInfo.title) {
                const nexusTarget = pageInfo.doi || pageInfo.isbn || pageInfo.title;
                const btn = createDownloadButton("Search in Nexus (Telegram)", `https://t.me/${domains.nexusBotUsername || "sks7777777nexusbot"}?text=${encodeURIComponent(nexusTarget)}`, nexusIcon, "blank", "#000000", "#24A1DE");
                btn.style.order = "5";
                this.state.menu.appendChild(btn);
            }

            const bookSearchQuery = pageInfo.isbn || pageInfo.doi || pageInfo.title;
            if (bookSearchQuery && !isLibgenDownloadPage) {
                const libgenUrl = domains.libgenDomain || "https://libgen.li";
                const dynamicSearchUrl = buildLibgenSearchUrl(libgenUrl, bookSearchQuery);
                const btn = createDownloadButton("Search Libgen (Books)", dynamicSearchUrl, bookIcon, "blank");
                btn.style.order = "6";
                this.state.menu.appendChild(btn);
            }

            if (bookSearchQuery && !isLibgenDownloadPage) {
                let annasBase = domains.annasDomain || "https://annas-archive.org";
                try { annasBase = new URL(annasBase).origin; } catch(e) {}
                const annasQuery = bookSearchQuery.replace(/^10\.\d+\//, '').replace(/[/.]/g, '');
                const cleanQuery = encodeURIComponent(annasQuery);
                const annasUrl = `${annasBase}/s/${cleanQuery}?`;
                const btn = createDownloadButton("Search Anna's Archive", annasUrl, annasIcon, "blank", "#000000", "#FF6B6B");
                btn.style.order = "7";
                this.state.menu.appendChild(btn);
            }

            if (isLibgenDownloadPage && extractLibgenDownloadUrl()) {
                const btn = createDownloadButton("Save PDF (Libgen)", extractLibgenDownloadUrl(), bookIcon, "native");
                btn.style.order = "8";
                this.state.menu.appendChild(btn);
            }
        });
    },

    attachEventListeners() {
        const outsideClickHandler = (e) => {
            if (!this.state.isMenuOpen) return;
            const path = e.composedPath ? e.composedPath() : [];
            const hitInteractive = path.some(node => node && node.classList &&
                (node.classList.contains('paperishere-fab') ||
                 node.classList.contains('paperishere-btn') ||
                 node.classList.contains('paperishere-info-badge')));
            if (!hitInteractive) this.closeMenu();
        };

        const escapeHandler = (e) => {
            if (e.key === 'Escape' && this.state.isMenuOpen) {
                this.closeMenu();
            }
        };

        const resizeHandler = () => {
            if (this.state.resizeTimer) return;
            this.state.resizeTimer = requestAnimationFrame(() => {
                this.updatePosition();
                this.state.resizeTimer = null;
            });
        };

        const visibilityHandler = () => {
            if (document.hidden) {
                this.closeMenu();
            }
        };

        document.addEventListener('click', outsideClickHandler);
        document.addEventListener('keydown', escapeHandler);
        document.addEventListener('visibilitychange', visibilityHandler);
        window.addEventListener('resize', resizeHandler);
        window.addEventListener('scroll', resizeHandler, { passive: true });

        this.state.listeners = {
            outsideClick: outsideClickHandler,
            escape: escapeHandler,
            resize: resizeHandler,
            visibility: visibilityHandler
        };
    },

    detachEventListeners() {
        if (this.state.listeners) {
            document.removeEventListener('click', this.state.listeners.outsideClick);
            document.removeEventListener('keydown', this.state.listeners.escape);
            document.removeEventListener('visibilitychange', this.state.listeners.visibility);
            window.removeEventListener('resize', this.state.listeners.resize);
            window.removeEventListener('scroll', this.state.listeners.resize);
            this.state.listeners = null;
        }
    },

    update(newSettings) {
        const enabledChanged = newSettings.fabEnabled !== undefined && newSettings.fabEnabled !== this.state.enabled;

        if (newSettings.fabEnabled !== undefined) {
            this.state.enabled = newSettings.fabEnabled;
        }

        if (!this.state.enabled) {
            this.destroy();
            return;
        }

        if (enabledChanged) {
            this.create();
        }
    },

    destroy() {
        this.detachEventListeners();
        this.clearAutoCloseTimer();

        if (this.state.resizeTimer) {
            cancelAnimationFrame(this.state.resizeTimer);
            this.state.resizeTimer = null;
        }

        if (this.state.wrapper && this.state.wrapper.parentNode) {
            this.state.wrapper.remove();
        }

        this.state.wrapper = null;
        this.state.shadow = null;
        this.state.container = null;
        this.state.fab = null;
        this.state.menu = null;
        this.state.isMenuOpen = false;
    }
};

function injectButtons() {
    if (IGNORED_HOSTS.some(h => window.location.hostname.includes(h))) return;

    const isLibgenDownloadPage = window.location.hostname.includes("libgen") && (window.location.pathname.includes("ads.php") || window.location.pathname.includes("get.php"));
    if (!shouldShowFAB() && !isLibgenDownloadPage) return;

    if (FABManager.state.enabled) {
        FABManager.create();
    }
}

let metadataRetryTimer = null;

function initializeExtension() {
    if (IGNORED_HOSTS.some(h => window.location.hostname.includes(h))) return;

    try {
        chrome.storage.local.get(['fabEnabled'], (settings) => {
            const enabled = settings.fabEnabled !== undefined ? settings.fabEnabled : true;
            FABManager.state.enabled = enabled;

            if (!enabled) {
                FABManager.destroy();
                return;
            }

            pageInfo = readPage({ document, location });

            const isLibgenDownloadPage = window.location.hostname.includes("libgen") && (window.location.pathname.includes("ads.php") || window.location.pathname.includes("get.php"));

            const gatingResult = !pageInfo.doi && !pageInfo.isbn && !pageInfo.pdfUrl && !isLibgenDownloadPage && !pageInfo.viewer;

            if (gatingResult) {
                if (!metadataRetryTimer) {
                    metadataRetryTimer = setTimeout(() => {
                        metadataRetryTimer = null;
                        initializeExtension();
                    }, 1000);
                }
                return;
            }

            if (metadataRetryTimer) {
                clearTimeout(metadataRetryTimer);
                metadataRetryTimer = null;
            }

            try {
                chrome.runtime.sendMessage({ action: "storeMetadata", doi: pageInfo.doi, isbn: pageInfo.isbn, text: pageInfo.text, title: pageInfo.title });
            } catch (e) {}

            injectButtons();
        });
    } catch (e) {}
}

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if ('fabEnabled' in changes) {
        FABManager.update({ fabEnabled: changes.fabEnabled.newValue });
    }
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeExtension();
        setupMutationObserver();
    });
} else {
    initializeExtension();
    setupMutationObserver();
}

function setupMutationObserver() {
    if (!document.body) return;
    let lastKnownUrl = location.href;
    new MutationObserver(() => {
        if (location.href !== lastKnownUrl) {
            lastKnownUrl = location.href;
            setTimeout(initializeExtension, 800);
        }
    }).observe(document.body, { childList: true, subtree: true });
}

document.addEventListener('click', function(e) {
    if (e.target.closest && e.target.closest('#paperishere-ui-wrapper')) return;

    const aTag = e.target.closest('a');
    if (!aTag || !aTag.href) return;
    
    if (aTag.dataset && aTag.dataset.paperishereBypass === "true") return;

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
                      
    const hasPdfUrlShape = href.endsWith('.pdf') || href.includes('.pdf?') || href.includes('/doi/pdf/') || href.includes('/doi/epdf/');
    let isSameOriginPdfText = false;
    if (isPdfText) {
        try { isSameOriginPdfText = (window.location.hostname === new URL(aTag.href, window.location.origin).hostname); } catch (e) {}
    }
    const isPdfLink = hasPdfUrlShape || (isPdfText && (hostMatches(window.location.hostname, ACADEMIC_PUBLISHER_DOMAINS) || isSameOriginPdfText));
    
    const isScholarPdf = isScholarSite && 
                         (aTag.querySelector('.gs_ctg2') || aTag.closest('.gs_or_ggsm'));

    if ((isPdfLink || isScholarPdf) && href.startsWith('http')) {
        if (pageInfo.sciHub || isLibgenSite) return;

        e.preventDefault();
        e.stopPropagation();

        directSave({ element: aTag, url: aTag.href, page: pageInfo, labels: LINK_SAVE_LABELS, logType: "INTERCEPTOR_FAIL" });
    }
}, true);
