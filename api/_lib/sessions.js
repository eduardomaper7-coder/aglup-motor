// Guarda el estado de cada conversación de WhatsApp en curso como un fichero
// JSON dentro del propio repositorio (data/whatsapp-sesiones/<telefono>.json),
// reutilizando el mismo cliente de GitHub que usa el panel /admin. Así no hace
// falta dar de alta ningún almacén nuevo solo para esto.

const { getFile, putFile, deleteFile } = require('./github');

function pathFor(telefono) {
  const limpio = String(telefono).replace(/[^0-9]/g, '');
  return `data/whatsapp-sesiones/${limpio}.json`;
}

async function getSession(telefono) {
  const file = await getFile(pathFor(telefono));
  if (!file) return null;
  try {
    return { data: JSON.parse(file.content), sha: file.sha };
  } catch (e) {
    return null;
  }
}

async function saveSession(telefono, sessionData, sha) {
  const contenido = JSON.stringify(sessionData, null, 2) + '\n';
  const result = await putFile(pathFor(telefono), contenido, `whatsapp: actualiza sesion ${telefono}`, sha);
  return result.content ? result.content.sha : undefined;
}

async function clearSession(telefono) {
  const file = await getFile(pathFor(telefono));
  if (!file) return;
  await deleteFile(pathFor(telefono), `whatsapp: cierra sesion ${telefono}`, file.sha);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Aplica una mutación a la sesión de forma segura ante escrituras concurrentes
// (p.ej. varias fotos llegando casi a la vez en mensajes separados de WhatsApp).
// Relee la sesión más reciente y reintenta si GitHub rechaza el commit por
// conflicto de sha (409), en vez de perder la escritura de la otra petición.
async function mutarSesion(telefono, sesionInicial, mutar, intentosMax = 5) {
  let existente = await getSession(telefono);
  let session = existente ? existente.data : sesionInicial();
  let sha = existente ? existente.sha : undefined;

  for (let intento = 0; intento < intentosMax; intento++) {
    const siguiente = mutar(session);
    try {
      await saveSession(telefono, siguiente, sha);
      return siguiente;
    } catch (e) {
      if (e && e.status === 409 && intento < intentosMax - 1) {
        await sleep(200 * (intento + 1));
        existente = await getSession(telefono);
        session = existente ? existente.data : sesionInicial();
        sha = existente ? existente.sha : undefined;
        continue;
      }
      throw e;
    }
  }
}

module.exports = { getSession, saveSession, clearSession, mutarSesion };
