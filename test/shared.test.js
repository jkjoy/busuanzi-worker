import test from 'node:test';
import assert from 'node:assert/strict';
import countHandler from '../edge-functions/api/count.js';
import {
  buildBusuanziScript,
  buildJsonpPayload,
  normalizePage,
  normalizeSite,
  sanitizeCallbackName,
  incrementShardedCounter,
  sumShardedCounter,
  markUniqueVisitor,
  makeSitePvPrefix,
  makePagePvPrefix,
  makeSiteUvKey,
  makeSiteUvSummaryPrefix,
} from '../edge-functions/shared.js';

function createFakeKV() {
  const map = new Map();
  let operations = 0;
  return {
    async get(key) {
      operations += 1;
      return map.has(key) ? map.get(key) : null;
    },
    async put(key, value) {
      operations += 1;
      map.set(key, String(value));
    },
    dump() {
      return map;
    },
    operationCount() {
      return operations;
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
  await incrementShardedCounter(kv, 'site_example_pv', 4, 2);
  await incrementShardedCounter(kv, 'site_example_pv', 4, 2);
  await incrementShardedCounter(kv, 'site_example_pv', 4, 1);
  assert.equal(await sumShardedCounter(kv, 'site_example_pv', 4), 3);
  assert.equal(await kv.get('site_example_pv_2'), '2');
  assert.equal(await kv.get('site_example_pv_1'), '1');
});

test('unique visitor key only counts first visit', async () => {
  const kv = createFakeKV();
  assert.equal(await markUniqueVisitor(kv, makeSiteUvKey('example.com', 'abc')), true);
  assert.equal(await markUniqueVisitor(kv, makeSiteUvKey('example.com', 'abc')), false);
  assert.equal(await markUniqueVisitor(kv, makeSiteUvKey('example.com', 'def')), true);
});

test('summary prefix is namespaced by site', () => {
  assert.equal(makeSiteUvSummaryPrefix('example.com'), 'site_example_com_uv_summary');
});

test('generated KV keys only use EdgeOne KV allowed characters', async () => {
  const site = 'busuanzi.loliko.cn';
  const pageDigest = 'abc123def4567890';
  const visitorId = '35c6de5d7b504c77aea498597175d12b';
  const keys = [
    `${makeSitePvPrefix(site)}_0`,
    `${makePagePvPrefix(site, pageDigest)}_15`,
    makeSiteUvKey(site, visitorId),
    makeSiteUvSummaryPrefix(site),
  ];

  for (const key of keys) {
    assert.match(key, /^[A-Za-z0-9_]+$/);
    assert.ok(Buffer.byteLength(key) <= 512);
  }
});

test('api count increments pv and first visitor uv with safe KV keys', async () => {
  const kv = createFakeKV();
  const request = new Request('https://busuanzi.loliko.cn/api/count?site=busuanzi.loliko.cn&page=https%3A%2F%2Fbusuanzi.loliko.cn%2Fdemo.html&vid=35c6de5d7b504c77aea498597175d12b&callback=__eoBusuanzi_test&script=count.js');
  const response = await countHandler({ request, env: { my_kv: kv } });
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.equal(body, '__eoBusuanzi_test({"site_pv":1,"site_uv":1,"page_pv":1})');
  for (const key of kv.dump().keys()) {
    assert.match(key, /^[A-Za-z0-9_]+$/);
  }
});

test('api count keeps KV operations low for smoother loading', async () => {
  const kv = createFakeKV();
  const request = new Request('https://busuanzi.loliko.cn/api/count?site=busuanzi.loliko.cn&page=/demo.html&vid=smooth-test&callback=cb');
  const response = await countHandler({ request, env: { my_kv: kv } });

  assert.equal(response.status, 200);
  assert.ok(kv.operationCount() <= 10, `expected <= 10 KV operations, got ${kv.operationCount()}`);
});

test('busuanzi script shows cached counts before refreshing', () => {
  const js = buildBusuanziScript({ apiBase: '/api/count', scriptName: 'busuanzi.pure.mini.js' });
  assert.match(js, /eo_busuanzi_cache:/);
  assert.match(js, /readCached/);
  assert.match(js, /writeCached/);
});

test('busuanzi script resolves api against script origin instead of page origin', () => {
  const js = buildBusuanziScript({ apiBase: '/api/count', scriptName: 'busuanzi.pure.mini.js' });
  assert.match(js, /document\.currentScript/);
  assert.match(js, /scriptOrigin/);
  assert.match(js, /new URL\(API_BASE, scriptOrigin\(\)\)/);
});

test('busuanzi script contains expected ids and api path', () => {
  const js = buildBusuanziScript({ apiBase: '/api/count', scriptName: 'busuanzi.pure.mini.js' });
  assert.match(js, /busuanzi_value_site_pv/);
  assert.match(js, /busuanzi_value_page_pv/);
  assert.match(js, /\/api\/count/);
});
