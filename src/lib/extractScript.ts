// Runs INSIDE the page (browser). Kept as a plain JS string so the bundler can't change it.
export const EXTRACT_SCRIPT = String.raw`
(() => {
  const add = (o, k, w) => { if (!k) return; o[k] = (o[k] || 0) + w; };
  const toHex = (c) => {
    const m = c && c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);
    if (p.length >= 4 && p[3] < 0.15) return null;
    return '#' + p.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  };
  const selOf = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    else if (typeof el.className === 'string' && el.className.trim()) s += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
    return s.slice(0, 80);
  };

  const bg = {}, text = {}, border = {}, fonts = {}, sizes = {}, weights = {};
  const cssAnimated = []; let transitionEls = 0; const transitionProps = {};
  const spacing = {}, radius = {}, shadows = {}, gradients = {}, lineHeights = {}, letterSp = {}, maxWidths = {}, durations = {}, easings = {}, zIndex = {};
  let flexCount = 0, gridCount = 0;
  const cards = [];
  const els = Array.from(document.querySelectorAll('body, body *')).slice(0, 5000);
  for (const el of els) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    const area = r.width * r.height;
    if (area > 0) {
      for (const p of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginBottom', 'rowGap', 'columnGap']) {
        const v = parseFloat(cs[p]);
        if (v > 0 && v < 400) add(spacing, Math.round(v) + 'px', 1);
      }
      if (cs.borderTopLeftRadius && cs.borderTopLeftRadius !== '0px') add(radius, cs.borderTopLeftRadius, 1);
      if (cs.boxShadow && cs.boxShadow !== 'none') add(shadows, cs.boxShadow, 1);
      if (cs.backgroundImage && cs.backgroundImage.includes('gradient')) add(gradients, cs.backgroundImage.slice(0, 220), area);
      if (cs.display.includes('flex')) flexCount++;
      if (cs.display.includes('grid')) gridCount++;
      if (cs.maxWidth && cs.maxWidth !== 'none' && r.width > 500) add(maxWidths, cs.maxWidth, 1);
      if (cs.zIndex && cs.zIndex !== 'auto') add(zIndex, cs.zIndex, 1);
      const tds = cs.transitionDuration.split(',').concat(cs.animationDuration.split(',')).map((x) => x.trim()).filter((x) => parseFloat(x) > 0);
      tds.forEach((d) => add(durations, d, 1));
      if (tds.length) cs.transitionTimingFunction.split(/,(?![^(]*\))/).forEach((e) => add(easings, e.trim(), 1));
      if (cards.length < 40 && r.width > 160 && r.height > 100 && r.width < innerWidth * 0.9 && cs.borderTopLeftRadius !== '0px' && (cs.boxShadow !== 'none' || parseFloat(cs.borderTopWidth) > 0) && toHex(cs.backgroundColor)) {
        cards.push({ bg: toHex(cs.backgroundColor), radius: cs.borderTopLeftRadius, shadow: cs.boxShadow !== 'none' ? cs.boxShadow.slice(0, 120) : null, border: parseFloat(cs.borderTopWidth) > 0 ? cs.borderTopWidth + ' ' + cs.borderTopStyle + ' ' + toHex(cs.borderTopColor) : null, padding: cs.padding });
      }
    }
    if (area > 0) add(bg, toHex(cs.backgroundColor), area);
    if (parseFloat(cs.borderTopWidth) > 0) add(border, toHex(cs.borderTopColor), r.width);
    let direct = '';
    for (const n of el.childNodes) if (n.nodeType === 3) direct += n.textContent.trim();
    if (direct && area > 0) {
      const len = direct.length;
      add(text, toHex(cs.color), len);
      add(fonts, cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(), len);
      add(sizes, cs.fontSize, len);
      add(weights, cs.fontWeight, len);
      add(lineHeights, cs.lineHeight === 'normal' ? 'normal' : (parseFloat(cs.lineHeight) / parseFloat(cs.fontSize)).toFixed(2) + ' (' + cs.lineHeight + ')', len);
      if (cs.letterSpacing !== 'normal') add(letterSp, cs.letterSpacing, len);
    }
    if (cs.animationName && cs.animationName !== 'none' && cssAnimated.length < 60) {
      cssAnimated.push({ el: selOf(el), name: cs.animationName, duration: cs.animationDuration, timing: cs.animationTimingFunction, iteration: cs.animationIterationCount });
    }
    if (cs.transitionDuration && cs.transitionDuration.split(',').some((d) => parseFloat(d) > 0)) {
      transitionEls++;
      cs.transitionProperty.split(',').forEach((p) => add(transitionProps, p.trim(), 1));
    }
  }

  // Element-level style samples (headings, body, buttons, links, inputs, nav, footer)
  const textStyle = (el) => { const c = getComputedStyle(el); return { font: c.fontFamily.split(',')[0].replace(/["']/g, '').trim(), size: c.fontSize, weight: c.fontWeight, lineHeight: c.lineHeight, letterSpacing: c.letterSpacing, color: toHex(c.color), transform: c.textTransform !== 'none' ? c.textTransform : null }; };
  const visible = (el) => { const r = el.getBoundingClientRect(); const c = getComputedStyle(el); return r.width > 0 && r.height > 0 && c.display !== 'none' && c.visibility !== 'hidden'; };
  const firstVis = (sel) => Array.from(document.querySelectorAll(sel)).find(visible);
  const textStyles = {};
  for (const tag of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'li', 'small', 'label', 'blockquote', 'code']) { const e = firstVis(tag); if (e) textStyles[tag] = textStyle(e); }
  const btnSeen = new Set(); const buttons = [];
  for (const b of Array.from(document.querySelectorAll('button, [role=button], a[class*="btn"], a[class*="button"], a[class*="Button"], input[type=submit]')).filter(visible)) {
    const c = getComputedStyle(b);
    const s = { text: (b.innerText || b.value || '').trim().slice(0, 30), bg: toHex(c.backgroundColor), bgImage: c.backgroundImage !== 'none' ? c.backgroundImage.slice(0, 160) : null, color: toHex(c.color), border: parseFloat(c.borderTopWidth) > 0 ? c.borderTopWidth + ' ' + c.borderTopStyle + ' ' + toHex(c.borderTopColor) : 'none', radius: c.borderTopLeftRadius, padding: c.padding, fontSize: c.fontSize, fontWeight: c.fontWeight, shadow: c.boxShadow !== 'none' ? c.boxShadow.slice(0, 120) : null, transition: c.transitionDuration !== '0s' ? c.transitionProperty + ' ' + c.transitionDuration : null, height: Math.round(b.getBoundingClientRect().height) + 'px' };
    const k = [s.bg, s.color, s.border, s.radius, s.fontSize].join('|');
    if (!btnSeen.has(k) && s.text) { btnSeen.add(k); buttons.push(s); }
    if (buttons.length >= 8) break;
  }
  const inputEl = firstVis('input[type=text], input[type=email], input[type=search], input:not([type]), textarea, select');
  const input = inputEl ? (() => { const c = getComputedStyle(inputEl); return { bg: toHex(c.backgroundColor), color: toHex(c.color), border: c.borderTopWidth + ' ' + c.borderTopStyle + ' ' + toHex(c.borderTopColor), radius: c.borderTopLeftRadius, padding: c.padding, fontSize: c.fontSize, height: Math.round(inputEl.getBoundingClientRect().height) + 'px' }; })() : null;
  const block = (sel) => { const e = firstVis(sel); if (!e) return null; const c = getComputedStyle(e); const r = e.getBoundingClientRect(); return { bg: toHex(c.backgroundColor), height: Math.round(r.height) + 'px', position: c.position, shadow: c.boxShadow !== 'none' ? c.boxShadow.slice(0, 100) : null, borderBottom: parseFloat(c.borderBottomWidth) > 0 ? c.borderBottomWidth + ' ' + toHex(c.borderBottomColor) : null, backdrop: c.backdropFilter && c.backdropFilter !== 'none' ? c.backdropFilter : null, links: e.querySelectorAll('a').length }; };
  const linkEl = firstVis('main a, p a, article a') || firstVis('a');
  const linkStyle = linkEl ? (() => { const c = getComputedStyle(linkEl); return { color: toHex(c.color), decoration: c.textDecorationLine, weight: c.fontWeight }; })() : null;
  const icons = { svg: document.querySelectorAll('svg').length, iconFont: !!document.querySelector('[class*="fa-"], .material-icons, [class*="icon-"], .bi'), imgs: document.images.length };
  const mediaQ = new Set();

  // Stylesheets: keyframes, CSS variables, @font-face, media queries
  const keyframes = new Set(); const cssVars = {}; const fontFaces = new Set(); let blockedSheets = 0;
  const walk = (rules) => {
    for (const rule of rules) {
      if (rule.type === 4 && rule.conditionText) (rule.conditionText.match(/(min|max)-width:\s*[\d.]+(px|em|rem)/g) || []).forEach((m) => mediaQ.add(m.replace(/\s+/g, ' ')));
      if (rule.type === 7 && rule.name) keyframes.add(rule.name);
      else if (rule.type === 5) fontFaces.add((rule.style.getPropertyValue('font-family') || '').replace(/["']/g, '').trim());
      else if (rule.type === 1 && /(^|,)\s*(:root|html)\s*(,|$)/.test(rule.selectorText || '')) {
        for (const p of rule.style) if (p.startsWith('--') && Object.keys(cssVars).length < 80) cssVars[p] = rule.style.getPropertyValue(p).trim();
      }
      if (rule.cssRules) walk(rule.cssRules);
    }
  };
  for (const sh of document.styleSheets) { try { walk(sh.cssRules); } catch { blockedSheets++; } }

  // Web Animations API (covers CSS animations/transitions + JS libs that use WAAPI)
  const anims = { css: 0, transitions: 0, waapi: 0 };
  try {
    for (const a of document.getAnimations()) {
      const t = a.constructor && a.constructor.name;
      if (t === 'CSSAnimation') anims.css++; else if (t === 'CSSTransition') anims.transitions++; else anims.waapi++;
    }
  } catch {}

  const w = window;
  const scripts = Array.from(document.scripts).map((s) => s.src).filter(Boolean);
  const srcHas = (re) => scripts.some((s) => re.test(s));
  const animLibs = [];
  const lib = (name, test, version) => { try { if (test()) animLibs.push({ name, version: version ? version() : null }); } catch {} };
  lib('GSAP', () => w.gsap || w.TweenMax || srcHas(/gsap/i), () => (w.gsap && w.gsap.version) || null);
  lib('GSAP ScrollTrigger', () => w.ScrollTrigger || srcHas(/ScrollTrigger/i));
  lib('Anime.js', () => w.anime || srcHas(/anime(\.min)?\.js/i));
  lib('Lottie', () => w.lottie || w.bodymovin || document.querySelector('lottie-player, dotlottie-player') || srcHas(/lottie/i));
  lib('AOS (Animate On Scroll)', () => w.AOS || document.querySelector('[data-aos]'));
  lib('Animate.css', () => document.querySelector('.animate__animated'));
  lib('Three.js', () => w.THREE || srcHas(/three(\.module)?(\.min)?\.js/i), () => (w.THREE && w.THREE.REVISION) ? 'r' + w.THREE.REVISION : null);
  lib('Lenis (smooth scroll)', () => w.Lenis || w.lenis || document.documentElement.classList.contains('lenis'));
  lib('Locomotive Scroll', () => w.LocomotiveScroll || document.querySelector('[data-scroll-container]'));
  lib('ScrollMagic', () => w.ScrollMagic);
  lib('Velocity.js', () => w.Velocity);
  lib('Swiper', () => w.Swiper || document.querySelector('.swiper, .swiper-container'));
  lib('Barba.js', () => w.barba || document.querySelector('[data-barba]'));
  lib('Framer Motion', () => document.querySelector('[data-framer-appear-id], [data-projection-id]') || srcHas(/framer-motion/i));
  lib('Motion One', () => srcHas(/motion(\.min)?\.js|\/motion@/i));
  lib('Spline', () => document.querySelector('spline-viewer') || srcHas(/spline/i));
  lib('Rive', () => srcHas(/rive/i) && document.querySelector('canvas'));
  lib('Typed.js', () => w.Typed);
  lib('Splitting / SplitType', () => w.Splitting || w.SplitType || document.querySelector('[data-splitting]'));
  lib('Rellax (parallax)', () => w.Rellax || document.querySelector('.rellax'));
  lib('Lax / Parallax.js', () => w.lax || w.Parallax);

  // Tech stack (front-end signals)
  const tech = [];
  const t = (name, test, version) => { try { if (test()) tech.push({ name, version: version ? version() : null }); } catch {} };
  const html = document.documentElement.outerHTML.slice(0, 400000);
  const hasReact = () => w.React || document.querySelector('[data-reactroot]') || Array.from(document.querySelectorAll('body > div, #root, #__next')).some((e) => Object.keys(e).some((k) => k.startsWith('__react')));
  t('Next.js', () => w.__NEXT_DATA__ || w.next || document.querySelector('#__next, script[src*="/_next/"]'), () => (w.next && w.next.version) || null);
  t('Nuxt', () => w.__NUXT__ || w.$nuxt || document.querySelector('#__nuxt'));
  t('React', hasReact, () => (w.React && w.React.version) || null);
  t('Vue', () => w.Vue || w.__VUE__ || document.querySelector('[data-v-app]') || /data-v-[0-9a-f]{8}/.test(html), () => (w.Vue && w.Vue.version) || null);
  t('Angular', () => document.querySelector('[ng-version]'), () => document.querySelector('[ng-version]').getAttribute('ng-version'));
  t('AngularJS', () => w.angular && w.angular.version, () => w.angular.version.full);
  t('Svelte', () => /class="[^"]*svelte-[a-z0-9]+/.test(html));
  t('Astro', () => document.querySelector('astro-island, [data-astro-cid]') || /astro-[a-z0-9]{8}/.test(html));
  t('Gatsby', () => document.querySelector('#___gatsby'));
  t('Remix', () => w.__remixContext);
  t('jQuery', () => w.jQuery, () => w.jQuery.fn && w.jQuery.fn.jquery);
  t('jQuery UI', () => w.jQuery && w.jQuery.ui, () => w.jQuery.ui.version);
  t('Bootstrap', () => (w.bootstrap) || document.querySelector('link[href*="bootstrap"]') || srcHas(/bootstrap/i), () => (w.bootstrap && w.bootstrap.Tooltip && w.bootstrap.Tooltip.VERSION) || (w.jQuery && w.jQuery.fn && w.jQuery.fn.tooltip && w.jQuery.fn.tooltip.Constructor && w.jQuery.fn.tooltip.Constructor.VERSION) || null);
  t('Tailwind CSS', () => /\b(?:flex|grid) [^"]*\b(?:px|py|mt|mb|gap)-\d/.test(html) && /\b(?:text|bg)-(?:gray|slate|zinc|neutral|white|black)/.test(html));
  t('Lodash', () => w._ && w._.VERSION, () => w._.VERSION);
  t('Moment.js', () => w.moment && w.moment.version, () => w.moment.version);
  t('Handlebars', () => w.Handlebars, () => w.Handlebars.VERSION);
  t('WordPress', () => /wp-content|wp-includes/.test(html), () => { const g = document.querySelector('meta[name="generator"]'); return g && /WordPress/i.test(g.content) ? g.content.replace(/WordPress\s*/i, '') : null; });
  t('Shopify', () => w.Shopify);
  t('Webflow', () => document.documentElement.hasAttribute('data-wf-page'));
  t('Wix', () => /static\.wixstatic\.com|wix\.com/.test(html));
  t('Squarespace', () => /squarespace/i.test(html));
  t('Framer (site builder)', () => /framerusercontent\.com/.test(html));
  t('Google Analytics', () => w.gtag || w.ga || srcHas(/google-analytics\.com|googletagmanager\.com\/gtag/));
  t('Google Tag Manager', () => w.google_tag_manager || srcHas(/googletagmanager\.com\/gtm/));
  t('Meta Pixel', () => w.fbq);
  t('Hotjar', () => w.hj);
  t('Stripe.js', () => w.Stripe || srcHas(/js\.stripe\.com/));
  t('reCAPTCHA', () => w.grecaptcha);
  t('Cloudflare Turnstile', () => w.turnstile);
  t('Intercom', () => w.Intercom);
  t('HubSpot', () => w._hsq || srcHas(/hs-scripts|hubspot/));
  t('Vercel Analytics', () => w.va || srcHas(/_vercel\/insights/));
  t('Font Awesome', () => document.querySelector('link[href*="font-awesome"], link[href*="fontawesome"], .fa, .fas, .fab'));
  t('Google Fonts', () => document.querySelector('link[href*="fonts.googleapis.com"]') || /fonts\.gstatic\.com/.test(html));
  t('Adobe Fonts', () => document.querySelector('link[href*="use.typekit.net"]'));

  // Script src versions (for outdated-library checks)
  const srcVersions = [];
  for (const s of scripts) {
    const m = s.match(/(jquery(?:-ui)?|bootstrap|lodash|moment|angular|vue|react|handlebars|gsap)[.@/-]v?(\d+\.\d+(?:\.\d+)?)/i);
    if (m) srcVersions.push({ name: m[1].toLowerCase(), version: m[2], src: s.slice(0, 200) });
  }

  // SEO + content
  const meta = (n) => { const e = document.querySelector('meta[name="' + n + '"], meta[property="' + n + '"]'); return e ? e.getAttribute('content') : null; };
  const heads = (tag) => Array.from(document.querySelectorAll(tag)).map((h) => h.innerText.trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 20);
  const imgs = Array.from(document.images);
  const links = Array.from(document.querySelectorAll('a[href]')).map((a) => ({ href: a.href, text: (a.innerText || a.getAttribute('aria-label') || '').trim().slice(0, 80), blank: a.target === '_blank', rel: a.rel }));
  const bodyText = document.body ? document.body.innerText : '';
  const jsonLd = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map((s) => { try { const j = JSON.parse(s.textContent); return [].concat(j['@graph'] || j).map((x) => x && x['@type']).flat(); } catch { return []; } }).flat().filter(Boolean);
  const forms = Array.from(document.forms).map((f) => ({ action: f.action, method: (f.method || 'get').toLowerCase(), hasPassword: !!f.querySelector('input[type=password]') }));

  const nav = performance.getEntriesByType('navigation')[0];
  const res = performance.getEntriesByType('resource');
  const loadedFonts = [];
  try { document.fonts.forEach((f) => { if (f.status === 'loaded') loadedFonts.push(f.family.replace(/["']/g, '') + ' ' + f.weight + (f.style !== 'normal' ? ' ' + f.style : '')); }); } catch {}

  const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
  return {
    colors: { background: top(bg, 12), text: top(text, 10), border: top(border, 6) },
    cssVars,
    design: {
      spacing: top(spacing, 16), radius: top(radius, 10), shadows: top(shadows, 8), gradients: top(gradients, 6),
      lineHeights: top(lineHeights, 6), letterSpacing: top(letterSp, 6), maxWidths: top(maxWidths, 6),
      durations: top(durations, 8), easings: top(easings, 6), zIndex: top(zIndex, 8),
      layout: { flex: flexCount, grid: gridCount, pageWidth: document.documentElement.scrollWidth, pageHeight: document.documentElement.scrollHeight },
      breakpoints: [...mediaQ].slice(0, 30),
      textStyles, buttons, input, link: linkStyle, cards: cards.slice(0, 40),
      header: block('header, [role=banner], nav'), footer: block('footer, [role=contentinfo]'),
      icons,
    },
    typography: { families: top(fonts, 8), sizes: top(sizes, 12), weights: top(weights, 6), loadedFonts: [...new Set(loadedFonts)].slice(0, 30), fontFaces: [...fontFaces].filter(Boolean).slice(0, 30) },
    animations: { keyframes: [...keyframes].slice(0, 60), cssAnimated, transitionEls, transitionProps: top(transitionProps, 10), running: anims, libraries: animLibs, blockedSheets },
    tech, srcVersions,
    seo: {
      title: document.title, description: meta('description'), lang: document.documentElement.lang || null,
      canonical: (document.querySelector('link[rel="canonical"]') || {}).href || null,
      robots: meta('robots'), viewport: meta('viewport'),
      ogTitle: meta('og:title'), ogDescription: meta('og:description'), ogImage: meta('og:image'), twitterCard: meta('twitter:card'),
      favicon: (document.querySelector('link[rel~="icon"]') || {}).href || null,
      h1: heads('h1'), h2: heads('h2'), h3: heads('h3').slice(0, 10),
      wordCount: bodyText.split(/\s+/).filter(Boolean).length,
      images: imgs.length, imagesNoAlt: imgs.filter((i) => !i.hasAttribute('alt')).length,
      jsonLd: [...new Set(jsonLd)].slice(0, 15),
    },
    links, forms,
    inlineScripts: Array.from(document.scripts).filter((s) => !s.src && s.textContent.trim()).length,
    iframes: Array.from(document.querySelectorAll('iframe')).map((f) => f.src).filter(Boolean).slice(0, 10),
    perf: {
      ttfb: nav ? Math.round(nav.responseStart) : null,
      domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
      load: nav ? Math.round(nav.loadEventEnd) : null,
      requests: res.length + 1,
      transferKB: Math.round((res.reduce((s, r) => s + (r.transferSize || 0), 0) + (nav ? nav.transferSize : 0)) / 1024),
      domNodes: document.getElementsByTagName('*').length,
    },
    textSample: bodyText.replace(/\s+/g, ' ').slice(0, 1500),
  };
})()
`;
