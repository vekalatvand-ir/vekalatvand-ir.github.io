/* وکالت‌وند — بروزرسانی خودکار قیمت سکه (ربات هر ۸ ساعت + تلاش زنده در هر بازدید) */
(function () {
  'use strict';
  var CYCLE_HOURS = 8;
  var LS_KEY = 'vv-coin-price';
  var JSON_PATHS = [
    'assets/coin-price.json',
    '../assets/coin-price.json',
    '../../assets/coin-price.json',
    '../../../assets/coin-price.json',
    '/assets/coin-price.json',
    '/vekalatvand/assets/coin-price.json'
  ];
  function fa(n) { try { return Math.round(n).toLocaleString('fa-IR'); } catch (e) { return String(Math.round(n)); } }
  function faDate(iso) {
    try {
      var d = iso && iso.indexOf(' ') > -1 ? new Date(iso.replace(' ', 'T') + ':00+03:30') : new Date(iso + 'T00:00:00');
      return d.toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) { return iso; }
  }
  function hoursSince(meta) {
    try {
      var base = meta.updated_ts ? meta.updated_ts * 1000
        : meta.updated_at_tehran ? Date.parse(meta.updated_at_tehran.replace(' ', 'T') + ':00+03:30')
        : Date.parse(meta.updated_at + 'T00:00:00+03:30');
      return (Date.now() - base) / 3600000;
    } catch (e) { return 99; }
  }
  function loadJSON() {
    var tryNext = function (i) {
      if (i >= JSON_PATHS.length) return Promise.resolve(null);
      return fetch(JSON_PATHS[i], { cache: 'no-store' }).then(function (r) {
        if (!r.ok) throw 0;
        return r.json();
      }).catch(function () { return tryNext(i + 1); });
    };
    return tryNext(0);
  }
  function loadCache() {
    try {
      var o = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      if (o && o.price_toman > 10000000) return o;
    } catch (e) {}
    return null;
  }
  // تلاش زنده (best-effort) از طریق TGJU + پروکسی CORS — اگر نشد همان JSON مبناست
  function fetchVia(url, ms) {
    var ctrl = new AbortController();
    var to = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, ms || 7000);
    return fetch(url, { signal: ctrl.signal }).then(function (r) {
      if (!r.ok) throw 0;
      return r.text();
    }).finally(function () { clearTimeout(to); });
  }
  function parseToman(html) {
    var pats = [
      /data-col="info\.last_trade\.PDrCotVal">([\d,]+)</,
      /PDrCotVal[^0-9]*([\d,]{5,})</,
      /"pdrCotVal"\s*:\s*"([\d,]+)"/
    ];
    for (var i = 0; i < pats.length; i++) {
      var m = html.match(pats[i]);
      if (m) {
        var rial = parseInt(m[1].replace(/,/g, ''), 10);
        var toman = Math.round(rial / 10);
        if (toman > 20000000 && toman < 1000000000) return toman;
      }
    }
    return null;
  }
  function tryLive() {
    var target = encodeURIComponent('https://www.tgju.org/profile/sekee');
    return fetchVia('https://api.allorigins.win/raw?url=' + target, 7000)
      .then(function (html) { return parseToman(html); })
      .then(function (t) {
        if (t) return t;
        return fetchVia('https://corsproxy.io/?url=' + target, 7000).then(function (html) { return parseToman(html); });
      })
      .catch(function () { return null; });
  }
  function applyPrice(toman, meta) {
    if (!(toman > 0)) return;
    // ورودی‌های هر دو حسابگر
    var ids = ['coinPrice', 'm4cPrice'];
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        if (el.tagName === 'INPUT') { el.value = toman; el.dispatchEvent(new Event('input', { bubbles: true })); }
        else { el.textContent = String(toman); }
      }
    });
    // متغیرهای داخلی صفحه محاسبه نرخ روز (اگر لود شده)
    try {
      if (typeof window !== 'undefined' && window.__VV_SET_COIN) window.__VV_SET_COIN(toman);
    } catch (e) {}
    if (typeof coinCalc === 'function') { try { coinCalc(); } catch (e) {} }
    // بج تاریخ
    var txt = 'قیمت خودکار سکه: ' + fa(toman) + ' تومان' + (meta && (meta.updated_at_tehran || meta.updated_at) ? ' — بروزرسانی: ' + faDate(meta.updated_at_tehran || meta.updated_at) : '') + ' (خودکار هر ۸ ساعت)';
    document.querySelectorAll('[data-coin-date]').forEach(function (el) { el.textContent = txt; });
  }
  function paintBadge(meta, live) {
    var txt;
    if (meta && meta.price_toman) {
      txt = 'قیمت خودکار سکه: ' + fa(meta.price_toman) + ' تومان — بروزرسانی: ' + faDate(meta.updated_at_tehran || meta.updated_at) + ' (خودکار هر ۸ ساعت)' + (live ? ' + نرخ زنده' : '');
    } else txt = 'قیمت سکه به‌صورت خودکار هر ۸ ساعت به‌روز می‌شود';
    document.querySelectorAll('[data-coin-date]').forEach(function (el) { el.textContent = txt; });
  }
  function init() {
    loadJSON().then(function (meta) {
      var cache = loadCache();
      var base = meta && meta.price_toman ? meta : (cache ? { price_toman: cache.price_toman, updated_at: cache.updated_at, updated_at_tehran: cache.updated_at_tehran, updated_ts: cache.ts ? Math.floor(cache.ts / 1000) : null } : null);
      if (!base) { paintBadge(null); return; }
      // اگر کش زنده‌تر از فایل است (کمتر از ۸ ساعت)، کش را مبنا بگذار
      var useCache = false;
      try {
        useCache = !!(cache && cache.ts && (Date.now() - cache.ts) < CYCLE_HOURS * 3600000 && (!meta || !meta.updated_ts || cache.ts > meta.updated_ts * 1000));
      } catch (e) {}
      var active = useCache ? { price_toman: cache.price_toman, updated_at: cache.updated_at, updated_at_tehran: cache.updated_at_tehran } : base;
      applyPrice(active.price_toman, active);
      paintBadge(active, false);
      // در هر بازدید یک تلاش زنده بکن (بدون بلاک کردن صفحه)؛ اگر نشد، همان قیمت ذخیره‌شده می‌ماند
      tryLive().then(function (live) {
        if (live && Math.abs(live - active.price_toman) / active.price_toman > 0.001) {
          var today = new Date().toISOString().slice(0, 10);
          try { localStorage.setItem(LS_KEY, JSON.stringify({ price_toman: live, updated_at: today, ts: Date.now() })); } catch (e) {}
          applyPrice(live, { updated_at: today });
          paintBadge({ price_toman: live, updated_at: today }, true);
        }
      });
    });
  }
  window.VVCoin = { refresh: init, apply: applyPrice, CYCLE_HOURS: CYCLE_HOURS };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
