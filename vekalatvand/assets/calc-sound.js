/* وکالت‌وند — موتور صدای دوحالته حسابگر (خوب/طبیعی + مصنوعی/مینی‌رب) */
(function () {
  'use strict';
  var LS_KEY = 'vv-sound-mode';
  // modes: 'good' (خوب/طبیعی) -> 'minirap' (مصنوعی/مینی‌رب) -> 'off' (بی‌صدا)
  var MODE_LABEL = {
    good: { icon: 'fa-volume-high', text: 'صدا: خوب (طبیعی)' },
    minirap: { icon: 'fa-music', text: 'صدا: مصنوعی (مینی‌رب)' },
    off: { icon: 'fa-volume-xmark', text: 'بی‌صدا' }
  };
  // فرکانس پایه هر دکمه — حس MPC / مینی‌رب (هر عدد نت خودش را دارد)
  var KEY_FREQ = { 1: 1750, 2: 1850, 3: 1950, 4: 2050, 5: 2150, 6: 2250, 7: 2350, 8: 2450, 9: 2550, 0: 1650, C: 900, B: 2900, T: 2400, Y: 1500 };

  var mode = 'good';
  try {
    var saved = localStorage.getItem(LS_KEY);
    if (saved === 'good' || saved === 'minirap' || saved === 'off') mode = saved;
  } catch (e) {}
  var ac = null, pressCount = 0;

  function ctx() {
    try {
      if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      return ac;
    } catch (e) { return null; }
  }
  function noiseBuf(c, ms) {
    var len = Math.max(1, Math.floor(c.sampleRate * ms / 1000));
    var buf = c.createBuffer(1, len, c.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    return buf;
  }
  // --- حالت ۱: خوب / طبیعی — کلیک واقعی ماشین‌حساب ---
  function playGood(c, t, key) {
    // بدنه چوبی کوتاه (thump)
    var o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(key === 'C' ? 150 : 185, t);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.06);
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.09);
    // کلیک تیز واقعی
    var n = c.createBufferSource(); n.buffer = noiseBuf(c, 18);
    var hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2800;
    var ng = c.createGain();
    ng.gain.setValueAtTime(0.20, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
    n.connect(hp); hp.connect(ng); ng.connect(c.destination); n.start(t);
    // برق فلزی خیلی کوتاه برای حس «خوب»
    var o2 = c.createOscillator(), g2 = c.createGain();
    o2.type = 'triangle';
    o2.frequency.setValueAtTime(key === 'B' ? 3200 : 2600, t);
    g2.gain.setValueAtTime(0.05, t);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    o2.connect(g2); g2.connect(c.destination); o2.start(t); o2.stop(t + 0.04);
  }
  // --- حالت ۲: مصنوعی / مینی‌رب — کیت هیپ‌هاپ کوچک ---
  function playMiniRap(c, t, key) {
    pressCount++;
    var base = KEY_FREQ[key] || 2000;
    // 808 ساب (امضای مینی‌رب)
    var sub = c.createOscillator(), sg = c.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(Math.max(55, base / 32), t);
    sub.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    sg.gain.setValueAtTime(0.30, t);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    sub.connect(sg); sg.connect(c.destination); sub.start(t); sub.stop(t + 0.18);
    // اسنپ/کلپ رپی
    var sn = c.createBufferSource(); sn.buffer = noiseBuf(c, 60);
    var bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 1.1;
    var sng = c.createGain();
    sng.gain.setValueAtTime(0.16, t);
    sng.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    sn.connect(bp); bp.connect(sng); sng.connect(c.destination); sn.start(t);
    // هت تیز + بلیپ ملودیک هر دکمه
    var hat = c.createBufferSource(); hat.buffer = noiseBuf(c, 25);
    var hhp = c.createBiquadFilter(); hhp.type = 'highpass'; hhp.frequency.value = 7500;
    var hg = c.createGain();
    hg.gain.setValueAtTime(0.10, t + 0.015);
    hg.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    hat.connect(hhp); hhp.connect(hg); hg.connect(c.destination); hat.start(t + 0.015);
    var bl = c.createOscillator(), bg = c.createGain();
    bl.type = 'square';
    bl.frequency.setValueAtTime(base, t);
    bl.frequency.exponentialRampToValueAtTime(Math.max(300, base * 0.6), t + 0.07);
    bg.gain.setValueAtTime(0.045, t);
    bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    bl.connect(bg); bg.connect(c.destination); bl.start(t); bl.stop(t + 0.09);
    // هر ۴ ضربه یک کیک اضافه (گرُو مینی‌رب)
    if (pressCount % 4 === 0) {
      var k = c.createOscillator(), kg = c.createGain();
      k.type = 'sine';
      k.frequency.setValueAtTime(120, t);
      k.frequency.exponentialRampToValueAtTime(45, t + 0.1);
      kg.gain.setValueAtTime(0.25, t);
      kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      k.connect(kg); kg.connect(c.destination); k.start(t); k.stop(t + 0.13);
    }
  }
  function play(key) {
    if (mode === 'off') return;
    var c = ctx(); if (!c) return;
    try {
      var t = c.currentTime;
      if (mode === 'good') playGood(c, t, String(key));
      else playMiniRap(c, t, String(key));
    } catch (e) {}
  }
  function paintButtons() {
    var label = MODE_LABEL[mode] || MODE_LABEL.good;
    document.querySelectorAll('[data-vv-sound-btn]').forEach(function (b) {
      b.innerHTML = '<i class="fa-solid ' + label.icon + '"></i> ' + label.text;
      b.classList.toggle('on', mode !== 'off');
    });
  }
  function nextMode() {
    mode = mode === 'good' ? 'minirap' : mode === 'minirap' ? 'off' : 'good';
    try { localStorage.setItem(LS_KEY, mode); } catch (e) {}
    paintButtons();
    if (mode !== 'off') play('T');
    return mode;
  }
  function setMode(m) {
    if (m === 'good' || m === 'minirap' || m === 'off') {
      mode = m;
      try { localStorage.setItem(LS_KEY, mode); } catch (e) {}
      paintButtons();
    }
  }
  // سازگار با کدهای قدیمی صفحه
  window.VVSound = {
    play: play, beep: play, kbSound: play, clickSnd: function () { play('T'); },
    next: nextMode, toggle: nextMode, setMode: setMode,
    getMode: function () { return mode; },
    isOn: function () { return mode !== 'off'; }
  };
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-vv-sound-btn]') : null;
    if (b) { e.preventDefault(); nextMode(); }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paintButtons);
  else paintButtons();
})();
