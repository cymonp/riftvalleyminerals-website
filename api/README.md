# Rift Valley Minerals — Visitor Log API

A tiny **Cloudflare Worker** that captures one row per unique visitor
IP and stores it in Cloudflare KV. The static site (`visitors.html`)
fetches this data to render the site-wide aggregated table.

## Why Cloudflare Workers?

GitHub Pages is static-only, so the site cannot store data on its own.
Cloudflare Workers is the cleanest free alternative:

| Feature              | Cloudflare free plan      |
|----------------------|---------------------------|
| Requests per day     | 100,000                   |
| KV storage           | 1 GB                      |
| KV reads/day         | 100,000                   |
| KV writes/day        | 1,000                     |
| Cold-start time      | ~0 ms (V8 isolates)       |
| Real visitor IP      | `CF-Connecting-IP` header |
| Edge geolocation     | `request.cf.country/city/region/timezone` **free, no API call** |
| Cost if you exceed   | $5/mo for 10M requests    |

## One-time setup (about 5 minutes)

### 1. Install Wrangler
```bash
npm install -g wrangler
```

### 2. Sign in
```bash
wrangler login
```

### 3. Create the KV namespace
```bash
cd api
wrangler kv namespace create VISITORS
```
Copy the returned `id` and paste it into `wrangler.toml` (the `id =` line
under `[[kv_namespaces]]`).

### 4. Set the secrets
```bash
wrangler secret put ADMIN_KEY
# paste any random string — protects /clear endpoint

wrangler secret put SALT
# paste any random string — IP hashing pepper
```

### 5. Deploy
```bash
wrangler deploy
```

Wrangler prints a URL like `https://rvm-visitor-log.<your-account>.workers.dev`.
That is your **API_BASE**.

### 6. Plug the API URL into the site
Open `visitors.html` **and** `script.js` and set:

```js
const API_BASE = 'https://rvm-visitor-log.<your-account>.workers.dev';
```
(search both files for `API_BASE`).

Commit, push — done. Every page load on the site now records one visit,
and `https://riftvalleyminerals.com/visitors.html` shows the live
aggregated table.

## Optional: serve under your own domain

If `riftvalleyminerals.com` is already on Cloudflare DNS, un-comment
the `[[routes]]` block at the bottom of `wrangler.toml`:

```toml
[[routes]]
pattern  = "riftvalleyminerals.com/api/*"
zone_name = "riftvalleyminerals.com"
```

Then `API_BASE = 'https://riftvalleyminerals.com/api'` and the worker
answers on your own domain — no third-party URL visible to browsers.

## Endpoints

| Method | Path                   | Purpose                                     |
|--------|------------------------|---------------------------------------------|
| POST   | `/log`                 | Record a visit (called by `script.js`)      |
| GET    | `/list`                | Return all unique-visitor rows              |
| GET    | `/stats`               | Short summary (totals + country breakdown)  |
| GET    | `/clear?key=ADMIN_KEY` | Wipe all rows (admin only)                  |

## Data schema (one KV entry per unique IP)

```json
{
  "ipHash":   "a3f2c1...",        // first 16 hex chars of SHA-256(ip+salt)
  "ipPrefix": "41.220.24.*",      // anonymised — never raw IP
  "first":    "2026-04-23T09:12:00Z",
  "last":     "2026-04-23T14:05:33Z",
  "visits":   17,
  "sessions": 3,
  "country":  "UG",
  "countryName": "Uganda",
  "region":   "Central Region",
  "city":     "Kampala",
  "postal":   "",
  "tz":       "Africa/Kampala",
  "lat":      0.3476,
  "lon":      32.5825,
  "asn":      36890,
  "asOrg":    "MTN Uganda",
  "os":       "Windows 10/11",
  "browser":  "Chrome 131",
  "device":   "Desktop",
  "screen":   "1920x1080",
  "lang":     "EN-US",
  "lastPage": "products.html",
  "referrer": "https://google.com/"
}
```

## Privacy notes

- Raw IPs are SHA-256 hashed with a secret salt **before** being used
  as the KV key — the hash cannot be reversed.
- Only the anonymised prefix `(41.220.24.*)` is ever returned from the
  API or shown in the dashboard.
- Bots / crawlers (Googlebot, Bingbot, AhrefsBot, etc.) are filtered
  by User-Agent and **not** logged.
- `/visitors.html` self-hits are filtered twice (client side in
  `script.js` + server side in the Worker).
