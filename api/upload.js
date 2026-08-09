const { put } = require('@vercel/blob');
const { checkAuth } = require('./_lib/auth');

// Sube una foto a Vercel Blob y devuelve su URL pública definitiva.
// El panel /admin envía la imagen como base64 en JSON:
//   { slug: "audi-a1", filename: "foto1.jpg", contentType: "image/jpeg", dataBase64: "..." }
//
// Límite práctico: las funciones serverless de Vercel aceptan peticiones de
// hasta ~4.5 MB, así que cada foto (ya en base64) debe pesar menos que eso.
// El panel redimensiona/comprime la imagen en el navegador antes de enviarla.
module.exports = async (req, res) => {
  if (!checkAuth(req, res)) return;
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { slug, filename, contentType, dataBase64 } = body || {};
    if (!slug || !filename || !dataBase64) {
      res.status(400).json({ error: 'Faltan datos (slug, filename o dataBase64).' });
      return;
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      res.status(500).json({ error: 'Falta configurar BLOB_READ_WRITE_TOKEN en Vercel.' });
      return;
    }

    const buffer = Buffer.from(dataBase64, 'base64');
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '-');
    const pathname = `vehiculos/${slug}/${Date.now()}-${safeFilename}`;

    const blob = await put(pathname, buffer, {
      access: 'public',
      contentType: contentType || 'image/jpeg',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    res.status(200).json({ ok: true, url: blob.url });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
};
