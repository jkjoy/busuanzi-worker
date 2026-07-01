!function(){
  var API_BASE='/api/count';
  var SCRIPT_NAME='busuanzi.pure.mini.js';
  var IDS={sitePv:['busuanzi_value_site_pv','eo_count_site_pv'],siteUv:['busuanzi_value_site_uv','eo_count_site_uv'],pagePv:['busuanzi_value_page_pv','eo_count_page_pv'],sitePvContainer:['busuanzi_container_site_pv','eo_count_site_pv_container'],siteUvContainer:['busuanzi_container_site_uv','eo_count_site_uv_container'],pagePvContainer:['busuanzi_container_page_pv','eo_count_page_pv_container']};
  function byIds(ids){return ids.map(function(id){return document.getElementById(id)}).filter(Boolean)}
  function set(ids,value){byIds(ids).forEach(function(el){el.textContent=String(value);el.style.display=''})}
  function host(){return location.hostname.toLowerCase()}
  function page(){return location.href.split('#')[0]}
  function storageKey(){return 'eo_busuanzi_vid:' + host()}
  function getVisitorId(){
    try { var existing=localStorage.getItem(storageKey()); if(existing) return existing; var created=(crypto&&crypto.randomUUID?crypto.randomUUID():(Math.random().toString(36).slice(2)+Date.now().toString(36))).replace(/-/g,''); localStorage.setItem(storageKey(), created); return created; }
    catch(e){ return (Math.random().toString(36).slice(2)+Date.now().toString(36)).replace(/-/g,''); }
  }
  function load(){
    var cb='__eoBusuanzi_' + Math.random().toString(36).slice(2);
    window[cb]=function(data){ try { if(data){ set(IDS.sitePv, data.site_pv||0); set(IDS.siteUv, data.site_uv||0); set(IDS.pagePv, data.page_pv||0); } } finally { try { delete window[cb]; } catch(e) { window[cb]=undefined; } } };
    var url=new URL(API_BASE, location.href);
    url.searchParams.set('site', host());
    url.searchParams.set('page', page());
    url.searchParams.set('vid', getVisitorId());
    url.searchParams.set('callback', cb);
    url.searchParams.set('script', SCRIPT_NAME);
    var s=document.createElement('script');
    s.src=url.toString();
    s.async=true;
    s.referrerPolicy='no-referrer-when-downgrade';
    document.head.appendChild(s);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load); else load();
}();
