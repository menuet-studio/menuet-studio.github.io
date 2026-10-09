/* Menuet - site du studio. Aucun cookie, aucun suivi. */
(function () {
  'use strict';

  // Démo en direct dans le téléphone (grands écrans seulement)
  var screen = document.querySelector('.phone-screen');
  var frame = screen && screen.querySelector('iframe');
  var wide = window.matchMedia('(min-width: 64rem)');
  function fit() {
    if (!frame) return;
    frame.style.transform = 'scale(' + (screen.clientWidth / 390) + ')';
  }
  function load() {
    if (!frame || frame.getAttribute('src') || !wide.matches) return;
    fit();
    frame.addEventListener('load', function () { screen.classList.add('is-live'); }, { once: true });
    frame.setAttribute('src', frame.getAttribute('data-src'));
  }
  load();
  if (wide.addEventListener) wide.addEventListener('change', load);
  window.addEventListener('resize', fit);

  // Formulaire : ouvre la messagerie avec le message prêt
  var form = document.querySelector('[data-contact-form]');
  if (form) {
    var email = form.getAttribute('data-email');
    var error = form.querySelector('[data-form-error]');
    var note = form.querySelector('[data-form-note]');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = form.elements;
      var resto = f.resto.value.trim();
      var ville = f.ville.value.trim();
      var contact = f.contact.value.trim();
      var missing = !resto ? f.resto : !ville ? f.ville : !contact ? f.contact : null;
      if (missing) {
        error.textContent = 'Il manque : ' + missing.previousElementSibling.textContent.replace(/\s*\(.*\)/, '').toLowerCase() + '.';
        error.hidden = false;
        missing.focus();
        return;
      }
      error.hidden = true;
      var subject = 'Aperçu gratuit pour ' + resto + ' (' + ville + ')';
      var body = 'Bonjour,\n\nJe souhaite recevoir un aperçu gratuit du site de mon restaurant.\n\n' +
        'Restaurant : ' + resto + '\nVille : ' + ville + '\nMe recontacter : ' + contact +
        (f.message.value.trim() ? '\n\n' + f.message.value.trim() : '') + '\n\nMerci !';
      window.location.href = 'mailto:' + email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      note.textContent = 'Votre messagerie s’est ouverte avec le message prêt : il ne reste qu’à l’envoyer. Rien ne s’est ouvert ? Écrivez-nous à ' + email + '.';
    });
  }

  // Copier l'adresse e-mail
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-copy]');
    if (!btn) return;
    var text = btn.getAttribute('data-copy');
    var label = btn.querySelector('span');
    var done = function () { label.textContent = 'Adresse copiée'; setTimeout(function () { label.textContent = 'Copier l’adresse'; }, 2500); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { window.prompt('Adresse e-mail :', text); });
    } else {
      window.prompt('Adresse e-mail :', text);
    }
  });

  var y = document.querySelector('[data-year]');
  if (y) y.textContent = new Date().getFullYear();
})();
