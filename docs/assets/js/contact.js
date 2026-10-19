/* BRVMexa — formulaire de contact.
   Les messages sont envoyés à contact@brvmexa.com par FormSubmit (service gratuit, sans serveur),
   sans quitter la page. La toute première fois, FormSubmit envoie un e-mail d'activation à contact@brvmexa.com. */
(function () {
  'use strict';
  var cfg = window.BRVMEXA || {};
  var ENDPOINT = cfg.contactEndpoint || 'https://formsubmit.co/ajax/contact@brvmexa.com';
  var form = document.querySelector('[data-bx-contact]');
  if (!form) return;
  var notice = document.querySelector('[data-bx-contact-notice]');
  var button = form.querySelector('button[type="submit"]');
  var label = button ? button.textContent : '';
  var show = function (cls, text) {
    if (!notice) return;
    notice.className = 'notice ' + cls;
    notice.textContent = text;
    notice.hidden = false;
    notice.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  var busy = function (on) {
    if (!button) return;
    button.disabled = on;
    button.textContent = on ? 'Envoi en cours…' : label;
  };

  // L'envoi passe par l'adresse « ajax » de FormSubmit : on reste sur la page
  if (ENDPOINT.indexOf('/ajax/') === -1) ENDPOINT = ENDPOINT.replace('formsubmit.co/', 'formsubmit.co/ajax/');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = form.elements.name.value.trim();
    var email = form.elements.email.value.trim();
    var msg = form.elements.message.value.trim();
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || msg.length < 5) {
      show('notice--err', 'Merci de remplir votre nom, une adresse e-mail valide et votre message.');
      return;
    }
    if (form.elements._honey && form.elements._honey.value) return; // robot de spam

    var data = {
      _subject: '[BRVMexa] ' + form.elements.sujet.value + ' : ' + name,
      _template: 'table',
      _honey: '',
      'Nom': name,
      email: email,
      'Sujet': form.elements.sujet.value,
      'Message': msg,
      'Page': location.href
    };

    busy(true);
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(data)
    })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (res) {
        var ok = res && (res.success === true || res.success === 'true');
        if (ok) {
          form.reset();
          show('notice--ok', 'Merci ' + name.split(' ')[0] + ' ! Votre message a bien été envoyé. Nous vous répondrons sous 48 heures ouvrées.');
        } else if (res && /activat/i.test(res.message || '')) {
          show('notice--ok', 'Message reçu. Le formulaire est en cours d’activation : nous vous répondrons très bientôt.');
        } else {
          show('notice--err', 'L’envoi n’a pas abouti. Réessayez dans un instant, ou écrivez-nous directement à contact@brvmexa.com.');
        }
      })
      .catch(function () {
        show('notice--err', 'Pas de connexion internet ? Réessayez, ou écrivez-nous directement à contact@brvmexa.com.');
      })
      .then(function () { busy(false); });
  });
})();
