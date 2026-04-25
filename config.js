/* ============================================================
   Rift Valley Minerals — site-wide configuration
   ------------------------------------------------------------
   ONE place to set runtime values for the whole site.
   Edit this file, commit, push — every page picks it up.
   ============================================================ */

/**
 * Cloudflare Worker base URL for the visitor-log API.
 *
 *   Empty string  → server-side log disabled (dashboard shows
 *                    only the current-browser counter)
 *   Any URL       → /log + /list endpoints active
 *
 * After deploying api/worker.js, paste your URL here, e.g.
 *   window.RVM_API_BASE = 'https://rvm-visitor-log.yourname.workers.dev';
 * or, if you bound the worker to your own domain via wrangler.toml:
 *   window.RVM_API_BASE = 'https://riftvalleyminerals.com/api';
 */
window.RVM_API_BASE = '';
