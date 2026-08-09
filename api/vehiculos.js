const { checkAuth } = require('./_lib/auth');
const { getFile, putFile, deleteFile, triggerDeploy } = require('./_lib/github');

const DATA_PATH = 'data/vehiculos.json';

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function loadData() {
  const file = await getFile(DATA_PATH);
  if (!file) {
    return { json: { categorias: {}, vehiculos: [] }, sha: null };
  }
  return { json: JSON.parse(file.content), sha: file.sha };
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

module.exports = async (req, res) => {
  if (!checkAuth(req, res)) return;

  try {
    if (req.method === 'GET') {
      const { json } = await loadData();
      res.status(200).json(json);
      return;
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const incoming = body && body.vehiculo;
      if (!incoming || !incoming.titulo) {
        res.status(400).json({ error: 'Falta el vehículo o el título.' });
        return;
      }

      const { json, sha } = await loadData();
      json.vehiculos = json.vehiculos || [];
      json.categorias = json.categorias || {
        ocasion: 'Ocasión',
        'segunda-mano': 'Segunda mano',
        seminuevo: 'Seminuevo',
        'sin-categorizar': 'Sin categorizar',
      };

      let index = -1;
      if (incoming.slug) {
        index = json.vehiculos.findIndex((v) => v.slug === incoming.slug);
      }

      if (index === -1) {
        // Vehículo nuevo. Si el panel ya nos manda un slug (lo calcula para
        // poder subir fotos antes de guardar la ficha), lo respetamos tal
        // cual siempre que no esté ya en uso; si no, lo generamos aquí.
        if (!incoming.slug) {
          incoming.slug = uniqueSlug(slugify(incoming.titulo), json.vehiculos);
        }
        incoming.orden = nextOrden(json.vehiculos);
        incoming.vendido = !!incoming.vendido;
        incoming.reservado = !!incoming.reservado;
        json.vehiculos.push(incoming);
      } else {
        // Actualización: se conserva "orden" salvo que venga explícito
        const previo = json.vehiculos[index];
        json.vehiculos[index] = {
          ...previo,
          ...incoming,
          orden: incoming.orden ?? previo.orden,
        };
      }

      const nuevoContenido = JSON.stringify(json, null, 2) + '\n';
      await putFile(
        DATA_PATH,
        nuevoContenido,
        `admin: ${index === -1 ? 'nuevo vehiculo' : 'actualiza vehiculo'} ${incoming.slug}`,
        sha
      );
      const deploy = await triggerDeploy();

      res.status(200).json({ ok: true, slug: incoming.slug, deploy });
      return;
    }

    if (req.method === 'DELETE') {
      const slug = (req.query && req.query.slug) || (req.body && req.body.slug);
      if (!slug) {
        res.status(400).json({ error: 'Falta el parámetro slug.' });
        return;
      }
      const { json, sha } = await loadData();
      const existe = json.vehiculos.some((v) => v.slug === slug);
      if (!existe) {
        res.status(404).json({ error: 'No existe ese vehículo.' });
        return;
      }
      json.vehiculos = json.vehiculos.filter((v) => v.slug !== slug);
      const nuevoContenido = JSON.stringify(json, null, 2) + '\n';
      await putFile(DATA_PATH, nuevoContenido, `admin: elimina vehiculo ${slug}`, sha);

      // Intenta borrar también la ficha generada (si existe). No es crítico si falla.
      try {
        const ficha = await getFile(`coches/${slug}/index.html`);
        if (ficha) {
          await deleteFile(`coches/${slug}/index.html`, `admin: elimina ficha ${slug}`, ficha.sha);
        }
      } catch (e) {
        // no crítico
      }

      const deploy = await triggerDeploy();
      res.status(200).json({ ok: true, deploy });
      return;
    }

    res.status(405).json({ error: 'Método no permitido.' });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
};
