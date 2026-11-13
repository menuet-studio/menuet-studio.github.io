// Remplace le nom de marque partout (le nom est provisoire et configurable côté serveur).
(function () {
  var brand = (window.APP_CONFIG && window.APP_CONFIG.brand) || 'OrderPilot';
  document.querySelectorAll('[data-brand]').forEach(function (el) { el.textContent = brand; });
  document.title = document.title.replace(/OrderPilot/g, brand);
})();
