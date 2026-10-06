/**
 * main.js — UI interactions
 *
 * Handles:
 * - Navbar scroll shadow
 * - Mobile menu open / close
 * - FAQ accordion
 * - Footer copyright year
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {

    /* ── Footer year ──────────────────────────────────────── */
    var yearEl = document.getElementById('footer-year');
    if (yearEl) {
      yearEl.textContent = new Date().getFullYear();
    }


    /* ── Navbar scroll behaviour ──────────────────────────── */
    var navbar = document.querySelector('.navbar');
    if (navbar) {
      var onScroll = function () {
        if (window.scrollY > 8) {
          navbar.classList.add('is-scrolled');
        } else {
          navbar.classList.remove('is-scrolled');
        }
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll(); // run once on load in case page is already scrolled
    }


    /* ── Mobile menu toggle ───────────────────────────────── */
    var navToggle  = document.getElementById('nav-toggle');
    var mobileMenu = document.getElementById('mobile-menu');

    if (navToggle && mobileMenu) {
      navToggle.addEventListener('click', function () {
        var isOpen = !mobileMenu.hidden;

        mobileMenu.hidden = isOpen;
        navToggle.setAttribute('aria-expanded', String(!isOpen));
        navToggle.setAttribute('aria-label', isOpen ? 'Open navigation menu' : 'Close navigation menu');

        // Animate hamburger → X
        navToggle.classList.toggle('is-open', !isOpen);
      });

      // Close menu when a link inside it is clicked
      mobileMenu.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', function () {
          mobileMenu.hidden = true;
          navToggle.setAttribute('aria-expanded', 'false');
          navToggle.setAttribute('aria-label', 'Open navigation menu');
          navToggle.classList.remove('is-open');
        });
      });

      // Close menu on Escape key
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !mobileMenu.hidden) {
          mobileMenu.hidden = true;
          navToggle.setAttribute('aria-expanded', 'false');
          navToggle.classList.remove('is-open');
          navToggle.focus();
        }
      });
    }


    /* ── FAQ accordion ────────────────────────────────────── */
    var faqItems = document.querySelectorAll('[data-faq]');

    faqItems.forEach(function (item) {
      var btn    = item.querySelector('.faq-item__question');
      var answer = item.querySelector('.faq-item__answer');

      if (!btn || !answer) return;

      btn.addEventListener('click', function () {
        var isOpen = !answer.hidden;

        // Close all other items (single-open accordion)
        faqItems.forEach(function (other) {
          if (other === item) return;
          var otherAnswer = other.querySelector('.faq-item__answer');
          var otherBtn    = other.querySelector('.faq-item__question');
          if (otherAnswer && !otherAnswer.hidden) {
            otherAnswer.hidden = true;
            otherBtn.setAttribute('aria-expanded', 'false');
            other.classList.remove('is-open');
          }
        });

        // Toggle this item
        answer.hidden = isOpen;
        btn.setAttribute('aria-expanded', String(!isOpen));
        item.classList.toggle('is-open', !isOpen);
      });
    });


    /* ── Smooth scroll for anchor links ───────────────────── */
    // CSS scroll-behavior handles this, but we add offset for sticky navbar
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
      anchor.addEventListener('click', function (e) {
        var targetId = anchor.getAttribute('href').slice(1);
        if (!targetId) return;
        var target = document.getElementById(targetId);
        if (!target) return;
        e.preventDefault();

        var navbarHeight = navbar ? navbar.getBoundingClientRect().height : 0;
        var targetTop    = target.getBoundingClientRect().top + window.scrollY - navbarHeight - 16;

        window.scrollTo({ top: targetTop, behavior: 'smooth' });
      });
    });

  });
}());


/* ──────────────────────────────────────────────────────────────
   QR CODE GENERATOR
   Handles: tab switching · payload building · server-side
            generation via /api/qr · PNG + SVG download
   ────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  /* ── Payload builders ─────────────────────────────────────── */

  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value : '';
  }

  function escapeWifi(str) {
    // Escape backslash, semicolon, comma, and double-quote per the WiFi QR spec.
    // (Colon is a field separator but does NOT need escaping inside values.)
    return str.replace(/([\\;,"])/g, '\\$1');
  }

  function buildPayload(tab) {
    switch (tab) {

      case 'url': {
        var url = val('qr-url').trim();
        if (!url) return '';
        if (!/^[a-z]+:\/\//i.test(url)) url = 'https://' + url;
        return url;
      }

      case 'text':
        return val('qr-text').trim();

      case 'vcard': {
        var first = val('qr-vcard-first').trim();
        var last  = val('qr-vcard-last').trim();
        var org   = val('qr-vcard-org').trim();
        var tel   = val('qr-vcard-phone').trim();
        var email = val('qr-vcard-email').trim();
        var web   = val('qr-vcard-url').trim();
        if (!first && !last && !tel && !email) return '';
        var lines = [
          'BEGIN:VCARD', 'VERSION:3.0',
          'N:' + last + ';' + first + ';;;',
          'FN:' + (first + ' ' + last).trim(),
        ];
        if (org)   lines.push('ORG:' + org);
        if (tel)   lines.push('TEL;TYPE=CELL:' + tel);
        if (email) lines.push('EMAIL:' + email);
        if (web)   lines.push('URL:' + web);
        lines.push('END:VCARD');
        return lines.join('\n');
      }

      case 'email': {
        var to      = val('qr-email-to').trim();
        var subject = val('qr-email-subject').trim();
        var body    = val('qr-email-body').trim();
        if (!to) return '';
        var href = 'mailto:' + encodeURIComponent(to);
        var qs = [];
        if (subject) qs.push('subject=' + encodeURIComponent(subject));
        if (body)    qs.push('body='    + encodeURIComponent(body));
        if (qs.length) href += '?' + qs.join('&');
        return href;
      }

      case 'sms': {
        var phone = val('qr-sms-phone').trim();
        var msg   = val('qr-sms-msg').trim();
        if (!phone) return '';
        return 'sms:' + phone + (msg ? '?body=' + encodeURIComponent(msg) : '');
      }

      case 'phone': {
        var num = val('qr-phone').trim();
        if (!num) return '';
        return 'tel:' + num;
      }

      case 'wifi': {
        var ssid   = val('qr-wifi-ssid').trim();
        var pass   = val('qr-wifi-pass');
        var enc    = val('qr-wifi-enc');
        var hiddenEl = document.getElementById('qr-wifi-hidden');
        var hidden = hiddenEl && hiddenEl.checked ? 'true' : 'false';
        if (!ssid) return '';
        return 'WIFI:T:' + enc + ';S:' + escapeWifi(ssid) + ';P:' + escapeWifi(pass) + ';H:' + hidden + ';;';
      }

      default: return '';
    }
  }

  /* ── Generator init ───────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {

    var generatorSection = document.getElementById('generator');
    if (!generatorSection) return;

    /* DOM refs */
    var tabs       = Array.from(document.querySelectorAll('.generator-tab'));
    var panels     = Array.from(document.querySelectorAll('.generator-panel'));
    var canvasWrap = document.getElementById('qr-canvas');
    var emptyMsg   = document.getElementById('qr-empty-msg');
    var actionsDiv = document.getElementById('qr-actions');
    var btnPng     = document.getElementById('btn-download-png');
    var btnSvg     = document.getElementById('btn-download-svg');

    var activeTab   = 'url';
    var currentPng  = null;   // latest PNG data URI from server
    var debounceTimer = null;

    /* ── Tab switching ────────────────────────────────────── */
    tabs.forEach(function (tabBtn) {
      tabBtn.addEventListener('click', function () {
        var key = tabBtn.dataset.tab;

        // Deactivate all tabs and hide all panels
        tabs.forEach(function (t) {
          t.classList.remove('is-active');
          t.setAttribute('aria-selected', 'false');
        });
        panels.forEach(function (p) {
          p.hidden = true;
        });

        // Activate the clicked tab and show its panel
        tabBtn.classList.add('is-active');
        tabBtn.setAttribute('aria-selected', 'true');
        var panel = document.getElementById('tab-' + key);
        if (panel) panel.hidden = false;

        activeTab = key;

        // Reset preview when switching tabs
        currentPng = null;
        canvasWrap.innerHTML = '';
        emptyMsg.hidden  = false;
        actionsDiv.hidden = true;

        // Generate immediately if the new panel already has content
        scheduleRefresh();
      });
    });

    /* ── Live preview ─────────────────────────────────────── */
    function scheduleRefresh() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(refreshPreview, 300);
    }

    function refreshPreview() {
      var payload = buildPayload(activeTab);
      if (!payload) {
        currentPng = null;
        canvasWrap.innerHTML = '';
        emptyMsg.hidden   = false;
        actionsDiv.hidden = true;
        return;
      }

      // Show a subtle loading state
      emptyMsg.hidden = true;
      canvasWrap.innerHTML = '<div class="qr-spinner" aria-label="Generating…"></div>';
      actionsDiv.hidden = true;

      fetch('/api/qr', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ data: payload }),
      })
        .then(function (res) { return res.json(); })
        .then(function (json) {
          if (json.error) throw new Error(json.error);
          currentPng = json.dataUri;

          var img = document.createElement('img');
          img.src = currentPng;
          img.alt = 'Generated QR code';
          img.width  = 160;
          img.height = 160;

          canvasWrap.innerHTML = '';
          canvasWrap.appendChild(img);
          actionsDiv.hidden = false;
        })
        .catch(function (err) {
          canvasWrap.innerHTML = '';
          emptyMsg.textContent = 'Could not generate QR code.';
          emptyMsg.hidden = false;
          console.error('QR generation error:', err);
        });
    }

    generatorSection.querySelectorAll('input, textarea, select').forEach(function (el) {
      el.addEventListener('input',  scheduleRefresh);
      el.addEventListener('change', scheduleRefresh);
    });

    /* ── Password show/hide toggle ────────────────────────── */
    generatorSection.querySelectorAll('.input-password-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var input = document.getElementById(btn.dataset.target);
        if (!input) return;
        var show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      });
    });

    /* ── PNG download ─────────────────────────────────────── */
    btnPng.addEventListener('click', function () {
      if (!currentPng) return;
      var link = document.createElement('a');
      link.href     = currentPng;
      link.download = 'phantomqr.png';
      link.click();
    });

    /* ── SVG download ─────────────────────────────────────── */
    btnSvg.addEventListener('click', function () {
      var payload = buildPayload(activeTab);
      if (!payload) return;

      fetch('/api/qr/svg', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ data: payload }),
      })
        .then(function (res) { return res.text(); })
        .then(function (svgText) {
          var blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
          var url  = URL.createObjectURL(blob);
          var link = document.createElement('a');
          link.href     = url;
          link.download = 'phantomqr.svg';
          link.click();
          setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
        })
        .catch(function (err) {
          console.error('SVG download error:', err);
        });
    });

  }); // end DOMContentLoaded

}());
