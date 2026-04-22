(function () {
  // ==========================================================================
  // Google Ads / GA4 conversion tracking configuration
  // ==========================================================================
  // REPLACE placeholders below with your real Google Ads Conversion ID + labels
  // from https://ads.google.com → Tools → Conversions.
  // Create ONE conversion action per event (lead form, phone, email, compliance
  // pack request) and paste the "conversion label" (string after the slash).
  const ADS_CONFIG = {
    adsId: 'AW-XXXXXXXXX',
    conversions: {
      lead_form:        'AW-XXXXXXXXX/ABC123-form',     // contact form submit
      phone_click:      'AW-XXXXXXXXX/ABC123-phone',    // tel: link click
      email_click:      'AW-XXXXXXXXX/ABC123-email',    // mailto: click
      compliance_pack:  'AW-XXXXXXXXX/ABC123-docs',     // compliance downloads
      begin_checkout:   'AW-XXXXXXXXX/ABC123-cta'       // "Start a Transaction" CTA
    }
  };

  const track = (eventName, params) => {
    if (typeof gtag === 'function') gtag('event', eventName, params || {});
  };
  const trackConversion = (sendTo, value, extra) => {
    if (typeof gtag !== 'function') return;
    gtag('event', 'conversion', Object.assign({
      send_to: sendTo,
      value: value || 1.0,
      currency: 'USD'
    }, extra || {}));
  };

  // ==========================================================================
  // Mobile nav toggle
  // ==========================================================================
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      nav.classList.toggle('open');
      const expanded = nav.classList.contains('open');
      toggle.setAttribute('aria-expanded', expanded);
    });
  }

  // Highlight active nav link
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === path || (path === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });

  // Indicative LBMA price widget (placeholder)
  const priceEl = document.getElementById('live-price');
  if (priceEl) {
    const base = 2340;
    const jitter = (Math.random() - 0.5) * 6;
    priceEl.textContent = 'USD $' + (base + jitter).toFixed(2) + ' / oz';
  }

  // ==========================================================================
  // Contact form handler + conversion
  // ==========================================================================
  const form = document.querySelector('form.contact-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const ok = document.getElementById('form-ok');
      if (ok) {
        ok.style.display = 'block';
        form.reset();
        ok.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      // Fire Google Ads + GA4 conversion for lead
      const buyerType = form.querySelector('#btype') ? form.querySelector('#btype').value : '';
      const product = form.querySelector('#product') ? form.querySelector('#product').value : '';
      trackConversion(ADS_CONFIG.conversions.lead_form, 100.0, {
        event_category: 'lead',
        event_label: buyerType || 'buyer_inquiry'
      });
      track('generate_lead', {
        form_name: 'buyer_inquiry',
        buyer_type: buyerType,
        product_interest: product,
        currency: 'USD',
        value: 100.0
      });
    });
  }

  // ==========================================================================
  // Phone + email click tracking
  // ==========================================================================
  document.querySelectorAll('a[href^="tel:"]').forEach(a => {
    a.addEventListener('click', () => {
      trackConversion(ADS_CONFIG.conversions.phone_click, 25.0, {
        event_category: 'engagement',
        event_label: 'phone_click'
      });
      track('phone_click', { phone: a.getAttribute('href').replace('tel:', '') });
    });
  });

  document.querySelectorAll('a[href^="mailto:"]').forEach(a => {
    a.addEventListener('click', () => {
      trackConversion(ADS_CONFIG.conversions.email_click, 15.0, {
        event_category: 'engagement',
        event_label: 'email_click'
      });
      track('email_click', { email: a.getAttribute('href').replace('mailto:', '') });
    });
  });

  // Primary CTA buttons → "begin_checkout" style event
  document.querySelectorAll('.btn-primary').forEach(btn => {
    btn.addEventListener('click', () => {
      trackConversion(ADS_CONFIG.conversions.begin_checkout, 50.0, {
        event_category: 'engagement',
        event_label: 'primary_cta',
        label_text: (btn.textContent || '').trim().slice(0, 60)
      });
      track('cta_click', { cta_label: (btn.textContent || '').trim().slice(0, 60) });
    });
  });

  // Compliance-pack "Request access" links
  document.querySelectorAll('.download-card .req-link').forEach(a => {
    a.addEventListener('click', () => {
      const doc = a.closest('.download-card').querySelector('h3');
      trackConversion(ADS_CONFIG.conversions.compliance_pack, 30.0, {
        event_category: 'engagement',
        event_label: doc ? doc.textContent.trim() : 'compliance_doc'
      });
      track('request_document', {
        document: doc ? doc.textContent.trim() : 'unknown'
      });
    });
  });

  // ==========================================================================
  // Header scroll shadow
  // ==========================================================================
  const header = document.querySelector('.site-header');
  if (header) {
    const onScroll = () => {
      if (window.scrollY > 8) header.classList.add('scrolled');
      else header.classList.remove('scrolled');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ==========================================================================
  // Stat counter + reveal-on-scroll
  // ==========================================================================
  const animateCount = (el, finalText) => {
    const match = finalText.match(/^([\d,]+)(.*)$/);
    if (!match) { el.textContent = finalText; return; }
    const targetNum = parseInt(match[1].replace(/,/g, ''), 10);
    const suffix = match[2];
    if (isNaN(targetNum)) { el.textContent = finalText; return; }
    const duration = 1400;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const cur = Math.round(targetNum * eased);
      el.textContent = cur.toLocaleString() + suffix;
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = finalText;
    };
    requestAnimationFrame(tick);
  };

  if ('IntersectionObserver' in window) {
    document.querySelectorAll('.review-card, section .split, .steps .step, .faq-item').forEach(el => {
      el.classList.add('reveal');
    });
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          if (el.classList.contains('stat-num')) {
            const text = el.getAttribute('data-final') || el.textContent.trim();
            el.setAttribute('data-final', text);
            animateCount(el, text);
            el.classList.add('in-view');
          } else {
            el.classList.add('visible');
          }
          obs.unobserve(el);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.stat-num').forEach(el => {
      el.setAttribute('data-final', el.textContent.trim());
      el.textContent = '0';
      obs.observe(el);
    });
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
  }

  // Parallax tilt on hero
  const hero = document.querySelector('.hero');
  if (hero && window.matchMedia('(min-width: 900px)').matches) {
    window.addEventListener('mousemove', (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 8;
      const y = (e.clientY / window.innerHeight - 0.5) * 6;
      hero.style.backgroundPosition = `${50 + x}% ${50 + y}%, ${50 + x/2}% ${50 + y/2}%, center, center, center`;
    }, { passive: true });
  }

  // ==========================================================================
  // Scroll-to-top
  // ==========================================================================
  (function initScrollTop () {
    const btn = document.createElement('button');
    btn.className = 'scroll-top-btn';
    btn.setAttribute('aria-label', 'Scroll to top');
    btn.innerHTML = '↑';
    document.body.appendChild(btn);
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    window.addEventListener('scroll', () => {
      btn.classList.toggle('visible', window.scrollY > 400);
    }, { passive: true });
  })();

  // ==========================================================================
  // Cookie consent + Google Consent Mode v2 integration
  // ==========================================================================
  (function initCookieConsent () {
    const KEY = 'rvm-cookie-consent';
    const stored = localStorage.getItem(KEY);

    // If user has previously chosen, apply their choice immediately
    if (stored === 'accepted' && typeof gtag === 'function') {
      gtag('consent', 'update', {
        'ad_storage': 'granted',
        'ad_user_data': 'granted',
        'ad_personalization': 'granted',
        'analytics_storage': 'granted'
      });
      return;
    }
    if (stored === 'essential-only') {
      // Keep ads denied, but allow anonymous analytics
      if (typeof gtag === 'function') {
        gtag('consent', 'update', { 'analytics_storage': 'granted' });
      }
      return;
    }

    const banner = document.createElement('div');
    banner.className = 'cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Cookie consent');
    banner.innerHTML = `
      <p>We use cookies for essential site functionality, anonymous analytics, and advertising.
      See our <a href="privacy.html">Privacy Policy</a> for details.</p>
      <div class="actions">
        <button class="cookie-decline" type="button">Essential only</button>
        <button class="cookie-accept" type="button">Accept all</button>
      </div>
    `;
    document.body.appendChild(banner);
    requestAnimationFrame(() => banner.classList.add('visible'));

    const dismiss = (choice) => {
      localStorage.setItem(KEY, choice);
      localStorage.setItem(KEY + '-at', new Date().toISOString());
      banner.classList.remove('visible');
      banner.classList.add('dismissed');
      setTimeout(() => banner.remove(), 500);

      if (typeof gtag !== 'function') return;
      if (choice === 'accepted') {
        gtag('consent', 'update', {
          'ad_storage': 'granted',
          'ad_user_data': 'granted',
          'ad_personalization': 'granted',
          'analytics_storage': 'granted'
        });
      } else {
        gtag('consent', 'update', { 'analytics_storage': 'granted' });
      }
    };
    banner.querySelector('.cookie-accept').addEventListener('click', () => dismiss('accepted'));
    banner.querySelector('.cookie-decline').addEventListener('click', () => dismiss('essential-only'));
  })();

  // ==========================================================================
  // Visitor counter (localStorage) — excludes /visitors.html itself
  // ==========================================================================
  (function(){
    try {
      const currentPage = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
      if (currentPage === 'visitors.html') return;   // don't count dashboard views

      const KEY  = 'rvm_visits_v1';
      const now  = new Date();
      const raw  = localStorage.getItem(KEY);
      const data = raw ? JSON.parse(raw)
                       : { visits:0, sessions:0, first:now.toISOString(), last:now.toISOString(), sessionId:null };

      // A "session" = new visit if last activity was > 30 min ago
      const minsSince = (now - new Date(data.last)) / 60000;
      if (!data.sessionId || minsSince > 30) {
        data.sessions  = (data.sessions || 0) + 1;
        data.sessionId = now.getTime().toString(36);
      }
      data.visits = (data.visits || 0) + 1;
      data.last   = now.toISOString();
      if (!data.first) data.first = now.toISOString();
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch(e) { /* localStorage disabled — silent skip */ }
  })();

})();
