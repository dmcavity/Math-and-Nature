/* ═══════════════════════════════════════════════════════════════════════
   NATURAL ORDER — book.js
   Loaded in every chapter's <head> (no defer):
     <script src="../shared/book.js"></script>
   It configures MathJax and loads the local copy, then — once the page
   is parsed — wires up collapsing sections, the box toggles, links into
   closed sections, and re-initialisation of widgets when they open.
   Everything here is idempotent: running it twice does no harm.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var NO = window.NaturalOrder = window.NaturalOrder || {};
  if (NO._bookLoaded) return;
  NO._bookLoaded = true;

  /* Folder this script was loaded from, so paths work from any chapter. */
  var here = (function () {
    var s = document.currentScript;
    return s && s.src ? s.src.replace(/[^\/]*$/, '') : '../shared/';
  })();

  /* ── 1. MathJax ─────────────────────────────────────────────────────
     Math is written as $…$ and $$…$$; a literal dollar is \$.
     Do NOT add startup:{typeset:false} — it causes race conditions. */
  if (!window.MathJax) {
    window.MathJax = {
      tex: {
        inlineMath: [['$', '$']],
        displayMath: [['$$', '$$']],
        processEscapes: true,
        packages: { '[+]': ['ams', 'boldsymbol', 'cancel', 'color'] }
      },
      options: {
        skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
        ignoreHtmlClass: 'math-wrap|no-math'
      },
      svg: { fontCache: 'global' }
    };
    var mj = document.createElement('script');
    mj.src = here + 'mathjax/tex-svg-full.js';
    mj.async = true;
    mj.id = 'MathJax-script';
    mj.onerror = function () {               // offline copy missing → CDN
      var cdn = document.createElement('script');
      cdn.src = 'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg-full.js';
      cdn.async = true;
      document.head.appendChild(cdn);
    };
    document.head.appendChild(mj);
  }

  /* ── 2. Widget initialisers ─────────────────────────────────────────
     Widget engines register an init function; it runs on page load and
     again whenever an ibox opens (a closed canvas has no size to draw). */
  NO.widgetInits = NO.widgetInits || [];
  NO.registerWidget = function (fn) {
    if (NO.widgetInits.indexOf(fn) < 0) NO.widgetInits.push(fn);
    if (NO._ready) safe(fn);
  };
  function safe(fn) { try { fn(); } catch (e) { console.warn('[NaturalOrder] widget init:', e); } }
  NO.initWidgets = function () {
    NO.widgetInits.forEach(safe);
    // Older chapter scripts expose initAll* functions directly.
    Object.keys(window).forEach(function (k) {
      if (/^initAll[A-Z]/.test(k) && typeof window[k] === 'function' &&
          NO.widgetInits.indexOf(window[k]) < 0) safe(window[k]);
    });
  };

  /* ── 3. Box toggles ─────────────────────────────────────────────────
     Global names kept for existing markup that calls them via onclick. */
  var BOXES = {
    callout: { open: 'co-open', trigger: '.callout-trigger' },
    example: { open: 'ex-open', trigger: '.example-trigger' },
    ibox:    { open: 'ib-open', trigger: '.ititle' }
  };
  function boxType(el) {
    for (var t in BOXES) if (el.classList.contains(t)) return t;
    return null;
  }
  function setBox(el, open) {
    var t = boxType(el); if (!t) return;
    el.classList.toggle(BOXES[t].open, open);
    var trig = el.querySelector(BOXES[t].trigger);
    if (trig) trig.setAttribute('aria-expanded', open ? 'true' : 'false');
    // Clear any display:none an older editor left inline on the body.
    var body = el.querySelector('.callout-body,.example-body,.ib-body');
    if (body && body.style.display) body.style.display = '';
    var icon = el.querySelector('.ct-icon,.ex-icon,.ib-icon');
    if (icon && icon.style.transform) icon.style.transform = '';
    if (open && NO._ready) opened(el, body);
  }
  /* After something opens: let widgets size and draw themselves, typeset any
     math a widget wrote while hidden, and tell chapter code (event 'boxopen'). */
  function opened(el, body) {
    setTimeout(function () {
      NO.initWidgets();
      window.dispatchEvent(new Event('resize'));
      el.dispatchEvent(new CustomEvent('boxopen', { bubbles: true }));
      if (window.MathJax && MathJax.typesetPromise && body) {
        MathJax.typesetPromise([body]).catch(function () {});
      }
    }, 0);
  }
  function toggleBox(id) {
    var el = document.getElementById(id); if (!el) return;
    var t = boxType(el); if (!t) return;
    setBox(el, !el.classList.contains(BOXES[t].open));
  }
  window.toggleCallout = toggleBox;
  window.toggleExample = toggleBox;
  window.toggleIbox = toggleBox;
  NO.setBox = setBox;

  /* ── 4. Sections and subsections ────────────────────────────────────
     Sections start closed except the first; opening a section opens all
     of its subsections; each subsection can then be closed on its own. */
  function foldHead(sec) {
    return sec.classList.contains('sec') ? sec.querySelector(':scope > .sec-head')
                                         : sec.querySelector(':scope > h3.sub');
  }
  function setSection(sec, open) {
    sec.classList.toggle('collapsed', !open);
    var head = foldHead(sec);
    var btn = head && head.querySelector(':scope > .fold-btn');
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open && sec.classList.contains('sec')) {
      sec.querySelectorAll(':scope > section.sub').forEach(function (s) { setSection(s, true); });
    }
    if (open && NO._ready) opened(sec, null);
  }
  NO.setSection = setSection;

  function addFold(sec) {
    var head = foldHead(sec);
    if (!head || head.querySelector(':scope > .fold-btn')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fold-btn';
    btn.textContent = '▶';
    var title = (head.querySelector('h2') || head).textContent.trim();
    btn.setAttribute('aria-label', 'Show or hide: ' + title);
    head.insertBefore(btn, head.firstChild);
    head.classList.add('foldable');
    head.addEventListener('click', function (e) {
      if (e.target.closest('a, input, select, textarea')) return;
      if (window.getSelection && String(window.getSelection())) return; // selecting text
      setSection(sec, sec.classList.contains('collapsed'));
    });
  }

  function initSections() {
    var secs = document.querySelectorAll('section.sec');
    secs.forEach(function (sec, i) {
      addFold(sec);
      sec.querySelectorAll(':scope > section.sub').forEach(addFold);
      var open = sec.hasAttribute('data-open') ? sec.getAttribute('data-open') !== 'false'
                                               : i === 0;
      setSection(sec, open);
    });
  }

  /* ── 5. Links into closed places ────────────────────────────────────
     Following #id opens every enclosing section, subsection and box. */
  function reveal(target) {
    var opened = false;
    for (var el = target; el && el !== document.body; el = el.parentElement) {
      if (el.matches('section.sec.collapsed, section.sub.collapsed')) {
        setSection(el, true); opened = true;
      } else if (boxType(el)) {
        var t = boxType(el);
        if (!el.classList.contains(BOXES[t].open)) { setBox(el, true); opened = true; }
      }
    }
    return opened;
  }
  function goTo(id, flash) {
    var target = id && document.getElementById(id);
    if (!target) return false;
    reveal(target);
    requestAnimationFrame(function () {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (flash) {
        target.classList.remove('jump-flash'); void target.offsetWidth;
        target.classList.add('jump-flash');
      }
    });
    return true;
  }
  NO.goTo = goTo;

  /* ── 6. Wiring ──────────────────────────────────────────────────────*/
  function onClick(e) {
    // Box triggers without their own onclick (canonical v6 markup).
    var trig = e.target.closest('.callout-trigger, .example-trigger, .ibox .ititle');
    if (trig && !trig.hasAttribute('onclick')) {
      var box = trig.closest('.callout, .example, .ibox');
      if (box) {
        var t = boxType(box);
        setBox(box, !box.classList.contains(BOXES[t].open));
        return;
      }
    }
    // In-page links.
    var a = e.target.closest('a[href^="#"]');
    if (a && a.getAttribute('href').length > 1) {
      var id = decodeURIComponent(a.getAttribute('href').slice(1));
      if (goTo(id, a.classList.contains('xref'))) {
        e.preventDefault();
        history.pushState(null, '', '#' + id);
      }
    }
  }

  function init() {
    if (NO._ready) return;
    NO._ready = true;
    // Boxes: closed by default; ARIA state matches.
    document.querySelectorAll('.callout, .example, .ibox').forEach(function (b) {
      var t = boxType(b);
      setBox(b, b.classList.contains(BOXES[t].open));
    });
    initSections();
    document.addEventListener('click', onClick);
    window.addEventListener('hashchange', function () { goTo(location.hash.slice(1)); });
    if (location.hash.length > 1) goTo(decodeURIComponent(location.hash.slice(1)));
    NO.initWidgets();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
