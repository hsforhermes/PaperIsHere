const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Second adapter: a fake element and a fake chrome. setTimeout is captured so the
// 3s restore can be fired on demand instead of waited for.
function loadSave() {
  const sent = [];
  const timers = [];
  const sandbox = {
    chrome: {
      runtime: {
        lastError: null,
        sendMessage: (message, callback) => {
          sent.push(message);
          if (callback) sandbox.chrome.runtime.__reply = callback;
        },
        __reply: null
      }
    },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); }
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'save.js'), 'utf8'), sandbox, { filename: 'save.js' });
  return { directSave: vm.runInContext('directSave', sandbox), sandbox, sent, timers };
}

const labels = { pending: 'PENDING', saved: 'SAVED', failed: 'FAILED' };
const page = { doi: '10.1/x', isbn: '9783161484100', text: 'body', title: 'A paper' };

function fakeElement(html = 'Save PDF') {
  return { innerHTML: html, style: { pointerEvents: 'auto' } };
}

test('one save shows pending, sends the page metadata, shows saved, then restores', () => {
  const { directSave, sandbox, sent, timers } = loadSave();
  const element = fakeElement();

  directSave({ element, url: 'https://publisher.org/doi/pdf/10.1/x', page, labels, logType: 'UI_DOWNLOAD_FAIL' });

  assert.equal(element.innerHTML, 'PENDING');
  assert.equal(element.style.pointerEvents, 'none');
  // Spread into this realm: the object was built inside the vm context.
  assert.deepEqual({ ...sent[0] }, {
    action: 'triggerDirectDownload',
    url: 'https://publisher.org/doi/pdf/10.1/x',
    doi: '10.1/x',
    isbn: '9783161484100',
    text: 'body',
    title: 'A paper'
  });

  sandbox.chrome.runtime.__reply({ success: true, filename: 'x.pdf' });
  assert.equal(element.innerHTML, 'SAVED');
  assert.equal(timers.length, 1);
  assert.equal(timers[0].ms, 3000);

  timers[0].fn();
  assert.equal(element.innerHTML, 'Save PDF');
  assert.equal(element.style.pointerEvents, 'auto');
});

test('a failed download shows the failed label and logs under the caller log type', () => {
  const { directSave, sandbox, sent, timers } = loadSave();
  const element = fakeElement();

  directSave({ element, url: 'https://publisher.org/x.pdf', page, labels, logType: 'INTERCEPTOR_FAIL' });
  sandbox.chrome.runtime.__reply({ success: false, error: 'HTTP 403' });

  assert.equal(element.innerHTML, 'FAILED');
  assert.equal(sent[1].action, 'logError');
  assert.equal(sent[1].type, 'INTERCEPTOR_FAIL');
  assert.equal(sent[1].details.url, 'https://publisher.org/x.pdf');
  assert.equal(sent[1].details.error, 'HTTP 403');

  timers[0].fn();
  assert.equal(element.innerHTML, 'Save PDF');
});

test('a runtime error with no response is a failure, not a hang', () => {
  const { directSave, sandbox, sent, timers } = loadSave();
  const element = fakeElement();

  directSave({ element, url: 'https://publisher.org/x.pdf', page, labels, logType: 'UI_DOWNLOAD_FAIL' });
  sandbox.chrome.runtime.lastError = { message: 'Receiving end does not exist' };
  sandbox.chrome.runtime.__reply(undefined);

  assert.equal(element.innerHTML, 'FAILED');
  assert.equal(sent[1].type, 'UI_DOWNLOAD_FAIL');
  timers[0].fn();
});

test('the labels come from the caller, so both entry points share one contract', () => {
  const { directSave, sandbox } = loadSave();
  const fab = fakeElement();
  const link = fakeElement('<a>PDF</a>');
  const otherLabels = { pending: 'LINK PENDING', saved: 'LINK SAVED', failed: 'LINK FAILED' };

  directSave({ element: fab, url: 'https://a.org/1.pdf', page, labels, logType: 'UI_DOWNLOAD_FAIL' });
  directSave({ element: link, url: 'https://a.org/2.pdf', page, labels: otherLabels, logType: 'INTERCEPTOR_FAIL' });

  assert.equal(fab.innerHTML, 'PENDING');
  assert.equal(link.innerHTML, 'LINK PENDING');

  sandbox.chrome.runtime.__reply({ success: true });
  assert.equal(link.innerHTML, 'LINK SAVED');
  assert.equal(fab.innerHTML, 'PENDING');
});
