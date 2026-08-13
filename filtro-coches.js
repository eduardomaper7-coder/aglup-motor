/**
 * Filtro real del "Buscador avanzado" en los listados de coches
 * (coches-tenerife y las páginas de categoría). Filtra las tarjetas
 * (.w-grid-item) según los atributos data-* que genera scripts/build.js
 * a partir de data/vehiculos.json (marca, modelo, combustible, cambio,
 * precio, km, año). No depende de ningún backend: todo ocurre en el navegador.
 */
(function () {
  function initFiltro(form) {
    var grid = document.querySelector('.w-grid-list');
    if (!grid) return;
    var items = Array.prototype.slice.call(grid.querySelectorAll('.w-grid-item'));

    var selMarca = form.querySelector('[name="f_marca"]');
    var selModelo = form.querySelector('[name="f_modelo"]');
    var selCombustible = form.querySelector('[name="f_combustible"]');
    var selCambio = form.querySelector('[name="f_cambio"]');
    var precioMin = form.querySelector('[name="f_precio_min"]');
    var precioMax = form.querySelector('[name="f_precio_max"]');
    var kmMax = form.querySelector('[name="f_km_max"]');
    var anioMin = form.querySelector('[name="f_anio_min"]');
    var anioMax = form.querySelector('[name="f_anio_max"]');
    if (!selMarca || !selModelo) return;

    var mensajeVacio = document.createElement('div');
    mensajeVacio.className = 'js-filtro-sin-resultados';
    mensajeVacio.style.cssText =
      'display:none;grid-column:1/-1;padding:40px 20px;text-align:center;font-size:16px;color:#666;width:100%;';
    mensajeVacio.textContent = 'No se han encontrado vehículos con esos filtros.';
    grid.appendChild(mensajeVacio);

    function actualizarModelosVisibles() {
      var marca = selMarca.value;
      Array.prototype.forEach.call(selModelo.options, function (opt) {
        if (!opt.value) return; // "Todos los modelos"
        opt.hidden = !!marca && opt.getAttribute('data-marca') !== marca;
      });
      var actual = selModelo.options[selModelo.selectedIndex];
      if (actual && actual.hidden) selModelo.value = '';
    }

    function numeroOrNaN(input) {
      if (!input || input.value === '') return NaN;
      var n = parseInt(input.value, 10);
      return isNaN(n) ? NaN : n;
    }

    function aplicar() {
      var marca = selMarca.value;
      var modelo = selModelo.value;
      var combustible = selCombustible ? selCombustible.value : '';
      var cambio = selCambio ? selCambio.value : '';
      var pMin = numeroOrNaN(precioMin);
      var pMax = numeroOrNaN(precioMax);
      var kMax = numeroOrNaN(kmMax);
      var aMin = numeroOrNaN(anioMin);
      var aMax = numeroOrNaN(anioMax);

      var visibles = 0;
      items.forEach(function (item) {
        var dMarca = item.getAttribute('data-marca') || '';
        var dModelo = item.getAttribute('data-modelo') || '';
        var dCombustible = ' ' + (item.getAttribute('data-combustible') || '') + ' ';
        var dCambio = item.getAttribute('data-cambio') || '';
        var dPrecio = parseInt(item.getAttribute('data-precio'), 10);
        var dKm = parseInt(item.getAttribute('data-km'), 10);
        var dAnio = parseInt(item.getAttribute('data-anio'), 10);

        var ok = true;
        if (marca && dMarca !== marca) ok = false;
        if (ok && modelo && dModelo !== modelo) ok = false;
        if (ok && combustible && dCombustible.indexOf(' ' + combustible + ' ') === -1) ok = false;
        if (ok && cambio && dCambio !== cambio) ok = false;
        if (ok && !isNaN(pMin) && (isNaN(dPrecio) || dPrecio < pMin)) ok = false;
        if (ok && !isNaN(pMax) && (isNaN(dPrecio) || dPrecio > pMax)) ok = false;
        if (ok && !isNaN(kMax) && (isNaN(dKm) || dKm > kMax)) ok = false;
        if (ok && !isNaN(aMin) && (isNaN(dAnio) || dAnio < aMin)) ok = false;
        if (ok && !isNaN(aMax) && (isNaN(dAnio) || dAnio > aMax)) ok = false;

        item.style.display = ok ? '' : 'none';
        if (ok) visibles++;
      });

      mensajeVacio.style.display = visibles === 0 ? 'block' : 'none';
    }

    selMarca.addEventListener('change', function () {
      actualizarModelosVisibles();
      aplicar();
    });
    [selModelo, selCombustible, selCambio].forEach(function (el) {
      if (el) el.addEventListener('change', aplicar);
    });
    [precioMin, precioMax, kmMax, anioMin, anioMax].forEach(function (el) {
      if (!el) return;
      el.addEventListener('input', aplicar);
      el.addEventListener('change', aplicar);
    });

    var btnAplicar = form.querySelector('.js-filtro-aplicar');
    if (btnAplicar) {
      btnAplicar.addEventListener('click', function (e) {
        e.preventDefault();
        aplicar();
      });
    }
    var btnReset = form.querySelector('.js-filtro-reset');
    if (btnReset) {
      btnReset.addEventListener('click', function (e) {
        e.preventDefault();
        form.reset();
        actualizarModelosVisibles();
        aplicar();
      });
    }

    actualizarModelosVisibles();
    aplicar();
  }

  document.addEventListener('DOMContentLoaded', function () {
    var form = document.querySelector('.js-filtro-coches');
    if (form) initFiltro(form);
  });
})();
