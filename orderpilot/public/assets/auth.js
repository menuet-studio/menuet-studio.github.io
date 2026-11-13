// Formulaires de connexion et d'inscription.
(function () {
  var form = document.getElementById('auth-form');
  var box = document.getElementById('auth-msg');
  var mode = form.dataset.mode;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    box.className = ''; box.textContent = '';
    var d = Object.fromEntries(new FormData(form));
    if (mode === 'signup') {
      if (!d.storeName || !d.storeName.trim()) return fail('Indiquez le nom de votre boutique.');
      if (!d.password || d.password.length < 10) return fail('Le mot de passe doit contenir au moins 10 caractères.');
      if (!form.terms.checked) return fail('Merci de confirmer avoir lu la politique de confidentialité.');
    }
    if (!form.email.checkValidity()) return fail('Indiquez une adresse e-mail valide.');
    var btn = form.querySelector('button');
    btn.disabled = true;
    try {
      var body = mode === 'signup'
        ? { email: d.email, password: d.password, name: d.name || '', storeName: d.storeName }
        : { email: d.email, password: d.password };
      var res = await fetch('/api/auth/' + mode, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      var json = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(json.error || 'Une erreur est survenue.');
      location.href = '/app';
    } catch (err) { fail(err.message); } finally { btn.disabled = false; }
  });

  function fail(text) { box.className = 'alert alert-error'; box.textContent = text; }
})();
