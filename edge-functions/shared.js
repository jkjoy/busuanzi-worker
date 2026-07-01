const DEFAULT_SHARDS = 16;
const VISITOR_ID_LENGTH = 20;

export function normalizeSite(input, fallback = '') {
  const raw = String(input || '').trim();
  if (!raw) {
    return String(fallback || '').trim().toLowerCase();
  }

  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
    return url.hostname.toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

export function normalizePage(input, site = '') {
  const raw = String(input || '').trim();
  if (!raw) {
    return '/';
  }

  try {
    const url = new URL(raw.includes('://') ? raw : `https://${site || 'example.com'}${raw.startsWith('/') ? raw : `/${raw}`}`);
    url.hash = '';
    // Keep query string so pages with meaningful query params remain distinct.
    const path = url.pathname || '/';
    const normalizedPath = path === '/' ? '/' : path.replace(/\/+/g, '/').replace(/\/$/, '');
    return `${normalizedPath}${url.search}` || '/';
  } catch {
    return raw.split('#', 1)[0] || '/';
  }
}

export function sanitizeCallbackName(name) {
  const value = String(name || '').trim();
  if (!value) return '';
  const ok = /^[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*$/.test(value);
  return ok ? value : '';
}

export function buildJsonpPayload(callback, data) {
  const safe = sanitizeCallbackName(callback);
  if (!safe) return '';
  return `${safe}(${JSON.stringify(data)})`;
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function pageKey(page) {
  return (await sha256Hex(String(page))).slice(0, 16);
}

export async function visitorFingerprint(request, site, page) {
  const forwardedFor = request.headers.get('x-forwarded-for') || '';
  const ip = forwardedFor.split(',')[0].trim() || request.headers.get('cf-connecting-ip') || '';
  const ua = request.headers.get('user-agent') || '';
  const lang = request.headers.get('accept-language') || '';
  const seed = [site, page, ip, ua, lang].join('|');
  const hex = await sha256Hex(seed);
  return hex.slice(0, VISITOR_ID_LENGTH);
}

export function safeKvPart(value) {
  const raw = String(value || '').toLowerCase();
  const safe = raw.replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  return safe || 'default';
}

export function makeSitePvPrefix(site) {
  return `site_${safeKvPart(site)}_pv`;
}

export function makePagePvPrefix(site, key) {
  return `page_${safeKvPart(site)}_${safeKvPart(key)}_pv`;
}

export function makeSiteUvKey(site, visitorId) {
  return `site_${safeKvPart(site)}_uv_${safeKvPart(visitorId)}`;
}

export function makeSiteUvSummaryPrefix(site) {
  return `site_${safeKvPart(site)}_uv_summary`;
}

export function makeSitePvTotalKey(site) {
  return `site_${safeKvPart(site)}_pv_total`;
}

export function makePagePvTotalKey(site, key) {
  return `page_${safeKvPart(site)}_${safeKvPart(key)}_pv_total`;
}

export async function incrementCounter(kv, key) {
  const current = Number((await kv.get(key)) || 0);
  const next = current + 1;
  await kv.put(key, String(next));
  return next;
}

export async function getCounter(kv, key) {
  return Number((await kv.get(key)) || 0);
}

export async function incrementShardedCounter(kv, prefix, shards = DEFAULT_SHARDS, shardIndex = null) {
  const shard = shardIndex === null ? Math.floor(Math.random() * shards) : shardIndex % shards;
  const key = `${prefix}_${shard}`;
  const current = Number((await kv.get(key)) || 0);
  const next = current + 1;
  await kv.put(key, String(next));
  return next;
}

export async function sumShardedCounter(kv, prefix, shards = DEFAULT_SHARDS) {
  const values = await Promise.all(
    Array.from({ length: shards }, async (_, i) => Number((await kv.get(`${prefix}_${i}`)) || 0))
  );
  return values.reduce((a, b) => a + b, 0);
}

export async function markUniqueVisitor(kv, key) {
  const existing = await kv.get(key);
  if (existing !== null && existing !== undefined) {
    return false;
  }
  await kv.put(key, String(Date.now()));
  return true;
}

export function busuanziIds() {
  return {
    sitePv: ['busuanzi_value_site_pv', 'eo_count_site_pv'],
    siteUv: ['busuanzi_value_site_uv', 'eo_count_site_uv'],
    pagePv: ['busuanzi_value_page_pv', 'eo_count_page_pv'],
    sitePvContainer: ['busuanzi_container_site_pv', 'eo_count_site_pv_container'],
    siteUvContainer: ['busuanzi_container_site_uv', 'eo_count_site_uv_container'],
    pagePvContainer: ['busuanzi_container_page_pv', 'eo_count_page_pv_container'],
  };
}

export function buildBusuanziScript({ apiBase = '/api/count', scriptName = 'busuanzi.pure.mini.js' } = {}) {
  return `!function(){
  var API_BASE = ${JSON.stringify(apiBase)};
  var SCRIPT_NAME = ${JSON.stringify(scriptName)};
  var IDS = ${JSON.stringify(busuanziIds())};
  function qs(selector){ return document.querySelector(selector); }
  function allByIds(ids){ return ids.map(function(id){ return document.getElementById(id); }).filter(Boolean); }
  function show(id){ allByIds(id).forEach(function(el){ el.style.display = ''; }); }
  function setValue(ids, value){ allByIds(ids).forEach(function(el){ el.textContent = String(value); show(ids); }); }
  function pageUrl(){ return location.href.split('#')[0]; }
  function host(){ return location.hostname.toLowerCase(); }
  function storageKey(){ return 'eo_busuanzi_vid:' + host(); }
  function cacheKey(){ return 'eo_busuanzi_cache:' + host() + ':' + pageUrl(); }
  function readCached(){
    try {
      var cached = localStorage.getItem(cacheKey());
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      return null;
    }
  }
  function writeCached(data){
    try {
      if (data) localStorage.setItem(cacheKey(), JSON.stringify(data));
    } catch (e) {}
  }
  function getVisitorId(){
    try {
      var existing = localStorage.getItem(storageKey());
      if (existing) return existing;
      var created = (crypto && crypto.randomUUID ? crypto.randomUUID() : (Math.random().toString(36).slice(2) + Date.now().toString(36))).replace(/-/g, '');
      localStorage.setItem(storageKey(), created);
      return created;
    } catch (e) {
      return (Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/-/g, '');
    }
  }
  function scriptOrigin(){
    try {
      var current = document.currentScript;
      if (current && current.src) return new URL(current.src, location.href).origin;
      var scripts = document.getElementsByTagName('script');
      for (var i = scripts.length - 1; i >= 0; i--) {
        var src = scripts[i].src || '';
        if (src.indexOf(SCRIPT_NAME) !== -1) return new URL(src, location.href).origin;
      }
    } catch (e) {}
    return location.origin;
  }
  function jsonp(callbackName, params){
    var s = document.createElement('script');
    var url = new URL(API_BASE, scriptOrigin());
    Object.keys(params).forEach(function(k){ url.searchParams.set(k, params[k]); });
    url.searchParams.set('callback', callbackName);
    s.src = url.toString();
    s.async = true;
    s.referrerPolicy = 'no-referrer-when-downgrade';
    document.head.appendChild(s);
  }
  function update(data){
    if (!data) return;
    setValue(IDS.sitePv, data.site_pv || 0);
    setValue(IDS.siteUv, data.site_uv || 0);
    setValue(IDS.pagePv, data.page_pv || 0);
    writeCached(data);
  }
  var cached = readCached();
  if (cached) update(cached);
  var cb = '__eoBusuanzi_' + Math.random().toString(36).slice(2);
  window[cb] = function(payload){
    try { update(payload); } finally {
      try { delete window[cb]; } catch(e) { window[cb] = undefined; }
    }
  };
  jsonp(cb, { site: host(), page: pageUrl(), vid: getVisitorId(), script: SCRIPT_NAME });
}();`;
}

export function jsonResponse(data, headers = {}) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      ...headers,
    },
  });
}

export function scriptResponse(js, headers = {}) {
  return new Response(js, {
    status: 200,
    headers: {
      'content-type': 'application/javascript; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      ...headers,
    },
  });
}

export function htmlResponse(html, headers = {}) {
  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  });
}

export function notFound() {
  return new Response('Not Found', { status: 404 });
}
