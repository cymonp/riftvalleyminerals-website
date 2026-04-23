/**
 * Rift Valley Minerals — Visitor Log Worker
 * ------------------------------------------------------------
 * Cloudflare Worker that captures one row per unique visitor IP
 * and stores it in a KV namespace. Runs on Cloudflare's free plan
 * (100,000 requests/day, 1 GB KV storage).
 *
 * Routes:
 *   POST /log    — record a visit (called automatically by script.js)
 *   GET  /list   — return all unique-visitor rows (called by visitors.html)
 *   GET  /stats  — short summary (totals + country breakdown)
 *   GET  /clear  — WIPE all rows (requires ?key=<ADMIN_KEY> secret)
 *
 * IP privacy:
 *   - The raw IP is SHA-256 hashed before being used as the storage key
 *   - Only a truncated IP prefix is ever returned (e.g. "41.220.24.*")
 *   - Real IP is never stored or exposed — GDPR-friendly
 *
 * Setup: see api/README.md
 * ------------------------------------------------------------ */

const MAX_ROWS_LIST  = 1000;      // hard cap for /list response size
const SESSION_WINDOW = 30 * 60;   // seconds; gap > this => new session

export default {
  async fetch(request, env) {
    const url  = new URL(request.url);
    const path = url.pathname.replace(/\/+$/,'') || '/';
    const CORS = {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age':       '86400',
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    try {
      if (path === '/log'   && request.method === 'POST') return await logVisit(request, env, CORS);
      if (path === '/list'  && request.method === 'GET')  return await listVisitors(env, CORS);
      if (path === '/stats' && request.method === 'GET')  return await stats(env, CORS);
      if (path === '/clear' && request.method === 'GET')  return await clearAll(url, env, CORS);
      if (path === '/')                                    return json({
        service: 'rvm-visitor-log',
        endpoints: ['/log (POST)', '/list (GET)', '/stats (GET)', '/clear?key=ADMIN_KEY'],
      }, CORS);
      return json({ error: 'not_found' }, CORS, 404);
    } catch (err) {
      return json({ error: 'server_error', message: err.message }, CORS, 500);
    }
  }
};

/* ---------- POST /log ---------- */
async function logVisit(request, env, CORS) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const body = await request.json().catch(() => ({}));

  // Skip visitors-dashboard self-hits — defence in depth
  const page = (body.page || '').toLowerCase();
  if (page.includes('visitors.html') || page === '/visitors') {
    return json({ ok: true, skipped: 'dashboard-self-hit' }, CORS);
  }

  // Skip bots / crawlers (simple UA heuristic)
  const ua = (body.ua || request.headers.get('User-Agent') || '').toLowerCase();
  if (/bot|crawler|spider|bingpreview|facebookexternalhit|slurp|ahrefs|semrush/i.test(ua)) {
    return json({ ok: true, skipped: 'bot' }, CORS);
  }

  const cf  = request.cf || {};
  const now = new Date().toISOString();
  const key = 'v:' + await sha256(ip + '|' + (env.SALT || 'rvm-default-salt'));

  const existing = await env.VISITORS.get(key, { type: 'json' });

  let row;
  if (existing) {
    const gap = (Date.now() - new Date(existing.last).getTime()) / 1000;
    const newSession = gap > SESSION_WINDOW;
    row = {
      ...existing,
      visits:   (existing.visits   || 0) + 1,
      sessions: (existing.sessions || 0) + (newSession ? 1 : 0),
      last:     now,
      lastPage: body.page || existing.lastPage,
      // Update device info in case they switched browser
      os:       body.os      || existing.os,
      browser:  body.browser || existing.browser,
      device:   body.device  || existing.device,
      screen:   body.screen  || existing.screen,
      lang:     body.lang    || existing.lang,
    };
  } else {
    row = {
      ipHash:   key.slice(2, 18),             // short public identifier
      ipPrefix: anonymiseIp(ip),              // e.g. "41.220.24.*"
      first:    now,
      last:     now,
      visits:   1,
      sessions: 1,
      // Geography — Cloudflare gives this for free from the edge
      country:  cf.country  || body.country  || '',
      countryName: cf.country ? countryName(cf.country) : (body.countryName || ''),
      region:   cf.region   || body.region   || '',
      city:     cf.city     || body.city     || '',
      postal:   cf.postalCode || '',
      tz:       cf.timezone || body.tz       || '',
      lat:      cf.latitude  ? +cf.latitude  : null,
      lon:      cf.longitude ? +cf.longitude : null,
      asn:      cf.asn      || null,
      asOrg:    cf.asOrganization || '',
      // Device — from client
      os:       body.os      || '',
      browser:  body.browser || '',
      device:   body.device  || '',
      screen:   body.screen  || '',
      lang:     body.lang    || '',
      lastPage: body.page    || '',
      referrer: (body.referrer || '').slice(0, 200),
    };
  }

  await env.VISITORS.put(key, JSON.stringify(row));
  return json({ ok: true, unique: !existing, ipPrefix: row.ipPrefix }, CORS);
}

/* ---------- GET /list ---------- */
async function listVisitors(env, CORS) {
  const listing = await env.VISITORS.list({ prefix: 'v:', limit: MAX_ROWS_LIST });
  const rows = [];
  await Promise.all(listing.keys.map(async k => {
    const r = await env.VISITORS.get(k.name, { type: 'json' });
    if (r) rows.push(r);
  }));
  rows.sort((a, b) => new Date(b.last) - new Date(a.last));

  const totalVisits = rows.reduce((s, r) => s + (r.visits || 0), 0);
  const countries   = {};
  const devices     = {};
  const browsers    = {};
  for (const r of rows) {
    if (r.countryName || r.country) {
      const k = r.countryName || r.country;
      countries[k] = (countries[k] || 0) + 1;
    }
    if (r.device)  devices[r.device]   = (devices[r.device]   || 0) + 1;
    if (r.browser) {
      const b = r.browser.split(' ')[0];
      browsers[b] = (browsers[b] || 0) + 1;
    }
  }

  return json({
    generatedAt:    new Date().toISOString(),
    uniqueVisitors: rows.length,
    totalVisits,
    countries,
    devices,
    browsers,
    rows,
  }, CORS);
}

/* ---------- GET /stats ---------- */
async function stats(env, CORS) {
  const listing = await env.VISITORS.list({ prefix: 'v:', limit: MAX_ROWS_LIST });
  let totalVisits = 0;
  const countries = {};
  await Promise.all(listing.keys.map(async k => {
    const r = await env.VISITORS.get(k.name, { type: 'json' });
    if (!r) return;
    totalVisits += r.visits || 0;
    const c = r.countryName || r.country;
    if (c) countries[c] = (countries[c] || 0) + 1;
  }));
  return json({ uniqueVisitors: listing.keys.length, totalVisits, countries }, CORS);
}

/* ---------- GET /clear?key=... ---------- */
async function clearAll(url, env, CORS) {
  const adminKey = url.searchParams.get('key');
  if (!env.ADMIN_KEY || adminKey !== env.ADMIN_KEY) {
    return json({ error: 'unauthorized' }, CORS, 401);
  }
  const listing = await env.VISITORS.list({ prefix: 'v:', limit: MAX_ROWS_LIST });
  await Promise.all(listing.keys.map(k => env.VISITORS.delete(k.name)));
  return json({ ok: true, cleared: listing.keys.length }, CORS);
}

/* ---------- helpers ---------- */
function json(obj, CORS, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...CORS
    }
  });
}

async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function anonymiseIp(ip) {
  if (!ip || ip === 'unknown') return 'unknown';
  if (ip.includes(':')) {
    // IPv6 — keep first 4 groups only
    const parts = ip.split(':');
    return parts.slice(0, 4).join(':') + '::/64';
  }
  const parts = ip.split('.');
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.*` : ip;
}

function countryName(code) {
  const map = {
    UG:'Uganda', KE:'Kenya', TZ:'Tanzania', RW:'Rwanda', BI:'Burundi',
    ET:'Ethiopia', ZA:'South Africa', NG:'Nigeria', GH:'Ghana', EG:'Egypt',
    US:'United States', CA:'Canada', MX:'Mexico', BR:'Brazil', AR:'Argentina',
    GB:'United Kingdom', IE:'Ireland', DE:'Germany', FR:'France', ES:'Spain',
    IT:'Italy', NL:'Netherlands', BE:'Belgium', CH:'Switzerland', AT:'Austria',
    SE:'Sweden', NO:'Norway', DK:'Denmark', FI:'Finland', PL:'Poland',
    RU:'Russia', UA:'Ukraine', TR:'Turkey', GR:'Greece', PT:'Portugal',
    AE:'United Arab Emirates', SA:'Saudi Arabia', QA:'Qatar', KW:'Kuwait',
    IL:'Israel', LB:'Lebanon', JO:'Jordan', IN:'India', PK:'Pakistan',
    BD:'Bangladesh', LK:'Sri Lanka', CN:'China', HK:'Hong Kong', TW:'Taiwan',
    JP:'Japan', KR:'South Korea', SG:'Singapore', MY:'Malaysia', TH:'Thailand',
    VN:'Vietnam', ID:'Indonesia', PH:'Philippines', AU:'Australia', NZ:'New Zealand',
    CH:'Switzerland', LU:'Luxembourg',
  };
  return map[code] || code;
}
