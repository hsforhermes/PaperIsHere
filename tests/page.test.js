const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sandbox = { URL, URLSearchParams };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'page.js'), 'utf8'), sandbox, { filename: 'page.js' });
const readPage = vm.runInContext('readPage', sandbox);

// Second adapter: a hand-built page. Selector strings are the document's own API, so
// the fake answers them from a map instead of parsing HTML.
function fakePage({ href = 'https://example.org/', hostname, pathname, search, nodes = {}, lists = {}, links = [], text = '', innerText, title = '' } = {}) {
    const url = new URL(href);
    return {
        location: {
            href,
            hostname: hostname || url.hostname,
            pathname: pathname !== undefined ? pathname : url.pathname,
            search: search !== undefined ? search : url.search,
            origin: url.origin
        },
        document: {
            title,
            body: { textContent: text, innerText: innerText !== undefined ? innerText : text },
            querySelector: (selector) => nodes[selector] || null,
            querySelectorAll: (selector) => lists[selector] || []
        }
    };
}

test('one read returns doi, isbn, title, text and pdf url together', () => {
    const record = readPage(fakePage({
        href: 'https://onlinelibrary.wiley.com/doi/10.1111/j.1467-8551.2015.01234.x',
        text: 'body text',
        nodes: {
            'meta[name="citation_doi"]': { content: '10.1111/ABC.123;' },
            'meta[name="citation_isbn"]': { content: '978-3-16-148410-0' },
            'meta[name="citation_title"]': { content: 'Social context ownership' },
            'meta[name="citation_pdf_url"]': { content: 'https://onlinelibrary.wiley.com/doi/pdf/10.1111/ABC.123?download=true' }
        }
    }));

    assert.equal(record.doi, '10.1111/ABC.123');
    assert.equal(record.isbn, '9783161484100');
    assert.equal(record.title, 'Social context ownership');
    assert.equal(record.text, 'body text');
    assert.equal(record.pdfUrl, 'https://onlinelibrary.wiley.com/doi/pdf/10.1111/ABC.123');
    assert.equal(record.restricted, false);
    assert.equal(record.viewer, false);
    assert.equal(record.sciHub, false);
});

test('a doi in the url only counts inside an academic path', () => {
    assert.equal(readPage(fakePage({ href: 'https://example.org/blog/10.1234/abc.def' })).doi, null);
    assert.equal(readPage(fakePage({ href: 'https://example.org/doi/10.1234/abc.def' })).doi, '10.1234/abc.def');
    assert.equal(readPage(fakePage({ href: 'https://www.jstor.org/stable/1234567' })).doi, '10.2307/1234567');
});

test('scholar search query supplies the doi', () => {
    const record = readPage(fakePage({ href: 'https://scholar.google.com/scholar?q=10.1000%2Fxyz.42' }));
    assert.equal(record.doi, '10.1000/xyz.42');
});

test('Restricted Access suppresses the pdf url, an open-access badge reopens it', () => {
    const closed = readPage(fakePage({
        href: 'https://onlinelibrary.wiley.com/doi/10.1111/j.1467-8551.2015.01234.x',
        text: 'Get access to the full version',
        nodes: {
            'meta[name="citation_pdf_url"]': { content: 'https://onlinelibrary.wiley.com/doi/pdf/10.1111/x' }
        }
    }));
    assert.equal(closed.restricted, true);
    assert.equal(closed.pdfUrl, null);

    // A page carrying both a lock badge and an open-access badge counts as open.
    const opened = readPage(fakePage({
        href: 'https://onlinelibrary.wiley.com/doi/10.1111/j.1467-8551.2015.01234.x',
        nodes: {
            'meta[name="citation_pdf_url"]': { content: 'https://onlinelibrary.wiley.com/doi/pdf/10.1111/x' },
            '.icon-lock': {},
            '.open-access': {}
        }
    }));
    assert.equal(opened.restricted, false);
    assert.equal(opened.pdfUrl, 'https://onlinelibrary.wiley.com/doi/pdf/10.1111/x');
});

test('viewer pages synthesize the publisher pdf url and report the flag', () => {
    const record = readPage(fakePage({ href: 'https://journals.sagepub.com/doi/epdf/10.1177/0001' }));
    assert.equal(record.doi, '10.1177/0001');
    assert.equal(record.viewer, true);
    assert.equal(record.pdfUrl, 'https://journals.sagepub.com/doi/pdf/10.1177/0001');
});

test('epub publisher links normalize to epdf', () => {
    const record = readPage(fakePage({
        text: 'x',
        nodes: { 'meta[name="citation_pdf_url"]': { content: 'https://journals.sagepub.com/doi/epub/10.1177/0002' } }
    }));
    assert.equal(record.pdfUrl, 'https://journals.sagepub.com/doi/epdf/10.1177/0002');
});

test('title falls back to the h1, then to the document title', () => {
    assert.equal(readPage(fakePage({ nodes: { h1: { innerText: 'A sufficiently long heading' } } })).title, 'A sufficiently long heading');
    assert.equal(readPage(fakePage({ title: 'Journal of Things | Publisher' })).title, 'Journal of Things');
});

test('sci-hub is a field of the record', () => {
    assert.equal(readPage(fakePage({ href: 'https://sci-hub.st/10.1234/abc' })).sciHub, true);
    assert.equal(readPage(fakePage({ nodes: { '#menu': {}, '#article': {} } })).sciHub, true);
});

test('scholar result pages feed the text record from the result snippets', () => {
    const record = readPage(fakePage({
        href: 'https://scholar.google.com/scholar?q=test',
        lists: { '.gs_ri': [{ innerText: 'first result' }, { innerText: 'second result' }] },
        text: 'whole page text'
    }));
    assert.equal(record.text, 'first result\n\nsecond result');
});
