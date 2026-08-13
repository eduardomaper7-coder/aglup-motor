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

// Extrae el primer número de una cadena tipo "120000 km" o "13.990" y lo
// devuelve como entero, o null si no hay ningún dígito.
function numeroDe(valor) {
  const digitos = String(valor == null ? '' : valor).replace(/[^0-9]/g, '');
  return digitos ? parseInt(digitos, 10) : null;
}

// ---------------------------------------------------------------------------
// Clasificación automática de la categoría de un vehículo.
//
// Ni el panel /admin ni el bot de WhatsApp piden ya la categoría: se calcula
// aquí a partir del año de matriculación y los kilómetros, con estas reglas
// (pensadas para el stock habitual del concesionario, con muchos vehículos
// de kilometraje alto):
//
//   - "seminuevo": matriculado en los últimos 6 años Y con 50.000 km o menos
//     (poco uso, prácticamente nuevo).
//   - "ocasion": muy rodado (150.000 km o más) o muy antiguo (2012 o
//     anterior) — el lote de vehículos económicos/de oportunidad.
//   - "segunda-mano": el resto — el grueso habitual del stock.
//
// Un año fuera de rango (p. ej. un error de escritura como "18" en vez de
// "2018") se descarta como dato no fiable en vez de usarse tal cual.
const SEMINUEVO_ANTIGUEDAD_MAX_ANIOS = 6;
const SEMINUEVO_KM_MAX = 50000;
const OCASION_KM_MIN = 150000;
const OCASION_ANIO_MAX = 2012;

function calcularCategoria(anioValor, kmValor) {
  const anioNum = numeroDe(anioValor);
  const anioActual = new Date().getFullYear();
  const anio = anioNum && anioNum > 1900 && anioNum <= anioActual + 1 ? anioNum : null;
  const km = numeroDe(kmValor);

  if (anio !== null && anio >= anioActual - SEMINUEVO_ANTIGUEDAD_MAX_ANIOS && km !== null && km <= SEMINUEVO_KM_MAX) {
    return 'seminuevo';
  }
  if ((km !== null && km >= OCASION_KM_MIN) || (anio !== null && anio <= OCASION_ANIO_MAX)) {
    return 'ocasion';
  }
  return 'segunda-mano';
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
    categoria: calcularCategoria(datos.anio, datos.km),
    precio: datos.precio,
    anio: datos.anio,
    km: datos.km,
    potencia: datos.potencia,
    puertas: '',
    carroceria: '',
    carroceriaTexto: '',
    cambio: datos.cambio,
    cambioTexto: datos.cambioTexto,
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
  calcularCategoria,
};
