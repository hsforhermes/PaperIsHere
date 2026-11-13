// page.js — reads one page into one metadata record.
// Loaded before content.js in the same content-script scope.
// Interface: readPage({ document, location }) → { doi, isbn, title, text, pdfUrl, restricted, sciHub, viewer }
// Real page and the hand-built fake in tests/page.test.js are the two adapters. Keep page access in here.

const IGNORED_HOSTS = ['gemini.google.com', 'chatgpt.com', 'chat.openai.com', 'claude.ai', 'perplexity.ai'];

const ACADEMIC_PUBLISHER_DOMAINS = [
    'journals.sagepub.com',
    'sciencedirect.com',
    'link.springer.com',
    'nature.com',
    'onlinelibrary.wiley.com',
    'tandfonline.com',
    'oxfordacademic.com',
    'academic.oup.com',
    'cambridge.org',
    'jstor.org',
    'dl.acm.org',
    'ieeexplore.ieee.org',
    'journals.aps.org',
    'journals.ams.org',
    'annualreviews.org',
    'cell.com',
    'pnas.org',
    'bmj.com',
    'nejm.org',
    'thelancet.com',
    'emerald.com',
    'degruyter.com',
    'frontiersin.org',
    'mdpi.com',
    'plos.org',
    'royalsocietypublishing.org',
    'ebsco.com',
    'proquest.com',
    'arxiv.org',
    'biorxiv.org',
    'medrxiv.org',
    'ssrn.com',
    'researchgate.net',
    'academia.edu',
    'scholar.google.com',
    'pubmed.ncbi.nlm.nih.gov',
    'nih.gov',
    'acs.org',
    'rsc.org',
    'aaas.org',
    'science.org',
    'karger.com',
    'thieme-connect.com'
];

const DOI_PATTERN = /\b(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)\b/i;

const DOI_META_SELECTORS = ['meta[name="citation_doi"]', 'meta[name="prism.doi"]', 'meta[name="dc.identifier"]'];
const ISBN_META_SELECTORS = ['meta[name="citation_isbn"]', 'meta[property="isbn"]', 'meta[name="prism.isbn"]', 'meta[name="dc.identifier"]'];
const TITLE_META_SELECTORS = ['meta[name="citation_title"]', 'meta[name="DC.Title"]', 'meta[name="prism.title"]', 'meta[property="og:title"]'];

const RESTRICTED_SELECTORS = ['.login-options', '.paywall-article', '.access-options', '#paywall-banner', '.article-paywall'];
const RESTRICTED_BADGE_SELECTORS = ['.access-icon.restricted', 'img[alt*="Restricted"]', '[data-access-type="restricted"]', '.icon-lock'];
const OPEN_ACCESS_SELECTORS = [
    '.access-icon.open', '.open-access', 'img[alt*="Open Access"]',
    'img[alt*="Free Access"]', '.doi-access.open', '.oa-open'
];

function hostMatches(hostname, domains) {
    const host = String(hostname || '').toLowerCase();
    return domains.some(d => host === d || host.endsWith('.' + d));
}

function isViewerPath(location) {
    const path = location.pathname || '';
    return path.includes('/doi/epdf/') || path.includes('/doi/epub/');
}

function cleanDoi(raw) {
    return raw.replace(/[.;,]$/, '');
}

function bodyOf(page) {
    return page.document.body || { textContent: '', innerText: '' };
}

function firstMeta(page, selectors) {
    for (const selector of selectors) {
        const el = page.document.querySelector(selector);
        if (el && el.content) return el.content;
    }
    return null;
}

function anySelector(page, selectors) {
    return selectors.some(selector => page.document.querySelector(selector));
}

function isSciHubPage(page) {
    const host = (page.location.hostname || '').toLowerCase();
    if (host.includes('sci-hub') || host.includes('scihub') || host.includes('sci-net')) return true;
    return !!(page.document.querySelector('#menu') && page.document.querySelector('#article'));
}

function extractDoi(page) {
    const { location } = page;
    const meta = firstMeta(page, DOI_META_SELECTORS);
    if (meta) {
        const match = meta.match(DOI_PATTERN);
        if (match) return cleanDoi(match[1]);
    }

    const jstorMatch = location.href.match(/jstor\.org\/stable\/(\d+)/i);
    if (jstorMatch) return `10.2307/${jstorMatch[1]}`;

    const urlMatch = location.href.match(DOI_PATTERN);
    if (urlMatch) {
        const href = location.href.toLowerCase();
        if (href.includes('/doi/') || href.includes('/article/') || href.includes('abs') || isSciHubPage(page)) {
            return cleanDoi(urlMatch[1]);
        }
    }

    if ((location.hostname || '').includes('scholar.google.com')) {
        const q = new URLSearchParams(location.search || '').get('q') || '';
        const qMatch = q.match(DOI_PATTERN);
        if (qMatch) return cleanDoi(qMatch[1]);

        const searchInput = page.document.querySelector('input[name="q"]');
        if (searchInput && searchInput.value) {
            const inputMatch = searchInput.value.match(DOI_PATTERN);
            if (inputMatch) return cleanDoi(inputMatch[1]);
        }
    }

    const textTop = bodyOf(page).textContent.substring(0, 10000);
    const textDoiMatch = textTop.match(/DOI\s*[:\u200B]?\s*\b(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)\b/i) ||
                         textTop.match(/https?:\/\/(?:dx\.)?doi\.org\/(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)\b/i) ||
                         textTop.match(/doi\s*=\s*[{"]?(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)[}"]?/i);
    if (textDoiMatch) return cleanDoi(textDoiMatch[1]);

    return null;
}

function extractIsbn(page) {
    const meta = firstMeta(page, ISBN_META_SELECTORS);
    if (meta) {
        const clean = meta.replace(/[^0-9X]/gi, '');
        if (clean.length === 10 || clean.length === 13) return clean;
    }

    const urlMatch = (page.location.pathname || '').match(/\b(97[89]\d{10})\b/);
    if (urlMatch) return urlMatch[1];

    const textTop = bodyOf(page).textContent.substring(0, 5000);
    const textMatch = textTop.match(/ISBN(?:-1[03])?\s*[:\u200B]?\s*(97[89][- \u2013]?\d{1,5}[- \u2013]?\d{1,7}[- \u2013]?\d{1,6}[- \u2013]?\d|\d{1,5}[- \u2013]?\d{1,7}[- \u2013]?\d{1,6}[- \u2013]?[\dX])/i);
    if (textMatch) {
        const clean = textMatch[1].replace(/[^0-9X]/gi, '');
        if (clean.length === 10 || clean.length === 13) return clean;
    }

    if ((page.location.hostname || '').includes('libgen')) {
        const libgenMatch = bodyOf(page).textContent.match(/\b(97[89][- \u2013]?\d{1,5}[- \u2013]?\d{1,7}[- \u2013]?\d{1,6}[- \u2013]?\d)\b/);
        if (libgenMatch) {
            const clean = libgenMatch[1].replace(/[^0-9X]/gi, '');
            if (clean.length === 10 || clean.length === 13) return clean;
        }
    }

    return null;
}

function extractTitle(page) {
    const meta = firstMeta(page, TITLE_META_SELECTORS);
    if (meta) return meta.trim();

    const h1 = page.document.querySelector('h1');
    if (h1 && h1.innerText && h1.innerText.length > 5) {
        return h1.innerText.trim().replace(/\n+/g, ' ');
    }

    const title = page.document.title;
    return title ? title.split('|')[0].split('-')[0].trim() : null;
}

function extractPageText(page) {
    if ((page.location.hostname || '').includes('scholar.google.com')) {
        const results = page.document.querySelectorAll('.gs_ri');
        if (results.length > 0) {
            return Array.from(results).map(r => r.innerText).join('\n\n').substring(0, 3000);
        }
    }
    return bodyOf(page).innerText.substring(0, 3000);
}

function isRestrictedAccess(page) {
    const textTop = bodyOf(page).innerText.substring(0, 4000);

    if (textTop.includes('Get access to the full version') ||
        textTop.includes('Purchase Instant Access') ||
        textTop.includes('Institutional Login') ||
        textTop.includes('Log in to Wiley Online Library') ||
        anySelector(page, RESTRICTED_SELECTORS)) {
        return true;
    }

    if (textTop.includes('Open access') || textTop.includes('Open Access') || textTop.includes('Free access') ||
        anySelector(page, OPEN_ACCESS_SELECTORS)) {
        return false;
    }

    if (anySelector(page, RESTRICTED_BADGE_SELECTORS)) return true;

    if (textTop.includes('Restricted access') || textTop.includes('Purchase article')) return true;

    return false;
}

function sanitizePublisherUrl(rawUrl, origin) {
    if (!rawUrl) return null;
    let safeUrl = rawUrl;
    if (!safeUrl.startsWith('http')) safeUrl = new URL(safeUrl, origin).href;
    safeUrl = safeUrl.split('?')[0];
    if (safeUrl.includes('/doi/epub/')) safeUrl = safeUrl.replace('/doi/epub/', '/doi/epdf/');
    if (safeUrl.includes('/doi/reader/')) safeUrl = safeUrl.replace('/doi/reader/', '/doi/pdf/');
    return safeUrl;
}

function extractNativePdfUrl(page, doi, restricted) {
    if (restricted) return null;

    const { document: doc, location } = page;

    const meta = firstMeta(page, ['meta[name="citation_pdf_url"]']);
    if (meta) return sanitizePublisherUrl(meta, location.origin);

    const rgBtn = doc.querySelector('a[href*="fulltext"], a[href*="download"][href*="publication"]');
    if ((location.hostname || '').includes('researchgate.net') && rgBtn) return sanitizePublisherUrl(rgBtn.href, location.origin);

    const academiaBtn = doc.querySelector('a.js-swp-download-button, a[href*="/attachments/download/"]');
    if ((location.hostname || '').includes('academia.edu') && academiaBtn) return sanitizePublisherUrl(academiaBtn.href, location.origin);

    const links = Array.from(doc.querySelectorAll('a'));
    for (const a of links) {
        const href = (a.href || '').toLowerCase();
        const text = (a.innerText || a.textContent || '').toLowerCase().trim();

        if (!href || href === location.href.toLowerCase() || href.startsWith('javascript:')) continue;
        if (href.includes('sci-hub') || href.includes('libgen') || href.includes('annas-archive') || href.includes('t.me')) continue;

        if (href.includes('/doi/pdf/') || href.includes('/doi/epdf/') || href.includes('/doi/epub/') || href.includes('/doi/reader/')) return sanitizePublisherUrl(a.href, location.origin);
        if (text === 'download pdf' || text === 'article pdf' || text.includes('pdf/epub')) return sanitizePublisherUrl(a.href, location.origin);
    }

    if (isViewerPath(location) && doi) return sanitizePublisherUrl(`https://journals.sagepub.com/doi/pdf/${doi}`, location.origin);
    return null;
}

function readPage(page) {
    const restricted = isRestrictedAccess(page);
    const doi = extractDoi(page);
    return {
        doi: doi,
        isbn: extractIsbn(page),
        title: extractTitle(page),
        text: extractPageText(page),
        pdfUrl: extractNativePdfUrl(page, doi, restricted),
        restricted: restricted,
        sciHub: isSciHubPage(page),
        viewer: isViewerPath(page.location)
    };
}
