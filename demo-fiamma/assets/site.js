/* Menuet - script du site (horaires en direct, carte, commande à emporter). Aucun cookie, aucun suivi. */
(function () {
  'use strict';
  var dataEl = document.getElementById('resto-data');
  if (!dataEl) return;
  var D;
  try { D = JSON.parse(dataEl.textContent); } catch (e) { return; }

  var TZ = 'Europe/Paris';
  var KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  var NAMES = { mon: 'lundi', tue: 'mardi', wed: 'mercredi', thu: 'jeudi', fri: 'vendredi', sat: 'samedi', sun: 'dimanche' };
  var MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var NBSP = ' ';

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function toMin(hm) { var a = String(hm).split(':'); return Number(a[0]) * 60 + Number(a[1] || 0); }
  function fmt(min) {
    min = ((min % 1440) + 1440) % 1440;
    var h = Math.floor(min / 60), m = min % 60;
    return h + NBSP + 'h' + (m ? NBSP + pad(m) : '');
  }
  function money(n) {
    var r = Math.round(n * 100) / 100;
    return (r % 1 === 0 ? String(r) : r.toFixed(2).replace('.', ',')) + NBSP + '€';
  }
  function dateText(iso) {
    var p = String(iso).split('-');
    var d = Number(p[2]);
    return (d === 1 ? '1er' : d) + ' ' + MONTHS[Number(p[1]) - 1];
  }

  /* ---------- heure de Paris ---------- */
  function now() {
    var parts = {};
    try {
      new Intl.DateTimeFormat('en-GB', {
        timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
      }).formatToParts(new Date()).forEach(function (p) { parts[p.type] = p.value; });
    } catch (e) {
      var l = new Date();
      parts = { year: l.getFullYear(), month: l.getMonth() + 1, day: l.getDate(), hour: l.getHours(), minute: l.getMinutes() };
    }
    var y = Number(parts.year), mo = Number(parts.month), da = Number(parts.day);
    var t = day(y, mo, da);
    t.min = (Number(parts.hour) % 24) * 60 + Number(parts.minute);
    return t;
  }
  function day(y, mo, da) {
    var d = new Date(Date.UTC(y, mo - 1, da));
    return {
      y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, da: d.getUTCDate(), dow: d.getUTCDay(),
      iso: d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate())
    };
  }
  function addDays(t, n) { return day(t.y, t.mo, t.da + n); }

  /* ---------- horaires ---------- */
  function slots(key) { return (D.hours && D.hours[key]) || []; }
  function hasHours() { return KEYS.some(function (k) { return slots(k).length; }); }
  function closureOn(iso) {
    var list = D.closures || [];
    for (var i = 0; i < list.length; i++) {
      var to = list[i].to || list[i].from;
      if (iso >= list[i].from && iso <= to) return list[i];
    }
    return null;
  }
  // intervalles du jour en minutes ; un service qui finit après minuit déborde sur le lendemain
  function intervals(t) {
    var out = [];
    var prev = addDays(t, -1);
    if (!closureOn(prev.iso)) {
      slots(KEYS[prev.dow]).forEach(function (s) {
        var a = toMin(s[0]), b = toMin(s[1]);
        if (b <= a) out.push([a - 1440, b]);
      });
    }
    if (!closureOn(t.iso)) {
      slots(KEYS[t.dow]).forEach(function (s) {
        var a = toMin(s[0]), b = toMin(s[1]);
        if (b <= a) b += 1440;
        out.push([a, b]);
      });
    }
    return out.sort(function (x, y) { return x[0] - y[0]; });
  }
  function currentInterval(t) {
    var list = intervals(t);
    for (var i = 0; i < list.length; i++) if (t.min >= list[i][0] && t.min < list[i][1]) return list[i];
    return null;
  }
  function nextOpening(t) {
    for (var i = 0; i < 21; i++) {
      var d = i === 0 ? t : addDays(t, i);
      if (closureOn(d.iso)) continue;
      var starts = slots(KEYS[d.dow]).map(function (s) { return toMin(s[0]); }).sort(function (a, b) { return a - b; });
      for (var j = 0; j < starts.length; j++) {
        if (i > 0 || starts[j] > t.min) return { offset: i, day: d, min: starts[j] };
      }
    }
    return null;
  }
  function computeStatus() {
    var t = now();
    var cur = currentInterval(t);
    if (cur) {
      if (cur[1] - t.min <= 30) return { cls: 'is-soon', text: 'Ferme bientôt, à ' + fmt(cur[1]) };
      return { cls: 'is-open', text: 'Ouvert jusqu’à ' + fmt(cur[1]) };
    }
    var prefix = closureOn(t.iso) ? 'Fermeture exceptionnelle' : 'Fermé';
    var n = nextOpening(t);
    if (!n) return { cls: 'is-closed', text: prefix };
    var when;
    if (n.offset === 0) when = '';
    else if (n.offset === 1) when = ' demain';
    else if (n.offset < 7) when = ' ' + NAMES[KEYS[n.day.dow]];
    else when = ' le ' + dateText(n.day.iso);
    return { cls: 'is-closed', text: prefix + ', ouvre' + when + ' à ' + fmt(n.min) };
  }
  function updateStatus() {
    if (!hasHours()) return;
    var s = computeStatus();
    $$('[data-status]').forEach(function (el) {
      el.classList.remove('is-open', 'is-soon', 'is-closed');
      el.classList.add(s.cls);
      var txt = $('[data-status-text]', el);
      if (txt) txt.textContent = s.text;
    });
    var t = now();
    $$('tr[data-day]').forEach(function (row) {
      var today = row.getAttribute('data-day') === KEYS[t.dow];
      row.classList.toggle('is-today', today);
      var mark = $('.sr', row);
      if (today && !mark) {
        mark = document.createElement('span');
        mark.className = 'sr';
        mark.textContent = ' (aujourd’hui)';
        row.querySelector('th').appendChild(mark);
      } else if (!today && mark) mark.remove();
    });
    var note = $('[data-closure]');
    if (note) {
      var msg = '';
      var limit = addDays(t, 21).iso;
      (D.closures || []).forEach(function (c) {
        if (msg) return;
        var to = c.to || c.from;
        var label = c.label || 'Fermeture exceptionnelle';
        if (t.iso >= c.from && t.iso <= to) msg = label + (to !== c.from ? ' jusqu’au ' + dateText(to) + ' inclus' : ' aujourd’hui');
        else if (c.from > t.iso && c.from <= limit) msg = label + (to !== c.from ? ' du ' + dateText(c.from) + ' au ' + dateText(to) : ' le ' + dateText(c.from));
      });
      note.textContent = msg;
      note.hidden = !msg;
    }
    $$('[data-year]').forEach(function (el) { el.textContent = t.y; });
  }
  updateStatus();
  setInterval(updateStatus, 60000);

  /* ---------- dialogues ---------- */
  function openDialog(dlg) {
    if (!dlg) return;
    if (typeof dlg.showModal === 'function') { if (!dlg.open) dlg.showModal(); }
    else dlg.setAttribute('open', '');
  }
  function closeDialog(dlg) {
    if (!dlg) return;
    if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open');
  }
  $$('dialog').forEach(function (dlg) {
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg || (e.target.closest && e.target.closest('[data-close]'))) closeDialog(dlg);
    });
  });

  /* ---------- mode démo / aperçu : rien n'est envoyé ---------- */
  var demoDlg = $('#demo-dialog');
  var DEMO_TEXT = {
    call: 'Ce bouton appelle le restaurant en un geste, depuis n’importe quel téléphone.',
    maps: 'Ce bouton ouvre l’itinéraire jusqu’au restaurant dans Google Maps ou Plans.',
    mail: 'Ce lien ouvre un e-mail déjà adressé au restaurant.',
    social: 'Ce lien ouvre la page Instagram, Facebook ou TikTok du restaurant.'
  };
  function showDemo(kind, message) {
    if (!demoDlg) return;
    var tail = D.mode === 'demo' ? ' Ici, le restaurant et ses numéros sont fictifs.'
      : D.mode === 'preview' ? ' Ici, c’est la prévisualisation de l’Atelier\u00a0: rien n’est envoyé.'
      : ' Ici, c’est un aperçu\u00a0: rien n’est envoyé.';
    var text = DEMO_TEXT[kind] || '';
    if (kind === 'order') {
      var where = { whatsapp: 'sur le WhatsApp du restaurant', sms: 'par SMS au restaurant', phone: 'par téléphone' }[D.order.channel];
      text = 'La commande part ' + where + ', déjà rédigée. Voici le message reçu\u00a0:';
    }
    $('[data-demo-text]', demoDlg).textContent = text + (kind === 'order' ? '' : tail);
    var pre = $('[data-demo-message]', demoDlg);
    pre.hidden = !message;
    pre.textContent = message ? message + '\n\n(' + tail.trim() + ')' : '';
    openDialog(demoDlg);
  }
  document.addEventListener('click', function (e) {
    var c = e.target.closest && e.target.closest('[data-contact]');
    if (c && D.mode !== 'final') {
      e.preventDefault();
      showDemo(c.getAttribute('data-contact'));
    }
  });

  /* ---------- catégories de la carte : onglet actif ---------- */
  var nav = $('.menu-nav');
  if (nav) {
    var cats = $$('.menu-cat');
    var current = null;
    var ticking = false;
    var spy = function () {
      ticking = false;
      var active = null;
      cats.forEach(function (c) { if (c.getBoundingClientRect().top <= 160) active = c; });
      if (active === current) return;
      current = active;
      $$('a', nav).forEach(function (a) {
        var on = !!active && a.getAttribute('href') === '#' + active.id;
        if (on) {
          a.setAttribute('aria-current', 'true');
          nav.scrollTo({ left: Math.max(0, a.offsetLeft - 18), behavior: 'smooth' });
        } else a.removeAttribute('aria-current');
      });
    };
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(spy); } }, { passive: true });
    spy();
  }

  /* ---------- commande à emporter ---------- */
  var O = D.order;
  var cartDlg = $('#cart-dialog');
  if (!O || !cartDlg) return;

  var KEY = 'menuet-commande:' + location.pathname;
  var cart = {};
  try { cart = JSON.parse(sessionStorage.getItem(KEY) || '{}') || {}; } catch (e) { cart = {}; }
  Object.keys(cart).forEach(function (id) { if (!O.items[id] || !(cart[id] > 0)) delete cart[id]; });

  var pill = $('.cart-pill');
  var form = $('[data-cart-form]', cartDlg);
  var lines = $('[data-cart-lines]', cartDlg);
  var empty = $('[data-cart-empty]', cartDlg);
  var errorBox = $('[data-cart-error]', cartDlg);
  var sendBtn = $('[data-cart-send]', cartDlg);
  var timeSel = form.elements.time;
  var hoursHelp = $('[data-cart-hours]', cartDlg);

  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) { /* stockage indisponible : la commande reste en mémoire */ } }
  function ids() { return Object.keys(O.items).filter(function (id) { return cart[id] > 0; }); }
  function count() { return ids().reduce(function (n, id) { return n + cart[id]; }, 0); }
  function total() { return ids().reduce(function (s, id) { return s + cart[id] * O.items[id].p; }, 0); }

  function qtyControl(id, name) {
    return '<span class="qty"><button type="button" data-remove="' + id + '" aria-label="Un de moins\u00a0: ' + name + '">' +
      '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg></button>' +
      '<output>' + cart[id] + '</output>' +
      '<button type="button" data-add="' + id + '" aria-label="Un de plus\u00a0: ' + name + '">' +
      '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button></span>';
  }
  function escHtml(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function render() {
    $$('[data-order-for]').forEach(function (box) {
      var id = box.getAttribute('data-order-for');
      var q = cart[id] || 0;
      $('.add', box).hidden = q > 0;
      $('.qty', box).hidden = q === 0;
      $('[data-qty]', box).textContent = q;
    });
    var n = count();
    var tot = money(total());
    if (pill) {
      pill.hidden = n === 0;
      $('[data-cart-count]', pill).textContent = '(' + n + ')';
    }
    $$('[data-cart-total]').forEach(function (el) { el.textContent = tot; });
    lines.innerHTML = ids().map(function (id) {
      var it = O.items[id];
      var name = escHtml(it.n);
      return '<li class="cart-line"><span class="cart-line-name">' + name + '</span>' +
        '<span class="cart-line-price">' + money(cart[id] * it.p) + '</span>' + qtyControl(id, name) + '</li>';
    }).join('');
    empty.hidden = n > 0;
  }

  function change(id, delta, origin) {
    if (!O.items[id]) return;
    cart[id] = Math.max(0, (cart[id] || 0) + delta);
    if (!cart[id]) delete cart[id];
    save();
    render();
    // garde le focus sur un bouton visible
    if (origin && origin.offsetParent === null) {
      var box = document.querySelector('[data-order-for="' + id + '"]');
      var target = box && (cart[id] ? $('.qty [data-add]', box) : $('.add', box));
      if (origin.closest('#cart-dialog')) target = $('[data-add="' + id + '"]', lines) || $('#cart-name');
      if (target) target.focus();
    }
  }

  function fillTimes() {
    var t = now();
    var list = intervals(t);
    var earliest = Math.ceil((t.min + O.minDelay) / 15) * 15;
    var opts = [];
    list.forEach(function (iv) {
      for (var m = Math.max(iv[0] + 15, earliest); m <= iv[1] - 15; m += 15) opts.push(m);
    });
    var cur = currentInterval(t);
    timeSel.innerHTML = '';
    if (opts.length) {
      if (cur && cur[1] - 15 >= earliest) {
        timeSel.add(new Option('Dès que possible (environ ' + O.minDelay + NBSP + 'min)', 'asap'));
      }
      opts.forEach(function (m) { timeSel.add(new Option(fmt(m), fmt(m))); });
      hoursHelp.textContent = 'Retrait possible jusqu’à ' + fmt(list[list.length - 1][1] - 15) + ' aujourd’hui.';
      sendBtn.disabled = false;
    } else {
      var opt = new Option('Pas de retrait possible aujourd’hui', '');
      opt.disabled = true;
      timeSel.add(opt);
      hoursHelp.textContent = 'Commandes aux heures d’ouverture. ' + computeStatus().text + '.';
      sendBtn.disabled = true;
    }
  }

  function message() {
    var out = ['Bonjour ' + D.name + ', je voudrais commander à emporter\u00a0:'];
    ids().forEach(function (id) {
      out.push('• ' + cart[id] + ' × ' + O.items[id].n + ' (' + money(cart[id] * O.items[id].p) + ')');
    });
    out.push('Total\u00a0: ' + money(total()));
    var time = timeSel.value === 'asap' ? 'dès que possible' : timeSel.value;
    out.push('Retrait\u00a0: ' + time);
    out.push('Prénom\u00a0: ' + form.elements.name.value.trim());
    var note = form.elements.note.value.trim();
    if (note) out.push('Remarque\u00a0: ' + note);
    return out.join('\n');
  }

  function fail(text, field) {
    errorBox.textContent = text;
    errorBox.hidden = false;
    if (field) field.focus();
  }

  function openCart() {
    errorBox.hidden = true;
    fillTimes();
    render();
    openDialog(cartDlg);
  }

  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    var a = e.target.closest('[data-add]');
    if (a) { change(a.getAttribute('data-add'), 1, a); return; }
    var r = e.target.closest('[data-remove]');
    if (r) { change(r.getAttribute('data-remove'), -1, r); return; }
    var o = e.target.closest('[data-open-cart]');
    if (o && count() > 0) { e.preventDefault(); openCart(); }
  });

  form.addEventListener('submit', function (e) { e.preventDefault(); sendBtn.click(); });

  sendBtn.addEventListener('click', function () {
    errorBox.hidden = true;
    if (!count()) return fail('Ajoutez au moins un plat depuis la carte.');
    if (!timeSel.value) return fail('Choisissez une heure de retrait.', timeSel);
    if (!form.elements.name.value.trim()) return fail('Indiquez votre prénom pour que le restaurant reconnaisse votre commande.', form.elements.name);
    var msg = message();
    if (D.mode !== 'final') { showDemo('order', msg); return; }
    if (O.channel === 'whatsapp') {
      var url = 'https://wa.me/' + O.to + '?text=' + encodeURIComponent(msg);
      var win = window.open(url, '_blank', 'noopener');
      if (!win) window.location.href = url;
    } else if (O.channel === 'sms') {
      window.location.href = 'sms:' + O.to + '?&body=' + encodeURIComponent(msg);
    } else {
      window.location.href = 'tel:' + O.to;
    }
  });

  render();
})();
