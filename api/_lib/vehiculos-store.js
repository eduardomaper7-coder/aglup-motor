// Utilidades compartidas para leer/escribir data/vehiculos.json desde
// distintos endpoints (panel /admin y bot de WhatsApp).

const { getFile, putFile } = require('./github');

const DATA_PATH = 'data/vehiculos.json';

const CATEGORIAS_DEFECTO = {
  ocasion: 'Ocasión',
  'segunda-mano': 'Segunda mano',
  seminuevo: 'Seminuevo',
  'sin-categorizar': 'Sin categorizar',
};

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function loadVehiculos() {
  const file = await getFile(DATA_PATH);
  if (!file) {
    return { json: { categorias: CATEGORIAS_DEFECTO, vehiculos: [] }, sha: null };
  }
  const json = JSON.parse(file.content);
  json.categorias = json.categorias || CATEGORIAS_DEFECTO;
  json.vehiculos = json.vehiculos || [];
  return { json, sha: file.sha };
}

async function saveVehiculos(json, sha, mensaje) {
  const contenido = JSON.stringify(json, null, 2) + '\n';
  return putFile(DATA_PATH, contenido, mensaje, sha);
}

function nextOrden(vehiculos) {
  return vehiculos.reduce((max, v) => Math.max(max, v.orden || 0), 0) + 1;
}

function uniqueSlug(base, vehiculos) {
  let slug = base || 'vehiculo';
  let i = 2;
  const existing = new Set(vehiculos.map((v) => v.slug));
  while (existing.has(slug)) {
    slug = `${base}-${i}`;
    i += 1;
  }
  return slug;
}

// Crea un vehículo nuevo marcado como borrador (pendiente de revisión humana)
// a partir de los datos recogidos por el bot de WhatsApp.
async function crearVehiculoBorrador(datos, fotos) {
  const { json, sha } = await loadVehiculos();
  const baseSlug = slugify(datos.titulo);
  const slug = uniqueSlug(baseSlug, json.vehiculos);

  const vehiculo = {
    slug,
    marca: datos.marca || '',
    modelo: datos.modelo || '',
    titulo: datos.titulo,
    categoria: datos.categoria || 'sin-categorizar',
    precio: datos.precio,
    anio: datos.anio,
    km: datos.km,
    potencia: datos.potencia,
    puertas: '',
    carroceria: datos.carroceria,
    carroceriaTexto: datos.carroceriaTexto,
    cambio: datos.cambio,
    cambioTexto: datos.cambioTexto,
    traccion: datos.traccion || '',
    traccionTexto: datos.traccionTexto || '',
    combustibles: datos.combustibles || [],
    garantiaTexto: 'Garantía incluida: 12 meses',
    etiquetaDgt: '',
    fotos: fotos || [],
    vendido: false,
    reservado: false,
    borrador: true,
    orden: nextOrden(json.vehiculos),
  };

  json.vehiculos.push(vehiculo);
  await saveVehiculos(json, sha, `whatsapp: nuevo borrador ${slug}`);
  return vehiculo;
}

module.exports = {
  DATA_PATH,
  CATEGORIAS_DEFECTO,
  slugify,
  loadVehiculos,
  saveVehiculos,
  nextOrden,
  uniqueSlug,
  crearVehiculoBorrador,
};
