// Tableau de bord. Tout le contenu venant des utilisateurs est inséré avec textContent (jamais innerHTML).
(function () {
  'use strict';

  var CAT = {
    order_status: 'Suivi de commande', order_change: 'Modification', cancellation: 'Annulation',
    return_refund: 'Retour / remboursement', product_question: 'Question produit', complaint: 'Réclamation', other: 'Autre',
  };
  var ORDER_STATUS = {
    pending: 'En attente', paid: 'Payée', preparing: 'En préparation', shipped: 'Expédiée',
    delivered: 'Livrée', cancelled: 'Annulée', refunded: 'Remboursée',
  };
  var MSG_STATUS = { new: 'Nouveau', analyzed: 'À traiter', replied: 'Traité', archived: 'Archivé' };
  var URGENCY = { high: 'Urgent', normal: 'Normal', low: 'Faible' };
  var CHANNEL = { email: 'E-mail', chat: 'Chat', instagram: 'Instagram', facebook: 'Facebook', whatsapp: 'WhatsApp', other: 'Autre' };
  var langNames = (function () { try { return new Intl.DisplayNames(['fr'], { type: 'language' }); } catch (e) { return null; } })();
  function langName(code) {
    if (!code || code === 'und') return 'Langue inconnue';
    try { var n = langNames && langNames.of(code); return n ? n.charAt(0).toUpperCase() + n.slice(1) : code; } catch (e) { return code; }
  }

  var state = { me: null, csrf: '', view: 'dashboard', selected: null, msgFilter: 'open', catFilter: '', orderQuery: '', orderStatus: '' };
  var rootView = document.getElementById('view');

  // ---------- Outils ----------
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el) {
    for (var i = 1; i < arguments.length; i++) {
      var child = arguments[i];
      if (child == null || child === false) continue;
      if (Array.isArray(child)) child.forEach(function (c) { append(el, c); });
      else el.appendChild(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(String(child)) : child);
    }
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function chip(text, kind) { return h('span', { class: 'chip' + (kind ? ' chip-' + kind : ''), text: text }); }
  function fmtDate(s) {
    if (!s) return '';
    var d = new Date(s.replace(' ', 'T') + (s.length === 19 ? 'Z' : ''));
    return isNaN(d) ? s : d.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  function money(v, cur) {
    try { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: cur || 'EUR' }).format(v || 0); } catch (e) { return (v || 0) + ' ' + cur; }
  }
  var toastTimer;
  function toast(text) {
    var old = document.querySelector('.toast');
    if (old) old.remove();
    var t = h('div', { class: 'toast', role: 'status', text: text });
    document.body.appendChild(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.remove(); }, 3500);
  }

  async function api(method, url, body) {
    var opts = { method: method, headers: {} };
    if (body !== undefined) { opts.headers['content-type'] = 'application/json'; opts.body = JSON.stringify(body); }
    if (method !== 'GET') opts.headers['x-csrf-token'] = state.csrf;
    var res = await fetch('/api' + url, opts);
    if (res.status === 401) { location.href = '/login'; throw new Error('Connexion requise.'); }
    var json = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(json.error || 'Erreur ' + res.status);
    return json;
  }
  function guard(fn) {
    return async function (e) {
      var btn = e && e.currentTarget && e.currentTarget.tagName === 'BUTTON' ? e.currentTarget : null;
      if (btn) btn.disabled = true;
      try { await fn(e); } catch (err) { toast(err.message); } finally { if (btn) btn.disabled = false; }
    };
  }

  // ---------- Navigation ----------
  document.querySelectorAll('[data-view]').forEach(function (b) {
    b.addEventListener('click', function () { go(b.dataset.view); });
  });
  document.getElementById('logout').addEventListener('click', guard(async function () {
    await api('POST', '/auth/logout'); location.href = '/';
  }));
  window.addEventListener('hashchange', function () { route(); });

  function go(name, id) { location.hash = id ? name + '/' + id : name; }
  function route() {
    var parts = location.hash.replace('#', '').split('/');
    state.view = ['dashboard', 'inbox', 'orders', 'settings'].indexOf(parts[0]) > -1 ? parts[0] : 'dashboard';
    state.selected = parts[1] ? Number(parts[1]) : null;
    document.querySelectorAll('[data-view]').forEach(function (b) {
      if (b.dataset.view === state.view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    render().catch(function (err) { console.error(err); toast(err.message); });
  }

  async function refreshMe() {
    state.me = await api('GET', '/me');
    state.csrf = state.me.csrfToken;
    var u = state.me.usage;
    document.getElementById('side-store').textContent = state.me.workspace.name + ' · ' + state.me.plan.name;
    document.getElementById('side-usage').textContent = u.aiCalls + ' / ' + u.limit + ' analyses ce mois-ci';
    document.getElementById('side-usage-bar').style.width = Math.min(100, (u.aiCalls / u.limit) * 100) + '%';
  }

  // Chaque rendu se construit hors de la page, puis remplace l'ancien d'un coup.
  // Un rendu plus récent annule les précédents (évite les affichages mélangés).
  var renderSeq = 0;
  async function render() {
    var seq = ++renderSeq;
    var target = document.createElement('div');
    if (state.view === 'dashboard') await renderDashboard(target);
    else if (state.view === 'inbox') await renderInbox(target);
    else if (state.view === 'orders') await renderOrders(target);
    else await renderSettings(target);
    if (seq !== renderSeq) return;
    clear(rootView);
    while (target.firstChild) rootView.appendChild(target.firstChild);
    var s = await api('GET', '/stats');
    var badge = document.getElementById('nav-open');
    badge.textContent = s.open; badge.classList.toggle('hidden', !s.open);
  }

  // ---------- Tableau de bord ----------
  async function renderDashboard(view) {
    var s = await api('GET', '/stats');
    var first = state.me.user.name ? ', ' + state.me.user.name : '';
    append(view, h('div', { class: 'page-head' }, h('h1', { text: 'Bonjour' + first }),
      h('button', { class: 'btn btn-primary', type: 'button', onclick: openNewMessage }, 'Nouveau message')));

    if (state.me.ai === 'demo') {
      append(view, h('p', { class: 'alert alert-info' }, 'Mode démonstration : les analyses utilisent des règles simples, sans IA réelle. Les réponses de l\'IA Claude seront plus précises une fois la clé API configurée.'));
    }

    if (!s.total) {
      append(view, h('div', { class: 'panel onboarding' },
        h('h2', { text: 'Bien démarrer en 3 étapes' }),
        h('ol', null,
          h('li', null, h('a', { href: '#settings', text: 'Décrivez votre boutique' }), ' : délais de livraison, retours, ton des réponses.'),
          h('li', null, h('a', { href: '#orders', text: 'Ajoutez quelques commandes' }), ' (ou importez un fichier CSV).'),
          h('li', null, 'Collez votre premier message client.')),
        h('div', { class: 'toolbar' },
          h('button', { class: 'btn btn-primary', type: 'button', onclick: openNewMessage }, 'Ajouter un message'),
          h('button', { class: 'btn btn-ghost', type: 'button', onclick: guard(loadSamples) }, 'Charger des exemples')),
        h('p', { class: 'hint', text: 'Les exemples créent 4 commandes et 5 messages fictifs (5 analyses de votre quota).' })));
    }

    append(view, h('div', { class: 'stats' },
      stat(s.open, 'Messages à traiter'),
      stat(s.urgent, 'Urgents'),
      stat(s.actions, 'Actions sur commande'),
      stat(s.ordersToShip, 'Commandes à expédier')));

    var cats = h('div', { class: 'bars' });
    var max = Math.max.apply(null, s.byCategory.map(function (c) { return c.n; }).concat([1]));
    s.byCategory.forEach(function (c) {
      var fill = h('div', { class: 'bar-fill' });
      fill.style.width = (c.n / max) * 100 + '%';
      append(cats, h('div', { class: 'bar-row' }, h('span', { text: CAT[c.category] || c.category }), h('div', { class: 'bar-track' }, fill), h('strong', { text: c.n })));
    });
    append(view, h('div', { class: 'grid-2' },
      h('div', { class: 'panel' }, h('h2', { text: 'Types de demandes' }), s.byCategory.length ? cats : h('p', { class: 'muted', text: 'Aucune donnée pour l\'instant.' })),
      h('div', { class: 'panel' }, h('h2', { text: 'Ces 30 derniers jours' }),
        h('p', null, h('strong', { text: s.replied30 }), s.replied30 > 1 ? ' messages traités' : ' message traité'),
        h('p', null, h('strong', { text: '≈ ' + s.minutesSavedEstimate + ' min' }), ' gagnées ', h('span', { class: 'muted small', text: '(estimation : 4 min par réponse préparée)' })),
        h('p', { class: 'muted small' }, 'Langues : ', s.byLanguage.length ? s.byLanguage.map(function (l) { return langName(l.language) + ' (' + l.n + ')'; }).join(', ') : '–'))));
  }
  function stat(v, label) { return h('div', { class: 'stat' }, h('div', { class: 'value', text: v }), h('div', { class: 'label', text: label })); }

  // ---------- Messages ----------
  async function renderInbox(view) {
    var statusSel = h('select', { 'aria-label': 'Filtrer par statut', onchange: function (e) { state.msgFilter = e.target.value; render(); } },
      opt('open', 'À traiter'), opt('replied', 'Traités'), opt('archived', 'Archivés'), opt('', 'Tous'));
    statusSel.value = state.msgFilter;
    var catSel = h('select', { 'aria-label': 'Filtrer par catégorie', onchange: function (e) { state.catFilter = e.target.value; render(); } },
      opt('', 'Toutes les catégories'), Object.keys(CAT).map(function (k) { return opt(k, CAT[k]); }));
    catSel.value = state.catFilter;
    append(view, h('div', { class: 'page-head' }, h('h1', { text: 'Messages' }),
      h('div', { class: 'toolbar' }, statusSel, catSel, h('button', { class: 'btn btn-primary', type: 'button', onclick: openNewMessage }, 'Nouveau message'))));

    var q = '?status=' + encodeURIComponent(state.msgFilter) + '&category=' + encodeURIComponent(state.catFilter);
    var list = (await api('GET', '/messages' + q)).messages;
    if (!list.length) {
      append(view, h('div', { class: 'panel empty' }, h('p', { text: 'Aucun message ici.' }),
        h('button', { class: 'btn btn-primary', type: 'button', onclick: openNewMessage }, 'Ajouter un message')));
      return;
    }
    if (!state.selected || !list.some(function (m) { return m.id === state.selected; })) state.selected = list[0].id;

    var ul = h('ul', { class: 'msg-list', 'aria-label': 'Liste des messages' });
    list.forEach(function (m) {
      ul.appendChild(h('li', { class: 'msg-item' }, h('button', {
        type: 'button', 'aria-current': m.id === state.selected ? 'true' : null,
        onclick: function () { go('inbox', m.id); },
      },
      h('div', { class: 'msg-top' }, h('span', { text: m.customer_name || m.customer_email || 'Client inconnu' }), h('span', { class: 'muted small', text: fmtDate(m.created_at) })),
      h('div', { class: 'msg-preview', text: m.summary || m.subject || m.body }),
      h('div', { class: 'chips' },
        m.urgency === 'high' ? chip('Urgent', 'high') : null,
        m.category ? chip(CAT[m.category], 'cat') : chip(m.ai_error ? 'Analyse échouée' : 'Non analysé'),
        m.needs_action ? chip('Action requise', 'action') : null,
        m.status === 'replied' ? chip('Traité', 'ok') : null))));
    });
    var detail = h('section', { class: 'detail', 'aria-label': 'Détail du message' });
    append(view, h('div', { class: 'inbox' }, ul, detail));
    await renderDetail(detail, state.selected);
  }
  function opt(v, t) { return h('option', { value: v, text: t }); }

  async function renderDetail(box, id) {
    var data = await api('GET', '/messages/' + id);
    var m = data.message;
    var o = data.order;
    var draft = h('textarea', { id: 'draft', rows: 10, maxlength: 6000, 'aria-label': 'Brouillon de réponse' });
    draft.value = m.draft_reply || '';

    append(box,
      h('h2', { text: m.subject || 'Message de ' + (m.customer_name || m.customer_email || 'client inconnu') }),
      h('p', { class: 'muted small' }, [m.customer_name, m.customer_email, CHANNEL[m.channel], fmtDate(m.created_at), MSG_STATUS[m.status]].filter(Boolean).join(' · ')),
      h('div', { class: 'chips' },
        m.urgency ? chip(URGENCY[m.urgency], m.urgency === 'high' ? 'high' : null) : null,
        m.category ? chip(CAT[m.category], 'cat') : null,
        m.needs_action ? chip('Action requise', 'action') : null,
        m.language ? chip(langName(m.language)) : null,
        m.sentiment === 'negative' ? chip('Client mécontent', 'high') : null,
        m.confidence ? chip('Confiance : ' + ({ low: 'faible', medium: 'moyenne', high: 'élevée' }[m.confidence]), m.confidence === 'low' ? 'action' : null) : null),
      m.ai_error ? h('p', { class: 'alert alert-error' }, 'L\'analyse a échoué : ' + m.ai_error + ' (aucune analyse décomptée).') : null,
      m.summary ? h('p', { class: 'summary', text: m.summary }) : null,
      m.action_reason ? h('p', { class: 'alert alert-info' }, h('strong', { text: 'À faire : ' }), m.action_reason) : null,
      m.missing_info.length ? h('div', { class: 'alert alert-info' }, h('strong', { text: 'Informations manquantes pour bien répondre :' }),
        h('ul', null, m.missing_info.map(function (x) { return h('li', { text: x }); }))) : null,
      h('div', { class: 'original', text: m.body }),
      o ? orderCard(o) : linkOrderForm(m),
      h('label', { for: 'draft', text: 'Réponse proposée' }), draft,
      h('p', { class: 'hint', text: 'Relisez et modifiez avant d\'envoyer. Rien n\'est envoyé automatiquement.' }),
      h('div', { class: 'detail-actions' },
        h('button', { class: 'btn btn-primary', type: 'button', onclick: guard(async function () {
          await copy(draft.value);
          await api('PUT', '/messages/' + m.id, { draft_reply: draft.value, status: 'replied' });
          toast('Réponse copiée et message marqué comme traité.');
          render();
        }) }, 'Copier et marquer traité'),
        h('button', { class: 'btn btn-ghost', type: 'button', onclick: guard(async function () {
          await api('PUT', '/messages/' + m.id, { draft_reply: draft.value }); toast('Brouillon enregistré.');
        }) }, 'Enregistrer'),
        h('button', { class: 'btn btn-ghost', type: 'button', onclick: guard(async function () {
          await api('POST', '/messages/' + m.id + '/analyze'); await refreshMe(); toast('Message analysé.'); render();
        }) }, m.analyzed_at ? 'Réanalyser' : 'Analyser'),
        m.status !== 'archived' ? h('button', { class: 'btn btn-ghost', type: 'button', onclick: guard(async function () {
          await api('PUT', '/messages/' + m.id, { status: 'archived' }); toast('Message archivé.'); render();
        }) }, 'Archiver') : h('button', { class: 'btn btn-ghost', type: 'button', onclick: guard(async function () {
          await api('PUT', '/messages/' + m.id, { status: 'analyzed' }); toast('Message rouvert.'); render();
        }) }, 'Rouvrir'),
        h('button', { class: 'btn btn-danger', type: 'button', onclick: guard(async function () {
          if (!confirm('Supprimer définitivement ce message ?')) return;
          await api('DELETE', '/messages/' + m.id); state.selected = null; toast('Message supprimé.'); go('inbox');
        }) }, 'Supprimer')));
  }

  function orderCard(o) {
    return h('div', { class: 'order-card' }, h('strong', { text: 'Commande ' + o.order_number }),
      h('dl', null,
        h('dt', { text: 'Statut' }), h('dd', { text: ORDER_STATUS[o.status] || o.status }),
        h('dt', { text: 'Client' }), h('dd', { text: [o.customer_name, o.customer_email].filter(Boolean).join(' · ') || '–' }),
        h('dt', { text: 'Articles' }), h('dd', { text: o.items || '–' }),
        h('dt', { text: 'Montant' }), h('dd', { text: money(o.total, o.currency) }),
        h('dt', { text: 'Suivi' }), h('dd', { text: [o.carrier, o.tracking_number].filter(Boolean).join(' · ') || 'Pas encore' })));
  }

  function linkOrderForm(m) {
    var input = h('input', { placeholder: 'Numéro de commande', 'aria-label': 'Numéro de commande à relier', value: m.detected_order_number || '' });
    return h('div', { class: 'order-card' },
      h('p', { class: 'muted small', text: m.detected_order_number ? 'Commande « ' + m.detected_order_number + ' » mentionnée mais introuvable dans vos commandes.' : 'Aucune commande reliée.' }),
      h('div', { class: 'toolbar' }, input, h('button', { class: 'btn btn-ghost btn-small', type: 'button', onclick: guard(async function () {
        var num = input.value.trim().replace(/^#/, '');
        if (!num) return;
        var found = (await api('GET', '/orders?q=' + encodeURIComponent(num))).orders.filter(function (x) { return x.order_number === num; })[0];
        if (!found) throw new Error('Commande ' + num + ' introuvable. Ajoutez-la dans « Commandes ».');
        await api('PUT', '/messages/' + m.id, { order_id: found.id });
        toast('Commande reliée. Cliquez sur « Réanalyser » pour mettre à jour la réponse.');
        render();
      }) }, 'Relier')));
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); } catch (e) { /* presse-papiers indisponible : on continue */ }
  }

  var dlgMessage = document.getElementById('dlg-message');
  function openNewMessage() { document.getElementById('form-message').reset(); dlgMessage.showModal(); }
  dlgMessage.addEventListener('close', guard(async function () {
    if (dlgMessage.returnValue !== 'ok') return;
    var d = Object.fromEntries(new FormData(document.getElementById('form-message')));
    if (!d.body.trim()) throw new Error('Le message est vide.');
    toast('Analyse en cours…');
    var r = await api('POST', '/messages', d);
    await refreshMe();
    toast(r.warning || 'Message ajouté et analysé.');
    go('inbox', r.message.id);
  }));

  // ---------- Commandes ----------
  async function renderOrders(view) {
    var search = h('input', { type: 'search', placeholder: 'Numéro, client, e-mail…', 'aria-label': 'Rechercher une commande', value: state.orderQuery });
    var timer;
    search.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { state.orderQuery = search.value; render().then(function () { var s = rootView.querySelector('input[type=search]'); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }); }, 300); });
    var statusSel = h('select', { 'aria-label': 'Filtrer par statut', onchange: function (e) { state.orderStatus = e.target.value; render(); } },
      opt('', 'Tous les statuts'), Object.keys(ORDER_STATUS).map(function (k) { return opt(k, ORDER_STATUS[k]); }));
    statusSel.value = state.orderStatus;
    append(view, h('div', { class: 'page-head' }, h('h1', { text: 'Commandes' }),
      h('div', { class: 'toolbar' }, search, statusSel,
        h('button', { class: 'btn btn-ghost', type: 'button', onclick: function () { document.getElementById('form-import').reset(); document.getElementById('dlg-import').showModal(); } }, 'Importer CSV'),
        h('button', { class: 'btn btn-primary', type: 'button', onclick: function () { openOrder(null); } }, 'Nouvelle commande'))));

    var orders = (await api('GET', '/orders?q=' + encodeURIComponent(state.orderQuery) + '&status=' + state.orderStatus)).orders;
    if (!orders.length) { append(view, h('div', { class: 'panel empty' }, h('p', { text: 'Aucune commande.' }))); return; }
    var tbody = h('tbody');
    orders.forEach(function (o) {
      tbody.appendChild(h('tr', null,
        h('td', null, h('strong', { text: o.order_number })),
        h('td', { text: o.customer_name || o.customer_email || '–' }),
        h('td', null, chip(ORDER_STATUS[o.status] || o.status, ['paid', 'preparing'].indexOf(o.status) > -1 ? 'action' : o.status === 'delivered' ? 'ok' : null)),
        h('td', { text: money(o.total, o.currency) }),
        h('td', { text: o.tracking_number || '–' }),
        h('td', { text: fmtDate(o.created_at) }),
        h('td', null,
          h('button', { class: 'btn btn-ghost btn-small', type: 'button', onclick: function () { openOrder(o); } }, 'Modifier'), ' ',
          h('button', { class: 'btn btn-danger btn-small', type: 'button', onclick: guard(async function () {
            if (!confirm('Supprimer la commande ' + o.order_number + ' ?')) return;
            await api('DELETE', '/orders/' + o.id); toast('Commande supprimée.'); render();
          }) }, 'Supprimer'))));
    });
    append(view, h('div', { class: 'table-wrap' }, h('table', null,
      h('thead', null, h('tr', null, ['N°', 'Client', 'Statut', 'Montant', 'Suivi', 'Date', ''].map(function (t) { return h('th', { scope: 'col', text: t }); }))),
      tbody)));
  }

  var dlgOrder = document.getElementById('dlg-order');
  var formOrder = document.getElementById('form-order');
  function openOrder(o) {
    formOrder.reset();
    formOrder.elements.id.value = o ? o.id : '';
    if (o) ['order_number', 'status', 'customer_name', 'customer_email', 'items', 'currency', 'carrier', 'tracking_number', 'shipping_address', 'notes']
      .forEach(function (k) { formOrder.elements[k].value = o[k] || ''; });
    formOrder.elements.total.value = o ? String(o.total).replace('.', ',') : '';
    if (!o) formOrder.elements.status.value = 'paid';
    dlgOrder.showModal();
  }
  dlgOrder.addEventListener('close', guard(async function () {
    if (dlgOrder.returnValue !== 'ok') return;
    var d = Object.fromEntries(new FormData(formOrder));
    var id = d.id; delete d.id;
    if (!d.order_number.trim()) throw new Error('Le numéro de commande est obligatoire.');
    if (id) await api('PUT', '/orders/' + id, d); else await api('POST', '/orders', d);
    toast('Commande enregistrée.');
    render();
  }));

  var dlgImport = document.getElementById('dlg-import');
  document.getElementById('i-file').addEventListener('change', function (e) {
    var f = e.target.files[0];
    if (!f) return;
    if (f.size > 150000) { toast('Fichier trop volumineux (150 Ko maximum).'); return; }
    f.text().then(function (t) { document.getElementById('i-csv').value = t; });
  });
  dlgImport.addEventListener('close', guard(async function () {
    if (dlgImport.returnValue !== 'ok') return;
    var csv = document.getElementById('i-csv').value;
    if (!csv.trim()) return;
    var r = await api('POST', '/orders/import', { csv: csv });
    toast(r.imported + ' commande(s) importée(s)' + (r.errors.length ? ', ' + r.errors.length + ' ligne(s) ignorée(s) : ' + r.errors[0] : '.'));
    render();
  }));

  // ---------- Réglages ----------
  async function renderSettings(view) {
    var ws = state.me.workspace;
    var form = h('form', { class: 'panel', novalidate: true });
    var tone = h('select', { id: 's-tone', name: 'tone' }, opt('friendly', 'Chaleureux'), opt('formal', 'Formel'), opt('concise', 'Court et direct'));
    tone.value = ws.tone;
    var policies = h('textarea', { id: 's-policies', name: 'policies', rows: 10, maxlength: 8000,
      placeholder: 'Exemples :\n- Expédition sous 48 h ouvrées depuis la France (Colissimo).\n- Livraison 2 à 4 jours en France, 4 à 8 jours en Europe.\n- Retours acceptés 30 jours, articles non portés. Frais de retour à la charge du client.\n- Modification ou annulation possible tant que la commande n\'est pas expédiée.\n- Contact : bonjour@maboutique.fr' });
    policies.value = ws.policies;
    append(form,
      h('h2', { text: 'Votre boutique' }),
      h('div', { class: 'field' }, h('label', { for: 's-name', text: 'Nom de la boutique' }), h('input', { id: 's-name', name: 'name', value: ws.name, maxlength: 100, required: true })),
      h('div', { class: 'field' }, h('label', { for: 's-tone', text: 'Ton des réponses' }), tone),
      h('div', { class: 'field' }, h('label', { for: 's-policies', text: 'Vos politiques et informations utiles' }), policies,
        h('p', { class: 'hint', text: 'L\'IA s\'appuie uniquement sur ce texte et sur la commande liée. Plus il est précis, meilleures sont les réponses.' })),
      h('div', { class: 'field' }, h('label', { for: 's-signature', text: 'Signature' }), h('input', { id: 's-signature', name: 'signature', value: ws.signature, maxlength: 300 })),
      h('button', { class: 'btn btn-primary', type: 'submit' }, 'Enregistrer'));
    form.addEventListener('submit', guard(async function (e) {
      e.preventDefault();
      await api('PUT', '/workspace', Object.fromEntries(new FormData(form)));
      await refreshMe(); toast('Réglages enregistrés.');
    }));

    var u = state.me.usage;
    append(view, h('div', { class: 'page-head' }, h('h1', { text: 'Réglages' })), form,
      h('div', { class: 'panel' }, h('h2', { text: 'Abonnement' }),
        h('p', null, 'Formule ', h('strong', { text: state.me.plan.name }), ' · ' + u.aiCalls + ' / ' + u.limit + ' analyses utilisées ce mois-ci.'),
        h('p', { class: 'muted small', text: 'Les formules payantes ouvriront prochainement. Moteur d\'analyse actuel : ' + (state.me.ai === 'demo' ? 'démonstration (règles simples)' : state.me.ai) + '.' })),
      h('div', { class: 'panel' }, h('h2', { text: 'Vos données' }),
        h('p', { class: 'muted', text: 'Téléchargez toutes vos données, ou supprimez définitivement votre compte.' }),
        h('div', { class: 'toolbar' },
          h('a', { class: 'btn btn-ghost', href: '/api/account/export', download: 'export-donnees.json' }, 'Exporter mes données'),
          h('button', { class: 'btn btn-danger', type: 'button', onclick: guard(async function () {
            var pw = prompt('Cette action est irréversible : toutes les commandes et tous les messages seront supprimés.\nTapez votre mot de passe pour confirmer :');
            if (!pw) return;
            await api('POST', '/account/delete', { password: pw });
            location.href = '/';
          }) }, 'Supprimer mon compte'))));
  }

  // ---------- Exemples ----------
  async function loadSamples() {
    var orders = [
      { order_number: '1041', customer_name: 'Lucas Martin', customer_email: 'lucas.martin@example.com', status: 'delivered', total: 34.9, items: '1 x Bougie Figue', carrier: 'Colissimo', tracking_number: '6A11111111111' },
      { order_number: '1042', customer_name: 'Lena Müller', customer_email: 'lena.mueller@example.de', status: 'preparing', total: 58, items: '2 x Diffuseur Cèdre' },
      { order_number: '1043', customer_name: 'Sofía García', customer_email: 'sofia.garcia@example.es', status: 'shipped', total: 22.5, items: '1 x Savon Lavande', carrier: 'Mondial Relay', tracking_number: 'MR-884512' },
      { order_number: '1044', customer_name: 'Emma Smith', customer_email: 'emma.smith@example.co.uk', status: 'paid', total: 79, items: '1 x Coffret Découverte' },
    ];
    for (var i = 0; i < orders.length; i++) { try { await api('POST', '/orders', orders[i]); } catch (e) { /* déjà présente */ } }
    var messages = [
      { customer_name: 'Sofía García', customer_email: 'sofia.garcia@example.es', subject: 'Mi pedido', body: 'Hola, hice el pedido 1043 hace una semana. ¿Dónde está mi paquete? Gracias.' },
      { customer_name: 'Lena Müller', customer_email: 'lena.mueller@example.de', subject: 'Adresse ändern', body: 'Hallo, ich habe gerade Bestellung #1042 aufgegeben, aber die Lieferadresse ist falsch. Können Sie sie bitte ändern? Neue Adresse: Lindenstraße 4, 10969 Berlin. Danke!' },
      { customer_name: 'Lucas Martin', customer_email: 'lucas.martin@example.com', subject: 'Bougie cassée', body: 'Bonjour, j\'ai reçu ma commande 1041 mais le pot de la bougie est arrivé cassé. Je voudrais un remboursement ou un échange. Merci.' },
      { customer_name: 'Emma Smith', customer_email: 'emma.smith@example.co.uk', subject: 'Cancel please', body: 'Hi, I ordered the discovery box yesterday (order 1044) but I would like to cancel it please, I ordered by mistake.' },
      { customer_name: 'Chloé', customer_email: 'chloe@example.fr', channel: 'instagram', body: 'Coucou ! La bougie Figue existe en grand format ? Et elle tient combien d\'heures ?' },
    ];
    for (var j = 0; j < messages.length; j++) {
      var r = await api('POST', '/messages', messages[j]);
      if (r.warning) { toast(r.warning); break; }
    }
    await refreshMe();
    toast('Exemples chargés.');
    go('inbox');
  }

  // ---------- Démarrage ----------
  refreshMe().then(route).catch(function (err) { toast(err.message); });
})();
