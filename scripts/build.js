#!/usr/bin/env node
/**
 * Genera las páginas estáticas del catálogo de vehículos a partir de
 * data/vehiculos.json y las plantillas en templates/.
 *
 * Se ejecuta automáticamente en cada deploy de Vercel (ver vercel.json,
 * buildCommand: "node scripts/build.js") y también se puede lanzar a mano:
 *   node scripts/build.js
 *
 * No debe editarse a mano el contenido de coches/<slug>/index.html: se
 * sobrescribe en cada build. El único fichero que hay que editar (o mejor,
 * dejar que edite el panel /admin) es data/vehiculos.json.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'data', 'vehiculos.json');
const TPL_DETALLE = path.join(ROOT, 'templates', 'vehiculo.tpl.html');
const TPL_CARD = path.join(ROOT, 'templates', 'card.tpl.html');

// Páginas que contienen un listado de vehículos y deben regenerarse.
// "anchorStart"/"anchorEnd" delimitan el bloque donde van las tarjetas.
const GRID_END_LOADMORE = '<div class="g-loadmore';
const GRID_END_CAROUSEL = '<div class="w-grid-carousel-json';

const LISTING_PAGES = [
  { file: path.join(ROOT, 'index.html'), gridEnd: GRID_END_CAROUSEL },
  { file: path.join(ROOT, 'coches-tenerife', 'index.html'), gridEnd: GRID_END_LOADMORE, filtro: true },
  // Páginas de categoría (enlazadas desde el menú "Comprar coche"): antes se
  // quedaban congeladas con el contenido original de la migración porque
  // nunca se regeneraban. Cada una solo muestra los vehículos de su categoría.
  {
    file: path.join(ROOT, 'coche', 'ocasion', 'index.html'),
    gridEnd: GRID_END_LOADMORE,
    categoria: 'ocasion',
    filtro: true,
  },
  {
    file: path.join(ROOT, 'coche', 'segunda-mano', 'index.html'),
    gridEnd: GRID_END_LOADMORE,
    categoria: 'segunda-mano',
    filtro: true,
  },
  {
    file: path.join(ROOT, 'coche', 'seminuevo', 'index.html'),
    gridEnd: GRID_END_LOADMORE,
    categoria: 'seminuevo',
    filtro: true,
  },
  {
    file: path.join(ROOT, 'coche', 'sin-categorizar', 'index.html'),
    gridEnd: GRID_END_LOADMORE,
    categoria: 'sin-categorizar',
    filtro: true,
  },
];

function log(...args) {
  console.log('[build]', ...args);
}

function readFile(p) {
  return fs.readFileSync(p, 'utf-8');
}

function writeFile(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf-8');
}

function loadData() {
  const raw = JSON.parse(readFile(DATA_PATH));
  const categorias = raw.categorias || {};
  const vehiculos = (raw.vehiculos || []).slice();
  return { categorias, vehiculos };
}

// Orden de publicación: disponibles primero (por "orden"), vendidos siempre al final.
function ordenarVehiculos(vehiculos) {
  return vehiculos.slice().sort((a, b) => {
    const va = a.vendido ? 1 : 0;
    const vb = b.vendido ? 1 : 0;
    if (va !== vb) return va - vb;
    return (a.orden ?? 0) - (b.orden ?? 0);
  });
}

// Hash numérico estable a partir del slug, para rellenar data-id / post-ID
// (solo se usa como identificador visual/interno, no tiene que coincidir con nada real).
function idFromSlug(slug) {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return 10000 + (h % 89999);
}

function escapeAttr(s) {
  return String(s ?? '').replace(/"/g, '&quot;');
}

// ---- Plantilla de FICHA DE VEHÍCULO (coches/<slug>/index.html) ----

function buildGaleriaHtml(v) {
  const fotos = v.fotos && v.fotos.length ? v.fotos : ['/wp-content/uploads/placeholder-coche.png'];
  return fotos
    .map((url) => {
      const alt = escapeAttr(v.titulo);
      return (
        `<div class="woocommerce-product-gallery__image" data-thumb="${url}" data-thumb-alt="${alt}">` +
        `<a href="${url}">` +
        `<img alt="${alt}" class="wp-post-image" data-caption="" data-large_image="${url}" ` +
        `data-large_image_height="1080" data-large_image_width="1080" data-src="${url}" ` +
        `decoding="async" fetchpriority="high" height="1080" sizes="(max-width: 1080px) 100vw, 1080px" ` +
        `src="${url}" width="1080"/>` +
        `</a></div>`
      );
    })
    .join('');
}

function buildDetallePage(tplDetalle, v) {
  const combustibleTexto = (v.combustibles || []).map((c) => c.texto).join(', ') || 'Consultar';
  const combustibleSlug = (v.combustibles && v.combustibles[0] && v.combustibles[0].slug) || 'gasolina';

  let out = tplDetalle;
  const replacements = {
    '{{TITULO}}': v.titulo,
    '{{PRECIO}}': v.precio + ' ',
    '{{ANIO}}': v.anio,
    '{{KM}}': v.km,
    '{{POTENCIA}}': v.potencia,
    '{{PUERTAS}}': v.puertas,
    '{{GARANTIA_TEXTO}}': v.garantiaTexto || '',
    '{{COMBUSTIBLE_SLUG}}': combustibleSlug,
    '{{COMBUSTIBLE_TEXTO}}': combustibleTexto,
    '{{CAMBIO_SLUG}}': v.cambio,
    '{{CAMBIO_TEXTO}}': v.cambioTexto,
    '{{FOTO_PRINCIPAL}}': (v.fotos && v.fotos[0]) || '',
    '{{GALERIA}}': buildGaleriaHtml(v),
  };
  for (const [token, value] of Object.entries(replacements)) {
    out = out.split(token).join(value ?? '');
  }

  // Aviso "VENDIDO" justo debajo del título en la propia ficha (no viene en la plantilla original).
  if (v.vendido) {
    const banner =
      '<div style="display:inline-block;margin:0 0 12px;padding:6px 14px;border-radius:4px;' +
      'background:#a60510;color:#fff;font-weight:800;text-transform:uppercase;font-size:12px;' +
      'letter-spacing:0.5px;">Vendido</div><br/>';
    out = out.replace('</h1>', '</h1>' + banner);
  } else if (v.reservado) {
    const banner =
      '<div style="display:inline-block;margin:0 0 12px;padding:6px 14px;border-radius:4px;' +
      'background:#d35400;color:#fff;font-weight:800;text-transform:uppercase;font-size:12px;' +
      'letter-spacing:0.5px;">Reservado</div><br/>';
    out = out.replace('</h1>', '</h1>' + banner);
  }

  return out;
}

// ---- Plantilla de TARJETA en listados (home + coches-tenerife) ----

function buildSliderImagesHtml(v) {
  const fotos = v.fotos && v.fotos.length ? v.fotos : ['/wp-content/uploads/placeholder-coche.png'];
  const slots = [0, 1, 2].map((i) => fotos[i % fotos.length]);
  return slots
    .map((url, i) => {
      const alt = escapeAttr(v.titulo);
      const left = (i * 33.33).toFixed(2);
      const priorityAttr = i === 0 ? ' fetchpriority="high"' : '';
      return (
        `<div class="w-post-slider-trigger" style="width:33.33%; left:${left}%;"></div>` +
        `<img alt="${alt}" class="attachment-full size-full" data-lazy-src="${url}" decoding="async"${priorityAttr} height="1080" ` +
        `src="data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201080%201080'%3E%3C/svg%3E" width="1080"/>` +
        `<noscript><img alt="${alt}" class="attachment-full size-full" decoding="async"${priorityAttr} height="1080" src="${url}" width="1080"/></noscript>`
      );
    })
    .join('');
}

function buildCombustibleHtml(v) {
  const combustibles = v.combustibles && v.combustibles.length ? v.combustibles : [{ slug: 'gasolina', texto: 'Gasolina' }];
  return combustibles
    .map((c) => `<span class="term-65 term-${c.slug}">${c.texto}</span>`)
    .join('<b>, </b>');
}

function buildEstadoBadgeHtml(v) {
  if (v.vendido) {
    return '<div class="w-post-elm post_taxonomy usg_post_taxonomy_estado_etiqueta etiqueta-grid-estado style_simple color_link_inherit"><span class="term-98 term-vendido">Vendido</span></div>';
  }
  if (v.reservado) {
    return '<div class="w-post-elm post_taxonomy usg_post_taxonomy_estado_etiqueta etiqueta-grid-estado style_simple color_link_inherit"><span class="term-99 term-reservado">Reservado</span></div>';
  }
  return '';
}

function buildEstadoTagClass(v) {
  if (v.vendido) return 'product_tag-vendido';
  if (v.reservado) return 'product_tag-reservado';
  return '';
}

function buildPaClasses(v) {
  const marcaSlug = slugify(v.marca);
  const modeloSlug = slugify(v.modelo);
  const combustibleClasses = (v.combustibles || [])
    .map((c) => `pa_combustible-${c.slug}`)
    .join(' ');
  return [
    `pa_cambio-${v.cambio}`,
    combustibleClasses,
    `pa_marca-${marcaSlug}`,
    `pa_modelo-${modeloSlug}`,
  ]
    .filter(Boolean)
    .join(' ');
}

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Extrae solo los dígitos de un texto tipo "13.990" o "165000 km" y lo
// devuelve como número (o '' si no hay ninguno) — para poder filtrar/ordenar
// en el navegador sin tener que volver a parsear el texto formateado.
function soloNumero(texto) {
  const digitos = String(texto ?? '').replace(/[^0-9]/g, '');
  return digitos === '' ? '' : String(parseInt(digitos, 10));
}

function buildCardHtml(tplCard, v, categorias, isFirst, isLast) {
  let out = tplCard;
  const posClass = [isFirst ? 'first' : '', isLast ? 'last' : ''].filter(Boolean).join(' ');
  const replacements = {
    '{{POST_ID}}': String(idFromSlug(v.slug)),
    '{{CATEGORIA_SLUG}}': v.categoria,
    '{{PA_CLASSES}}': buildPaClasses(v) + (posClass ? ' ' + posClass : ''),
    '{{ESTADO_TAG_CLASS}}': buildEstadoTagClass(v),
    '{{SLIDER_IMAGES}}': buildSliderImagesHtml(v),
    '{{TITULO}}': v.titulo,
    '{{SLUG}}': v.slug,
    '{{CATEGORIA_TEXTO}}': categorias[v.categoria] || v.categoria,
    '{{ESTADO_BADGE}}': buildEstadoBadgeHtml(v),
    '{{PRECIO}}': v.precio,
    '{{ETIQUETA_DGT_CLASS}}': v.etiquetaDgt || '',
    '{{KM}}': v.km,
    '{{COMBUSTIBLE_HTML}}': buildCombustibleHtml(v),
    '{{ANIO}}': v.anio,
    '{{CAMBIO_SLUG}}': v.cambio,
    '{{CAMBIO_TEXTO}}': v.cambioTexto,
    '{{DATA_PRECIO}}': soloNumero(v.precio),
    '{{DATA_KM}}': soloNumero(v.km),
    '{{DATA_ANIO}}': soloNumero(v.anio),
    '{{DATA_MARCA_SLUG}}': slugify(v.marca),
    '{{DATA_MODELO_SLUG}}': slugify(v.modelo),
    '{{DATA_COMBUSTIBLE_SLUGS}}': (v.combustibles || []).map((c) => c.slug).join(' '),
    '{{DATA_VENDIDO}}': v.vendido ? '1' : '0',
  };
  for (const [token, value] of Object.entries(replacements)) {
    out = out.split(token).join(value ?? '');
  }
  return out;
}

// ---- Opciones dinámicas del buscador avanzado (Marca/Modelo/Combustible/Cambio) ----
// El widget original traía las opciones fijas de la migración (Audi, Mercedes,
// Nissan, Opel...) y nunca se actualizaban con el catálogo real, así que el
// filtro no encontraba coincidencias. Aquí se recalculan en cada build a
// partir de los vehículos publicados.

function buildFiltroOpciones(vehiculos) {
  const marcas = new Map(); // slug -> texto
  const modelos = new Map(); // slug -> { texto, marcaSlug }
  const combustibles = new Map(); // slug -> texto
  const cambios = new Map(); // slug -> texto

  for (const v of vehiculos) {
    const marcaSlug = slugify(v.marca);
    if (marcaSlug && !marcas.has(marcaSlug)) marcas.set(marcaSlug, v.marca);
    const modeloSlug = slugify(v.modelo);
    if (modeloSlug && !modelos.has(modeloSlug)) modelos.set(modeloSlug, { texto: v.modelo, marcaSlug });
    for (const c of v.combustibles || []) {
      if (c.slug && !combustibles.has(c.slug)) combustibles.set(c.slug, c.texto);
    }
    if (v.cambio && !cambios.has(v.cambio)) cambios.set(v.cambio, v.cambioTexto || v.cambio);
  }

  const porTexto = (texto) => (a, b) => String(a[1]).localeCompare(String(b[1]), 'es');

  const opcionesMarca = [...marcas.entries()]
    .sort(porTexto())
    .map(([slug, texto]) => `<option value="${slug}">${texto}</option>`)
    .join('');

  const opcionesModelo = [...modelos.entries()]
    .sort((a, b) => String(a[1].texto).localeCompare(String(b[1].texto), 'es'))
    .map(([slug, { texto, marcaSlug }]) => `<option value="${slug}" data-marca="${marcaSlug}">${texto}</option>`)
    .join('');

  const opcionesCombustible = [...combustibles.entries()]
    .sort(porTexto())
    .map(([slug, texto]) => `<option value="${slug}">${texto}</option>`)
    .join('');

  const opcionesCambio = [...cambios.entries()]
    .sort(porTexto())
    .map(([slug, texto]) => `<option value="${slug}">${texto}</option>`)
    .join('');

  return { opcionesMarca, opcionesModelo, opcionesCombustible, opcionesCambio };
}

// Sustituye el contenido de un <select name="..."> por las opciones dadas,
// buscando siempre el marcador name="..."> y el siguiente </select> (igual
// que spliceGrid con el listado de tarjetas). A diferencia de un token
// {{...}}, este marcador no se "consume": sigue estando en el fichero
// después de cada build, así que las opciones se pueden refrescar de nuevo
// en el build siguiente en vez de quedarse congeladas con lo que hubiera la
// primera vez (era el mismo problema que tenían las páginas de categoría).
function spliceSelectOptions(fileContent, selectName, innerHtml) {
  const marker = `name="${selectName}">`;
  const idx = fileContent.indexOf(marker);
  if (idx === -1) {
    throw new Error(`No se ha encontrado el <select name="${selectName}"> en el fichero.`);
  }
  const contentStart = idx + marker.length;
  const endIdx = fileContent.indexOf('</select>', contentStart);
  if (endIdx === -1) {
    throw new Error(`No se ha encontrado el cierre </select> de ${selectName}.`);
  }
  return fileContent.slice(0, contentStart) + innerHtml + fileContent.slice(endIdx);
}

// Mensaje de "sin resultados" que WordPress deja en el HTML estático cuando,
// en el momento de la migración, esa categoría no tenía ningún vehículo
// publicado (p. ej. "segunda mano" estaba vacía en ese momento). El bloque
// queda congelado tal cual en el fichero para siempre porque spliceGrid solo
// toca la parte de arriba (las tarjetas); si no se retira aquí, el mensaje se
// sigue mostrando aunque ya haya vehículos, y si no se vuelve a añadir cuando
// la categoría SÍ está vacía, no se avisa de nada. Por eso lo gestionamos a
// mano a partir de la lista real de vehículos en cada build.
const NO_RESULTS_RE = /<div class="w-grid-none[^"]*">[^<]*<\/div>/;
const NO_RESULTS_HTML = '<div class="w-grid-none type_message">No se han encontrado resultados.</div>';

function spliceGrid(fileContent, gridInnerHtml, gridEnd, listaVacia) {
  const divIdx = fileContent.indexOf('<div class="w-grid-list');
  if (divIdx === -1) {
    throw new Error('No se ha encontrado el contenedor w-grid-list en el fichero.');
  }
  const openTagEnd = fileContent.indexOf('>', divIdx);
  if (openTagEnd === -1) {
    throw new Error('Etiqueta w-grid-list mal formada.');
  }
  const contentStart = openTagEnd + 1;
  const endIdx = fileContent.indexOf(gridEnd, contentStart);
  if (endIdx === -1) {
    throw new Error('No se ha encontrado el final del bloque de listado en el fichero.');
  }
  const before = fileContent.slice(0, contentStart);
  let after = fileContent.slice(endIdx);
  // Quita cualquier mensaje de "sin resultados" congelado de la migración;
  // si de verdad no hay vehículos en esta categoría, se vuelve a añadir justo
  // debajo, así siempre refleja el estado real en vez de uno fosilizado.
  after = after.replace(NO_RESULTS_RE, '');
  if (listaVacia) {
    after = after.replace(gridEnd, NO_RESULTS_HTML + gridEnd);
  }
  // El div.w-grid-list original se cerraba justo antes de gridEnd, pero ese
  // cierre formaba parte del contenido antiguo que estamos descartando (las
  // tarjetas viejas). Si no se vuelve a añadir aquí, el div se queda abierto
  // para siempre: el navegador termina metiendo el resto de la página dentro
  // de él, lo que rompe la maquetación del listado (columna estrecha, altura
  // gigantesca, texto cortado).
  return before + '\n' + gridInnerHtml + '\n</div>\n' + after;
}

function main() {
  log('Cargando data/vehiculos.json...');
  const { categorias, vehiculos } = loadData();
  const publicables = vehiculos.filter((v) => !v.borrador);
  const enBorrador = vehiculos.length - publicables.length;
  const ordenados = ordenarVehiculos(publicables);
  log(
    `${ordenados.length} vehículos publicados (${ordenados.filter((v) => v.vendido).length} vendidos)` +
      (enBorrador ? `, ${enBorrador} en borrador (no se publican).` : '.')
  );

  const tplDetalle = readFile(TPL_DETALLE);
  const tplCard = readFile(TPL_CARD);

  // 1. Fichas individuales
  for (const v of ordenados) {
    const html = buildDetallePage(tplDetalle, v);
    const outPath = path.join(ROOT, 'coches', v.slug, 'index.html');
    writeFile(outPath, html);
    log('Ficha generada:', `coches/${v.slug}/index.html`);
  }

  // 2. Tarjetas de cada listado. Home y coches-tenerife muestran todo; las
  // páginas de categoría solo los vehículos de esa categoría.
  function cardsHtmlPara(lista) {
    return lista.map((v, i) => buildCardHtml(tplCard, v, categorias, i === 0, i === lista.length - 1)).join('\n');
  }
  const cardsHtmlTodos = cardsHtmlPara(ordenados);
  const filtroOpciones = buildFiltroOpciones(ordenados);

  for (const { file, gridEnd, categoria, filtro } of LISTING_PAGES) {
    if (!fs.existsSync(file)) {
      log('AVISO: no existe', file, '- se omite.');
      continue;
    }
    const lista = categoria ? ordenados.filter((v) => v.categoria === categoria) : ordenados;
    const cardsHtml = categoria ? cardsHtmlPara(lista) : cardsHtmlTodos;
    let original = readFile(file);
    // Otro resto congelado de la migración: si en el momento de exportar la
    // página desde WordPress esa categoría estaba vacía, el contenedor
    // ".w-grid" del listado se exportó con la clase "hidden" puesta (en el
    // sitio real la quitaba JS al cargar los resultados por AJAX). Como aquí
    // no hay AJAX, esa clase se queda para siempre y el listado no se ve
    // nunca aunque ya tenga vehículos - solo la quitamos del contenedor del
    // grid en sí (el "hidden" de otros elementos, como el botón "Cargar más",
    // es intencional y no se toca).
    original = original.replace(
      /(class="w-grid us_product_list[^"]*?)\bhidden\s*/,
      '$1'
    );
    let actualizado = spliceGrid(original, cardsHtml, gridEnd, lista.length === 0);
    if (filtro) {
      actualizado = spliceSelectOptions(
        actualizado,
        'f_marca',
        '<option value="">Todas las marcas</option>' + filtroOpciones.opcionesMarca
      );
      actualizado = spliceSelectOptions(
        actualizado,
        'f_modelo',
        '<option value="">Todos los modelos</option>' + filtroOpciones.opcionesModelo
      );
      actualizado = spliceSelectOptions(
        actualizado,
        'f_combustible',
        '<option value="">Cualquiera</option>' + filtroOpciones.opcionesCombustible
      );
      actualizado = spliceSelectOptions(
        actualizado,
        'f_cambio',
        '<option value="">Cualquiera</option>' + filtroOpciones.opcionesCambio
      );
    }
    writeFile(file, actualizado);
    log('Listado actualizado:', path.relative(ROOT, file), `(${lista.length} vehículos)`);
  }

  log('Build completado.');
}

main();
