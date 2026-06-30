import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBusuanziScript,
  buildJsonpPayload,
  normalizePage,
  normalizeSite,
  sanitizeCallbackName,
  incrementShardedCounter,
  sumShardedCounter,
  markUniqueVisitor,
  makeSiteUvKey,
  makeSiteUvSummaryPrefix,
} from '../edge-functions/shared.js';

function createFakeKV() {
  const map = new Map();
  return {
    async get(key) {
      return map.has(key) ? map.get(key) : null;
    },
    async put(key, value) {
      map.set(key, String(value));
    },
    dump() {
      return map;
    },
  };
}

test('normalizeSite extracts hostname from URL and plain host', () => {
  assert.equal(normalizeSite('https://www.Example.com/post/1'), 'www.example.com');
  assert.equal(normalizeSite('example.com'), 'example.com');
  assert.equal(normalizeSite('', 'fallback.example'), 'fallback.example');
});

test('normalizePage strips hash but keeps path and query', () => {
  assert.equal(
    normalizePage('https://example.com/post/1?utm_source=x#section', 'example.com'),
    '/post/1?utm_source=x'
  );
});

test('sanitizeCallbackName accepts dotted identifiers and rejects injection', () => {
  assert.equal(sanitizeCallbackName('cb'), 'cb');
  assert.equal(sanitizeCallbackName('window.cb_1'), 'window.cb_1');
  assert.equal(sanitizeCallbackName('alert(1)'), '');
  assert.equal(sanitizeCallbackName('x;fetch(1)'), '');
});

test('jsonp payload wraps JSON safely', () => {
  const payload = buildJsonpPayload('cb', { ok: true });
  assert.match(payload, /^cb\(/);
  assert.match(payload, /"ok":true/);
});

test('sharded counter increments and sums deterministically when shard fixed', async () => {
  const kv = createFakeKV();
  await incrementShardedCounter(kv, 'site:example:pv', 4, 2);
  await incrementShardedCounter(kv, 'site:example:pv', 4, 2);
  await incrementShardedCounter(kv, 'site:example:pv', 4, 1);
  assert.equal(await sumShardedCounter(kv, 'site:example:pv', 4), 3);
  assert.equal(await kv.get('site:example:pv:2'), '2');
  assert.equal(await kv.get('site:example:pv:1'), '1');
});

test('unique visitor key only counts first visit', async () => {
  const kv = createFakeKV();
  assert.equal(await markUniqueVisitor(kv, makeSiteUvKey('example.com', 'abc')), true);
  assert.equal(await markUniqueVisitor(kv, makeSiteUvKey('example.com', 'abc')), false);
  assert.equal(await markUniqueVisitor(kv, makeSiteUvKey('example.com', 'def')), true);
});

test('summary prefix is namespaced by site', () => {
  assert.equal(makeSiteUvSummaryPrefix('example.com'), 'site:example.com:uv:summary');
});

test('busuanzi script contains expected ids and api path', () => {
  const js = buildBusuanziScript({ apiBase: '/api/count', scriptName: 'busuanzi.pure.mini.js' });
  assert.match(js, /busuanzi_value_site_pv/);
  assert.match(js, /busuanzi_value_page_pv/);
  assert.match(js, /\/api\/count/);
});
