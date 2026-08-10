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

module.exports = { getSession, saveSession, clearSession };
