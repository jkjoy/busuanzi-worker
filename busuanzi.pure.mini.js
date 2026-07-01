!function(){
  var API_BASE = "/api/count";
  var SCRIPT_NAME = "busuanzi.pure.mini.js";
  var IDS = {"sitePv":["busuanzi_value_site_pv","eo_count_site_pv"],"siteUv":["busuanzi_value_site_uv","eo_count_site_uv"],"pagePv":["busuanzi_value_page_pv","eo_count_page_pv"],"sitePvContainer":["busuanzi_container_site_pv","eo_count_site_pv_container"],"siteUvContainer":["busuanzi_container_site_uv","eo_count_site_uv_container"],"pagePvContainer":["busuanzi_container_page_pv","eo_count_page_pv_container"]};
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
  function jsonp(callbackName, params){
    var s = document.createElement('script');
    var url = new URL(API_BASE, location.href);
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
}();
