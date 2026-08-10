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
  { file: path.join(ROOT, 'coches-tenerife', 'index.html'), gridEnd: GRID_END_LOADMORE },
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
    '{{CARROCERIA_SLUG}}': v.carroceria,
    '{{CARROCERIA_TEXTO}}': v.carroceriaTexto,
    '{{TRACCION_TEXTO}}': v.traccionTexto || '',
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
    `pa_carroceria-${v.carroceria}`,
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
  };
  for (const [token, value] of Object.entries(replacements)) {
    out = out.split(token).join(value ?? '');
  }
  return out;
}

function spliceGrid(fileContent, gridInnerHtml, gridEnd) {
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
  const after = fileContent.slice(endIdx);
  return before + '\n' + gridInnerHtml + '\n' + after;
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

  // 2. Tarjetas del listado (mismo grid en home y en coches-tenerife)
  const cardsHtml = ordenados
    .map((v, i) => buildCardHtml(tplCard, v, categorias, i === 0, i === ordenados.length - 1))
    .join('\n');

  for (const { file, gridEnd } of LISTING_PAGES) {
    if (!fs.existsSync(file)) {
      log('AVISO: no existe', file, '- se omite.');
      continue;
    }
    const original = readFile(file);
    const actualizado = spliceGrid(original, cardsHtml, gridEnd);
    writeFile(file, actualizado);
    log('Listado actualizado:', path.relative(ROOT, file));
  }

  log('Build completado.');
}

main();
