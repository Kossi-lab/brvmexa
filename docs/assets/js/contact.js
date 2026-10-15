/* BRVMexa — formulaire de contact (envoi par FormSubmit, service gratuit, sans serveur). */
(function () {
  'use strict';
  var cfg = window.BRVMEXA || {};
  var form = document.querySelector('[data-bx-contact]');
  if (!form) return;
  var notice = document.querySelector('[data-bx-contact-notice]');
  var show = function (cls, text) { if (notice) { notice.className = 'notice ' + cls; notice.textContent = text; notice.hidden = false; } };

  if (/[?&]envoye=1/.test(location.search)) {
    show('notice--ok', 'Merci ! Votre message a bien été envoyé. Nous vous répondrons rapidement.');
  }
  if (!cfg.contactEndpoint) {
    form.querySelectorAll('input, select, textarea, button').forEach(function (el) { el.disabled = true; });
    show('notice--err', 'Le formulaire sera disponible très prochainement.');
    return;
  }
  form.action = cfg.contactEndpoint;
  var next = form.querySelector('input[name="_next"]');
  if (next) next.value = location.origin + location.pathname + '?envoye=1';

  form.addEventListener('submit', function (e) {
    var name = form.elements.name.value.trim();
    var email = form.elements.email.value.trim();
    var msg = form.elements.message.value.trim();
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || msg.length < 5) {
      e.preventDefault();
      show('notice--err', 'Merci de remplir votre nom, une adresse e-mail valide et votre message.');
    }
  });
})();
