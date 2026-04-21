(function () {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      nav.classList.toggle('open');
      const expanded = nav.classList.contains('open');
      toggle.setAttribute('aria-expanded', expanded);
    });
  }

  // Highlight active nav link based on current page
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === path || (path === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });

  // Simple live-price placeholder (static reference — swap with a feed when available)
  const priceEl = document.getElementById('live-price');
  if (priceEl) {
    const base = 2340;
    const jitter = (Math.random() - 0.5) * 6;
    priceEl.textContent = 'USD $' + (base + jitter).toFixed(2) + ' / oz';
  }

  // Contact form — soft handler (demo only; replace action/endpoint for production)
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
    });
  }

  // Header shadow on scroll
  const header = document.querySelector('.site-header');
  if (header) {
    const onScroll = () => {
      if (window.scrollY > 8) header.classList.add('scrolled');
      else header.classList.remove('scrolled');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Animate stat numbers counting up on scroll
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

  // IntersectionObserver for reveal + stat animations
  if ('IntersectionObserver' in window) {
    // Auto-tag stats and review cards for reveal
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

  // Parallax-ish subtle tilt on hero
  const hero = document.querySelector('.hero');
  if (hero && window.matchMedia('(min-width: 900px)').matches) {
    window.addEventListener('mousemove', (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 8;
      const y = (e.clientY / window.innerHeight - 0.5) * 6;
      hero.style.backgroundPosition = `${50 + x}% ${50 + y}%, ${50 + x/2}% ${50 + y/2}%, center, center, center`;
    }, { passive: true });
  }
})();
