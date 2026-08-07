(function () {
  'use strict';

  var AJAX_ENDPOINT = 'https://formsubmit.co/ajax/info@aglupmotor.com';

  function setMessage(form, text, ok) {
    var box = form.querySelector('.w-form-message');
    if (!box) return;
    box.setAttribute('role', ok ? 'status' : 'alert');
    box.textContent = text;
    box.style.display = 'block';
    box.style.marginTop = '1rem';
    box.style.padding = '0.85rem 1rem';
    box.style.borderRadius = '6px';
    box.style.background = ok ? 'rgba(46, 160, 67, 0.14)' : 'rgba(230, 0, 0, 0.12)';
  }

  function nativeFallback(form) {
    // HTMLFormElement.prototype.submit bypasses this submit listener and posts
    // directly to FormSubmit, so a JS/network parsing issue does not lose the lead.
    HTMLFormElement.prototype.submit.call(form);
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('form[data-aglup-contact-form="true"]').forEach(function (form) {
      form.addEventListener('submit', async function (event) {
        event.preventDefault();

        if (!form.checkValidity()) {
          form.reportValidity();
          return;
        }

        var honey = form.querySelector('[name="_honey"]');
        if (honey && honey.value) return;

        var button = form.querySelector('button[type="submit"]');
        var originalLabel = button ? button.querySelector('.w-btn-label') : null;
        var originalText = originalLabel ? originalLabel.textContent : '';

        if (button) {
          button.disabled = true;
          button.classList.add('loading');
        }
        if (originalLabel) originalLabel.textContent = 'Enviando…';

        var data = new FormData(form);
        data.set('_url', window.location.href);

        try {
          var response = await fetch(AJAX_ENDPOINT, {
            method: 'POST',
            body: data,
            headers: { 'Accept': 'application/json' }
          });
          var result = await response.json().catch(function () { return null; });
          var failed = !response.ok || (result && (result.success === false || result.success === 'false'));
          if (failed) throw new Error('FormSubmit rejected the request');

          setMessage(form, 'Gracias. Hemos recibido tu información correctamente y nos pondremos en contacto contigo.', true);
          form.reset();
        } catch (error) {
          setMessage(form, 'Completando el envío…', true);
          nativeFallback(form);
          return;
        } finally {
          if (button) {
            button.disabled = false;
            button.classList.remove('loading');
          }
          if (originalLabel) originalLabel.textContent = originalText || 'Enviar';
        }
      });
    });
  });
})();
