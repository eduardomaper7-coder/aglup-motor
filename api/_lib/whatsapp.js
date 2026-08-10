// Cliente mínimo para la API de WhatsApp Cloud (Meta) — sin dependencias externas.
//
// Variables de entorno necesarias:
//   WHATSAPP_TOKEN            - token de acceso permanente (system user) de Meta
//   WHATSAPP_PHONE_NUMBER_ID  - ID del número de teléfono de WhatsApp Business
//   WHATSAPP_VERIFY_TOKEN     - cadena inventada para verificar el webhook con Meta
//   WHATSAPP_API_VERSION      - opcional, por defecto "v22.0"

function apiVersion() {
  return process.env.WHATSAPP_API_VERSION || 'v22.0';
}

function graphBase() {
  return `https://graph.facebook.com/${apiVersion()}`;
}

function envOrThrow(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}.`);
  return v;
}

// Envía un mensaje de texto simple.
async function sendText(to, body) {
  const token = envOrThrow('WHATSAPP_TOKEN');
  const phoneNumberId = envOrThrow('WHATSAPP_PHONE_NUMBER_ID');
  const res = await fetch(`${graphBase()}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`WhatsApp sendText ${res.status}: ${text.slice(0, 500)}`);
  }
  return res.json();
}

// Obtiene la URL temporal (caduca en minutos) de un adjunto a partir de su media_id.
async function getMediaUrl(mediaId) {
  const token = envOrThrow('WHATSAPP_TOKEN');
  const res = await fetch(`${graphBase()}/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`WhatsApp getMediaUrl ${res.status}: ${text.slice(0, 500)}`);
  }
  return res.json(); // { url, mime_type, sha256, file_size, id }
}

// Descarga el binario del adjunto (requiere la URL temporal + el token).
async function downloadMedia(mediaUrl) {
  const token = envOrThrow('WHATSAPP_TOKEN');
  const res = await fetch(mediaUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`WhatsApp downloadMedia ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

module.exports = { sendText, getMediaUrl, downloadMedia, envOrThrow };
