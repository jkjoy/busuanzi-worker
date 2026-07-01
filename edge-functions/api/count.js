import { jsonResponse, notFound, normalizePage, normalizeSite, pageKey, visitorFingerprint, incrementShardedCounter, sumShardedCounter, makeSitePvPrefix, makePagePvPrefix, makeSiteUvKey, makeSiteUvSummaryPrefix, markUniqueVisitor, buildJsonpPayload } from '../shared.js';

const SHARDS = 16;

function isAllowedOrigin(request) {
  const origin = request.headers.get('origin') || '';
  const referer = request.headers.get('referer') || '';
  const source = origin || referer;
  if (!source) return true;
  try {
    const url = new URL(source);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function getScriptName(url) {
  return url.searchParams.get('script') || 'count.js';
}

async function handleCount(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!isAllowedOrigin(request)) {
    return new Response('Forbidden', { status: 403 });
  }

  const site = normalizeSite(url.searchParams.get('site') || url.hostname, url.hostname);
  const page = normalizePage(url.searchParams.get('page') || request.headers.get('referer') || '/', site);
  const callback = url.searchParams.get('callback') || '';
  const visitorId = (url.searchParams.get('vid') || '').trim() || await visitorFingerprint(request, site, page);
  const scriptName = getScriptName(url);
  const pageDigest = await pageKey(page);

  // PV: shard to reduce contention.
  await incrementShardedCounter(env.my_kv, makeSitePvPrefix(site), SHARDS);
  await incrementShardedCounter(env.my_kv, makePagePvPrefix(site, pageDigest), SHARDS);

  // UV: set once per visitor/site.
  await markUniqueVisitor(env.my_kv, makeSiteUvKey(site, visitorId));

  const sitePv = await sumShardedCounter(env.my_kv, makeSitePvPrefix(site), SHARDS);
  const pagePv = await sumShardedCounter(env.my_kv, makePagePvPrefix(site, pageDigest), SHARDS);

  // UV summary: approximate but stable per unique visitor.
  const uvSeen = await markUniqueVisitor(env.my_kv, makeSiteUvKey(site, visitorId));
  if (uvSeen) {
    const currentUv = Number((await env.my_kv.get(makeSiteUvSummaryPrefix(site))) || 0);
    await env.my_kv.put(makeSiteUvSummaryPrefix(site), String(currentUv + 1));
  }
  const siteUv = Number((await env.my_kv.get(makeSiteUvSummaryPrefix(site))) || 0);

  const payload = { site_pv: sitePv, site_uv: siteUv, page_pv: pagePv };
  if (callback) {
    const body = buildJsonpPayload(callback, payload);
    if (!body) return new Response('Bad Request', { status: 400 });
    return new Response(body, {
      status: 200,
      headers: {
        'content-type': 'application/javascript; charset=utf-8',
        'cache-control': 'no-store',
        'access-control-allow-origin': '*',
      },
    });
  }
  return jsonResponse(payload);
}

export default async function onRequest(context) {
  if (context.request.method !== 'GET') {
    return notFound();
  }
  return handleCount(context);
}
