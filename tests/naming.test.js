const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadBackground({ fetchImpl, sessionSeed = {}, localSeed = {} } = {}) {
  const sessionStore = { ...sessionSeed };
  const localStore = { ...localSeed };
  const listeners = { message: null, filename: null };
  let lastFetchRequest = null;

  const storageArea = (store) => ({
    get: (keys, cb) => {
      const out = {};
      for (const k of [].concat(keys)) out[k] = store[k];
      if (typeof cb === 'function') { setTimeout(() => cb(out), 0); return; }
      return Promise.resolve(out);
    },
    set: (obj, cb) => {
      Object.assign(store, obj);
      if (typeof cb === 'function') { setTimeout(() => cb(), 0); return; }
      return Promise.resolve();
    },
    remove: (keys, cb) => {
      for (const k of [].concat(keys)) delete store[k];
      if (typeof cb === 'function') { setTimeout(() => cb(), 0); return; }
      return Promise.resolve();
    }
  });

  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    URL,
    AbortController,
    fetch: async (url, opts) => {
      lastFetchRequest = { url, opts };
      if (fetchImpl) return fetchImpl(url, opts);
      throw new Error('fetch not stubbed: ' + url);
    },
    chrome: {
      storage: {
        local: storageArea(localStore),
        session: storageArea(sessionStore),
        onChanged: { addListener: () => {} }
      },
      runtime: {
        lastError: null,
        onInstalled: { addListener: () => {} },
        onMessage: { addListener: (fn) => { listeners.message = fn; } }
      },
      downloads: {
        onDeterminingFilename: { addListener: (fn) => { listeners.filename = fn; } },
        download: () => {},
        cancel: () => {}
      },
      tabs: { query: (q, cb) => cb([]) }
    }
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const src = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');
  vm.runInContext(src, sandbox, { filename: 'background.js' });
  const run = (expr) => vm.runInContext(expr, sandbox);
  const api = {
    run,
    listeners,
    stores: { sessionStore, localStore },
    lastFetchRequest: () => lastFetchRequest
  };
  return api;
}

const BERLIN_DATA = {
  year: '2015',
  full_date: '20150921',
  last_name: 'Belenzon',
  other_names: 'Sharon',
  title: 'Social context ownership and family firms investigation'
};

test('fallback names cover all six styles without invented suffixes', () => {
  const bg = loadBackground();
  const names = bg.run(`({
    kebab: generateFallbackName(${JSON.stringify(BERLIN_DATA)}, 'kebab', 'pdf'),
    pascal: generateFallbackName(${JSON.stringify(BERLIN_DATA)}, 'pascal', 'pdf'),
    dateKebab: generateFallbackName(${JSON.stringify(BERLIN_DATA)}, 'date-kebab', 'pdf'),
    model1: generateFallbackName(${JSON.stringify(BERLIN_DATA)}, 'model1', 'pdf'),
    model2: generateFallbackName(${JSON.stringify(BERLIN_DATA)}, 'model2', 'pdf'),
    model3: generateFallbackName(${JSON.stringify(BERLIN_DATA)}, 'model3', 'pdf')
  })`);
  assert.match(names.kebab, /^2015-BelenzonS-[a-z_]+\.pdf$/);
  assert.match(names.pascal, /^2015-BelenzonS-[A-Za-z]+\.pdf$/);
  assert.ok(!/\.[a-z_]+\.pdf$/.test(names.pascal.replace(/^\d+-BelenzonS-/, 'X-')), 'pascal keywords must be fused, got: ' + names.pascal);
  assert.match(names.dateKebab, /^20150921-BelenzonS-[a-z_]+\.pdf$/);
  assert.match(names.model1, /^2015_BelenzonS_[a-z-]+\.pdf$/);
  assert.match(names.model2, /^20150921_[a-z-]+\.pdf$/);
  assert.match(names.model3, /^20150921_[a-z-]+\.pdf$/);
  assert.ok(!names.model2.endsWith('_document.pdf'), 'model2 must not invent _document');
  assert.ok(!names.model3.endsWith('_report.pdf'), 'model3 must not invent _report');
});

test('callGemini sanitizer preserves Json words and null-words, converts bare null', async () => {
  const canned = (text) => ({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] })
  });
  const bg = loadBackground({
    sessionSeed: { geminiApiKey: 'test-key-123' },
    fetchImpl: async () => canned('```json\n2024-SmithJ-JsonAdapterStudy_nullcline.pdf\n```')
  });
  const out = await bg.run(`callGemini('Title: JsonAdapter study of nullcline methods', 'kebab')`);
  assert.ok(out.includes('JsonAdapter'), 'must not strip Json substring, got: ' + out);
  assert.ok(out.includes('nullcline'), 'must not rewrite null inside words, got: ' + out);

  const bg2 = loadBackground({
    sessionSeed: { geminiApiKey: 'test-key-123' },
    fetchImpl: async (url, opts) => {
      assert.ok(!String(url).includes('test-key-123'), 'key must not travel in URL');
      assert.equal(opts.headers['x-goog-api-key'], 'test-key-123');
      return canned('2024-SmithJ-study_null.pdf');
    }
  });
  const out2 = await bg2.run(`callGemini('Title: something', 'kebab')`);
  assert.ok(out2.includes('0000'), 'bare null token must become 0000, got: ' + out2);
});

test('callGemini respects opt-out without calling fetch', async () => {
  let fetched = false;
  const bg = loadBackground({
    localSeed: { geminiOptIn: false },
    sessionSeed: { geminiApiKey: 'test-key-123' },
    fetchImpl: async () => { fetched = true; throw new Error('should not fetch'); }
  });
  const out = await bg.run(`callGemini('Title: x', 'kebab')`);
  assert.equal(out, null);
  assert.equal(fetched, false);
});

test('mirror scraper dedupes and ignores struck-through entries', async () => {
  const html = `<html><body>
    <del><a href="https://sci-hub.dead/">dead</a></del>
    <a href="https://sci-hub.st/">a</a>
    <a href="https://sci-hub.st/">dup</a>
    <a href="https://sci-hub.ru/">b</a>
  </body></html>`;
  const bg = loadBackground({ fetchImpl: async () => ({ text: async () => html }) });
  const out = await bg.run(`fetchDynamicMirrors('https://sci-hub.pub/', 'sci-hub', ["https://sci-hub.st"])`);
  assert.deepEqual(JSON.parse(JSON.stringify(out)), ['https://sci-hub.st', 'https://sci-hub.ru']);
});

test('memory shield keeps rich text against poor same-paper updates, including null ids', async () => {
  const bg = loadBackground();
  const rich = 'x'.repeat(500);
  bg.listeners.message(
    { action: 'storeMetadata', doi: null, isbn: null, text: rich, title: 'Some Paper' },
    { tab: { id: 1 } }, () => {}
  );
  await new Promise((r) => setTimeout(r, 50));
  bg.listeners.message(
    { action: 'storeMetadata', doi: null, isbn: null, text: 'short', title: 'Some Paper' },
    { tab: { id: 1 } }, () => {}
  );
  await new Promise((r) => setTimeout(r, 50));
  const textLen = bg.run(`(globalLastKnownMetadata.text || '').length`);
  assert.ok(textLen >= 500, 'rich global text must survive null-id poor updates, len=' + textLen);
});

test('memory shield allows overwrite when null-id titles differ', async () => {
  const bg = loadBackground();
  bg.listeners.message(
    { action: 'storeMetadata', doi: null, isbn: null, text: 'y'.repeat(500), title: 'Paper A' },
    { tab: { id: 1 } }, () => {}
  );
  await new Promise((r) => setTimeout(r, 50));
  bg.listeners.message(
    { action: 'storeMetadata', doi: null, isbn: null, text: 'other paper with rich text ' + 'z'.repeat(500), title: 'Paper B' },
    { tab: { id: 2 } }, () => {}
  );
  await new Promise((r) => setTimeout(r, 50));
  const title = bg.run(`globalLastKnownMetadata.title`);
  assert.equal(title, 'Paper B');
});
