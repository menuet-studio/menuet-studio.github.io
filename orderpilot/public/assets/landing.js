// Formulaire de liste d'attente du site vitrine.
(function () {
  var form = document.getElementById('waitlist-form');
  if (!form) return;
  var box = document.getElementById('waitlist-msg');
  function show(text, kind) { box.className = 'alert alert-' + kind; box.textContent = text; }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var data = new FormData(form);
    if (!form.email.checkValidity()) return show('Indiquez une adresse e-mail valide.', 'error');
    if (!form.consent.checked) return show('Cochez la case de consentement pour vous inscrire.', 'error');
    var btn = form.querySelector('button');
    btn.disabled = true;
    try {
      var res = await fetch('/api/waitlist', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: data.get('email'), shop_url: data.get('shop_url') || '', monthly_messages: data.get('monthly_messages') || '', consent: true }),
      });
      var json = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(json.error || 'Inscription impossible.');
      form.reset();
      show('Merci ! Vous serez prévenu du lancement.', 'ok');
    } catch (err) {
      show(err.message, 'error');
    } finally { btn.disabled = false; }
  });
})();
