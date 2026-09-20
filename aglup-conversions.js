/**
 * Medición de conversiones de Google Ads para aglupmotorcanarias.es
 *
 * Marca como conversión:
 *   - Clic en cualquier enlace de WhatsApp  -> "Contacto-whatsapp"
 *   - Clic en cualquier enlace tel: (botón Llamar) -> "Contacto-llamadas"
 *
 * No hay que añadir onclick en los botones: el script escucha los clics de
 * toda la página, así que cualquier botón nuevo de WhatsApp o de teléfono
 * queda medido automáticamente.
 *
 * Si algún día cambian las etiquetas en Google Ads, solo hay que editar
 * el objeto LABELS de abajo.
 */
(function () {
  'use strict';

  var LABELS = {
    whatsapp: 'AW-18367080355/nKcoCJLs0P4cEKPPjbZE', // Contacto-whatsapp
    llamada: 'AW-18367080355/oHdMCL7i0f4cEKPPjbZE'   // Contacto-llamadas
  };

  var VALUE = 1.0;
  var CURRENCY = 'EUR';
  var NAV_TIMEOUT = 900; // ms máximos de espera antes de seguir al enlace

  var WA_HOSTS = [
    'api.whatsapp.com',
    'web.whatsapp.com',
    'whatsapp.com',
    'wa.me',
    'wa.link'
  ];

  function hostOf(href) {
    try {
      return new URL(href, window.location.href).hostname.toLowerCase().replace(/^www\./, '');
    } catch (e) {
      return '';
    }
  }

  // Devuelve 'llamada', 'whatsapp' o null.
  function classify(link) {
    var raw = link.getAttribute('href') || '';
    if (!raw) return null;
    if (/^tel:/i.test(raw.trim())) return 'llamada';
    if (/^(https?:)?\/\//i.test(raw.trim()) || raw.trim().charAt(0) === '/') {
      if (WA_HOSTS.indexOf(hostOf(raw)) !== -1) return 'whatsapp';
    }
    return null;
  }

  function closestLink(node) {
    while (node && node.nodeType === 1) {
      if (node.tagName === 'A' && node.hasAttribute('href')) return node;
      node = node.parentNode;
    }
    return null;
  }

  function track(kind, extra) {
    var payload = {
      send_to: LABELS[kind],
      value: VALUE,
      currency: CURRENCY
    };
    if (extra) {
      for (var k in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, k)) payload[k] = extra[k];
      }
    }

    // Capa de datos: útil si más adelante se añade GA4 o Tag Manager.
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: kind === 'whatsapp' ? 'click_whatsapp' : 'click_llamar',
      contacto_canal: kind
    });

    if (typeof window.gtag === 'function') {
      window.gtag('event', 'conversion', payload);
      return true;
    }
    return false;
  }

  document.addEventListener('click', function (event) {
    if (event.defaultPrevented) return;

    var link = closestLink(event.target);
    if (!link) return;

    var kind = classify(link);
    if (!kind) return;

    var newTab = link.target === '_blank' ||
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
      (typeof event.button === 'number' && event.button !== 0);

    // En tel: el navegador no descarga la página (abre el marcador),
    // y en pestaña nueva tampoco, así que basta con enviar el evento.
    if (kind === 'llamada' || newTab) {
      track(kind);
      return;
    }

    // Navegación en la misma pestaña: esperamos (como máximo NAV_TIMEOUT)
    // a que Google confirme la recepción antes de salir de la página.
    var url = link.href;
    var navigated = false;
    function go() {
      if (navigated) return;
      navigated = true;
      window.location.href = url;
    }

    var sent = track(kind, { event_callback: go });
    if (!sent) return; // sin gtag: dejamos el clic normal

    event.preventDefault();
    window.setTimeout(go, NAV_TIMEOUT);
  }, true);
})();
